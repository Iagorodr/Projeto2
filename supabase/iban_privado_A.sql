-- Servix — IBAN só para a gerência (PARTE A: correr ANTES de publicar a versão nova).
--
-- Hoje o IBAN vive em `staff`, que toda a equipa lê (nomes, duplas): qualquer
-- funcionário consegue ver o IBAN dos colegas pela API. Passa para
-- `staff_private` (criada em fichas_planning_nif.sql), que só a gerência lê.
--
-- Esta parte só ACRESCENTA: copia os IBAN atuais para staff_private. A app
-- antiga continua a funcionar. Seguro de repetir.

alter table public.staff_private add column if not exists iban text;

-- Copia os IBAN que existem em `staff` (sem apagar nada lá ainda).
insert into public.staff_private (staff_id, company_id, iban)
select s.id, s.company_id, btrim(s.iban)
from public.staff s
where coalesce(btrim(s.iban), '') <> ''
on conflict (staff_id) do update
  set iban = coalesce(public.staff_private.iban, excluded.iban), updated_at = now();

-- O backup do /admin passa a incluir staff_private (NIF e IBAN).
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
    'version', 2,
    'company_id', p_company,
    'company',          (select to_jsonb(c) from public.companies c where c.id = p_company),
    'company_settings', (select to_jsonb(s) from public.company_settings s where s.id = p_company),
    'app_data',         (select to_jsonb(a) from public.app_data a where a.id = p_company),
    'clients',          coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.clients x where x.company_id = p_company), '[]'::jsonb),
    'staff',            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.staff x where x.company_id = p_company), '[]'::jsonb),
    'staff_private',    coalesce((select jsonb_agg(to_jsonb(x) order by x.staff_id) from public.staff_private x where x.company_id = p_company), '[]'::jsonb),
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

-- Verificação: IBAN em staff vs. já copiados para staff_private (devem ser iguais).
select
  (select count(*) from public.staff where coalesce(btrim(iban), '') <> '') as iban_em_staff,
  (select count(*) from public.staff_private where coalesce(btrim(iban), '') <> '') as iban_em_staff_private;
