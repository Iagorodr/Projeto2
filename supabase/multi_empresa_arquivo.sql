-- Servix — arquivar, restaurar e excluir empresas (página /admin).
--
-- ESTADO: validado num Postgres local (multi_empresa_arquivo_test.sql: 38 OK); aplicação no TESTE em curso (2026-10-15). Produção: ainda NÃO aplicado.
--
-- PRÉ-REQUISITO: `multi_empresa.sql`, `multi_empresa_funcoes.sql` e
-- `multi_empresa_admin.sql` já aplicados. Seguro rodar mais de uma vez.
--
-- COMO FUNCIONA (as três etapas são sempre manuais, em /admin)
--   1. Suspensa  → "Excluir"  : a empresa vai para as ARQUIVADAS (lixeira). Nada
--      é apagado: os dados ficam guardados e a empresa continua sem acesso.
--   2. Arquivada → "Restaurar": volta à lista normal (continua suspensa; depois
--      é só "Reativar").
--   3. Arquivada → "Excluir definitivamente": apaga TUDO da empresa — clientes,
--      funcionários, definições, dados do app, avisos push E os logins (contas do
--      Supabase Auth) da gerência e dos funcionários. Não tem volta. A página
--      pede para digitar o código da empresa; o servidor confere de novo.
--   * A empresa 1 (a primeira: L & A em produção) nunca pode ser arquivada nem
--     excluída (`protected_company`).
--   * Uma empresa arquivada não aceita alterações (nem reativar, renovar,
--     renomear): restaure primeiro (erro `archived`).
--   * Logins que sejam de uma conta de administração, ou que também apareçam em
--     OUTRA empresa, nunca são apagados.
--
-- Erros (mensagem fixa, a página traduz): not_found, protected_company,
-- not_suspended, not_archived, confirm_mismatch, archived, sem permissão.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Coluna e regras da tabela
-- ─────────────────────────────────────────────────────────────────────────
alter table public.companies add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.companies'::regclass and conname = 'companies_archive_ok') then
    -- arquivada ⇒ suspensa, e a empresa 1 nunca é arquivada
    alter table public.companies
      add constraint companies_archive_ok
      check (archived_at is null or (suspended and id <> 1));
  end if;
end $$;

-- Uma empresa arquivada não muda (só se pode restaurá-la: archived_at → null).
create or replace function private.companies_guard_archived()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived_at is not null and new.archived_at is not null then
    raise exception 'archived';
  end if;
  return new;
end;
$$;
revoke all on function private.companies_guard_archived() from public, anon, authenticated;

drop trigger if exists companies_guard_archived_trigger on public.companies;
create trigger companies_guard_archived_trigger before update on public.companies
  for each row execute function private.companies_guard_archived();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. A lista passa a trazer `archivedAt` (igual ao que está em multi_empresa_admin.sql;
--    `to_jsonb(c) -> 'archived_at'` funciona também antes de a coluna existir)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function private.admin_company_json(cid integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'code', c.code,
    'name', c.name,
    'validUntil', c.valid_until,
    'suspended', c.suspended,
    'timezone', c.timezone,
    'notes', c.notes,
    'createdAt', c.created_at,
    'archivedAt', to_jsonb(c) -> 'archived_at',
    'state', private.company_state(c.id),
    'daysLeft', case when c.valid_until is null then null
                     else c.valid_until - (now() at time zone c.timezone)::date end,
    'managerEmail', cs.email,
    'staffCount', (select count(*) from public.staff s where s.company_id = c.id),
    'clientsCount', (select count(*) from public.clients k where k.company_id = c.id)
  )
  from public.companies c
  left join public.company_settings cs on cs.id = c.id
  where c.id = cid;
$$;
revoke all on function private.admin_company_json(integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Arquivar / restaurar / excluir definitivamente
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_archive_company(p_id integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.companies;
begin
  perform private.admin_guard();
  select * into c from public.companies where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.id = 1 then raise exception 'protected_company'; end if;
  if c.archived_at is not null then
    return private.admin_company_json(p_id);          -- já arquivada
  end if;
  if not c.suspended then raise exception 'not_suspended'; end if;
  update public.companies set archived_at = now() where id = p_id;
  return private.admin_company_json(p_id);
end;
$$;

create or replace function public.admin_restore_company(p_id integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.companies;
begin
  perform private.admin_guard();
  select * into c from public.companies where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.archived_at is null then raise exception 'not_archived'; end if;
  update public.companies set archived_at = null where id = p_id;
  return private.admin_company_json(p_id);             -- continua suspensa
end;
$$;

-- Apaga TUDO da empresa (e os logins). Só uma empresa já arquivada, e só com o
-- código dela digitado de novo. Sem volta.
create or replace function public.admin_delete_company(p_id integer, p_confirm_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v_emails text[];
  n_auth integer := 0;
  n_clients integer := 0;
  n_staff integer := 0;
begin
  perform private.admin_guard();
  select * into c from public.companies where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.id = 1 then raise exception 'protected_company'; end if;
  if c.archived_at is null then raise exception 'not_archived'; end if;
  if lower(btrim(coalesce(p_confirm_code, ''))) <> c.code then
    raise exception 'confirm_mismatch';
  end if;

  -- Logins desta empresa (gerência + funcionários), menos qualquer conta de
  -- administração e menos e-mails que também existam noutra empresa.
  select coalesce(array_agg(distinct q.e), '{}'::text[]) into v_emails
    from (
      select lower(btrim(s.email)) as e from public.staff s where s.company_id = p_id
      union
      select lower(btrim(cs.email)) as e from public.company_settings cs where cs.id = p_id
    ) q
   where q.e is not null and q.e <> ''
     and not exists (select 1 from public.platform_admins a where a.email = q.e)
     and not exists (select 1 from public.staff s2
                      where s2.company_id <> p_id and lower(btrim(s2.email)) = q.e)
     and not exists (select 1 from public.company_settings c2
                      where c2.id <> p_id and lower(btrim(c2.email)) = q.e);

  if cardinality(v_emails) > 0 then
    delete from auth.users where lower(btrim(email)) = any (v_emails);
    get diagnostics n_auth = row_count;
  end if;

  delete from public.push_subscriptions where company_id = p_id;
  delete from public.clients where company_id = p_id;
  get diagnostics n_clients = row_count;
  delete from public.staff where company_id = p_id;
  get diagnostics n_staff = row_count;
  delete from public.app_data where id = p_id;
  delete from public.company_settings where id = p_id;
  delete from public.companies where id = p_id;

  return jsonb_build_object(
    'deleted', true, 'id', p_id, 'code', c.code, 'name', c.name,
    'clients', n_clients, 'staff', n_staff, 'logins', n_auth);
end;
$$;

revoke all on function public.admin_archive_company(integer) from public, anon;
revoke all on function public.admin_restore_company(integer) from public, anon;
revoke all on function public.admin_delete_company(integer, text) from public, anon;
grant execute on function public.admin_archive_company(integer) to authenticated, service_role;
grant execute on function public.admin_restore_company(integer) to authenticated, service_role;
grant execute on function public.admin_delete_company(integer, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (remove só o arquivo/lixeira; as empresas ficam como estão):
--   drop function if exists public.admin_delete_company(integer, text);
--   drop function if exists public.admin_restore_company(integer);
--   drop function if exists public.admin_archive_company(integer);
--   drop trigger if exists companies_guard_archived_trigger on public.companies;
--   drop function if exists private.companies_guard_archived();
--   alter table public.companies drop constraint if exists companies_archive_ok;
--   alter table public.companies drop column if exists archived_at;
-- ─────────────────────────────────────────────────────────────────────────
