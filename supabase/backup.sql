-- Servix — backup manual por empresa (página /admin, botão "Fazer backup agora").
--
-- ESTADO: ainda NÃO aplicado em produção. Testado num Postgres local (backup_test.sql: 18 OK).
--
-- PRÉ-REQUISITO: multi_empresa.sql, multi_empresa_admin.sql, armazenamento.sql,
-- contratantes.sql e contratantes_fecho.sql já aplicados. Só ADITIVO (não altera nem apaga nada que já
-- existe) e seguro de repetir.
--
-- O QUE FAZ
--   DADOS    : cada clique tira uma "fotografia" dos dados da empresa (definições,
--              dados do app, clientes, funcionários, contratantes e períodos) e
--              guarda-a na tabela `company_backups`, dentro do próprio Supabase.
--              Ficam as 5 últimas fotografias de cada empresa; as mais antigas
--              são apagadas sozinhas.
--   FICHEIROS: a função `admin-backup-files` (Edge Function) copia os ficheiros da
--              empresa do cofre `servix-files` para o cofre `servix-backups`
--              (privado, só ela lhe acede). Só copia o que ainda não está lá e
--              nunca apaga nada.
--   RESTAURAR: é manual (feito por quem mantém o Servix, a partir da fotografia).
--
-- O QUE NÃO PROTEGE: se o projeto inteiro do Supabase se perder, o backup perde-se
-- junto (está no mesmo sítio). Também não guarda as contas de login (Auth).
--
-- Erros (mensagem fixa): not_found, sem permissão.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabela das fotografias
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.company_backups (
  id            bigserial primary key,
  company_id    integer not null references public.companies(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    text,
  data          jsonb not null,
  rows_count    integer not null default 0,
  data_bytes    integer not null default 0,
  files_at      timestamptz,
  files_count   integer,
  files_copied  integer,
  files_bytes   bigint
);
create index if not exists company_backups_company_idx on public.company_backups (company_id, id desc);

alter table public.company_backups enable row level security;
revoke all on public.company_backups from anon, authenticated;
grant select, insert, update, delete on public.company_backups to service_role;
grant usage, select on sequence public.company_backups_id_seq to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. O cofre dos backups (privado, sem regras de acesso: só a Edge Function,
--    com a chave de serviço, lhe acede)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('servix-backups', 'servix-backups', false)
on conflict (id) do update set public = false;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Tirar a fotografia dos dados de uma empresa
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_backup_company(p_company integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data   jsonb;
  v_rows   integer;
  v_id     bigint;
  v_at     timestamptz;
  v_bytes  integer;
begin
  perform private.admin_guard();
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'not_found';
  end if;

  select jsonb_build_object(
    'version', 1,
    'company_id', p_company,
    'company',          (select to_jsonb(c) from public.companies c where c.id = p_company),
    'company_settings', (select to_jsonb(s) from public.company_settings s where s.id = p_company),
    'app_data',         (select to_jsonb(a) from public.app_data a where a.id = p_company),
    'clients',          coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.clients x where x.company_id = p_company), '[]'::jsonb),
    'staff',            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.staff x where x.company_id = p_company), '[]'::jsonb),
    'contractors',      coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.contractors x where x.company_id = p_company), '[]'::jsonb),
    'contractor_periods', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.contractor_periods x where x.company_id = p_company), '[]'::jsonb)
  ) into v_data;

  v_rows := jsonb_array_length(v_data -> 'clients') + jsonb_array_length(v_data -> 'staff')
          + jsonb_array_length(v_data -> 'contractors') + jsonb_array_length(v_data -> 'contractor_periods');
  v_bytes := octet_length(v_data::text);

  insert into public.company_backups (company_id, created_by, data, rows_count, data_bytes)
  values (p_company, private.auth_email(), v_data, v_rows, v_bytes)
  returning id, created_at into v_id, v_at;

  -- guarda só as 5 últimas fotografias desta empresa
  delete from public.company_backups
   where company_id = p_company
     and id not in (select id from public.company_backups where company_id = p_company order by id desc limit 5)
     -- nem a última que registou uma cópia de ficheiros (é ela que a página mostra)
     and id is distinct from (select max(id) from public.company_backups where company_id = p_company and files_at is not null);

  return jsonb_build_object('backupId', v_id, 'companyId', p_company, 'dataAt', v_at, 'dataRows', v_rows, 'dataBytes', v_bytes);
end;
$$;
revoke all on function public.admin_backup_company(integer) from public, anon;
grant execute on function public.admin_backup_company(integer) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Estado dos backups, para a página: um item por empresa que já tem backup.
--    Dados = fotografia mais recente; ficheiros = última cópia dos ficheiros.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_backup_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'companyId', d.company_id,
      'dataAt', d.created_at,
      'dataRows', d.rows_count,
      'dataBytes', d.data_bytes,
      'dataCount', d.n,
      'filesAt', f.files_at,
      'filesCount', f.files_count,
      'filesCopied', f.files_copied,
      'filesBytes', f.files_bytes
    ) order by d.company_id)
    from (
      select distinct on (company_id) company_id, created_at, rows_count, data_bytes,
             count(*) over (partition by company_id) as n
        from public.company_backups
       order by company_id, id desc
    ) d
    left join (
      select distinct on (company_id) company_id, files_at, files_count, files_copied, files_bytes
        from public.company_backups
       where files_at is not null
       order by company_id, id desc
    ) f on f.company_id = d.company_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_backup_status() from public, anon;
grant execute on function public.admin_backup_status() to authenticated, service_role;
