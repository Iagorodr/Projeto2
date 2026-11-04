-- Servix — fichas B1: foto do planning do cliente + NIF do funcionário.
--
-- Só ADITIVO e seguro de repetir. Correr no SQL Editor ANTES de publicar.
--
-- 1. clients.planning_photo — referência do ficheiro no cofre (servix-files),
--    no mesmo formato dos documentos ({ path, name, type, size }).
-- 2. staff_private — dados pessoais/fiscais do funcionário que SÓ a gerência
--    pode ler. Fica numa tabela à parte de propósito: a tabela `staff` é lida
--    por toda a equipa (nomes, duplas), por isso um NIF lá ficaria visível a
--    qualquer funcionário através da API. Aqui só a gerência lê e grava.

alter table public.clients add column if not exists planning_photo jsonb;

create table if not exists public.staff_private (
  staff_id   bigint primary key references public.staff(id) on delete cascade,
  company_id integer not null references public.companies(id) on delete cascade,
  nif        text,
  updated_at timestamptz not null default now()
);

-- company_id é posto/guardado pelo servidor, como em clients e staff.
drop trigger if exists staff_private_set_company_id_trigger on public.staff_private;
create trigger staff_private_set_company_id_trigger before insert on public.staff_private
  for each row execute function private.set_company_id();
drop trigger if exists staff_private_keep_company_id_trigger on public.staff_private;
create trigger staff_private_keep_company_id_trigger before update on public.staff_private
  for each row execute function private.keep_company_id();

alter table public.staff_private enable row level security;
revoke all on public.staff_private from anon;
grant select, insert, update, delete on public.staff_private to authenticated;

drop policy if exists staff_private_manager on public.staff_private;
create policy staff_private_manager on public.staff_private
  for all to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()))
  with check (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));

-- Verificação (deve devolver 2 linhas):
select 'clients.planning_photo' as item, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'planning_photo') as ok
union all
select 'staff_private (RLS)', (select relrowsecurity from pg_class where oid = 'public.staff_private'::regclass);
