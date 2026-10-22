-- CONTRATANTES (quem paga à empresa pelas horas feitas nos clientes).
-- Só ADITIVO: cria uma tabela nova; não altera nem apaga nada que já existe.
--
-- Corre uma vez no SQL Editor, ANTES de publicar a versão do app que usa isto.
-- Pode ser repetido sem problema (idempotente).
--
-- Cada contratante guarda:
--   rate .......... valor/hora que ele paga à empresa (igual para todos os seus clientes;
--                   vazio nos "clientes diretos", que têm preço próprio por cliente)
--   staff_rate .... valor/hora padrão pago ao funcionário; pré-preenche o cliente novo
--                   (cada cliente pode depois ter o seu valor, em clients.value_hour)
--   billing_day ... dia do mês em que se fatura; payment_days ... prazo de pagamento
-- Os clientes ligam-se ao contratante pelo NOME (clients.origin), como já era a "origem".
--
-- Quem vê: SÓ a gerência da própria empresa (os valores são confidenciais:
-- funcionários e supervisores não leem esta tabela).

create table if not exists public.contractors (
  id bigint primary key,
  company_id integer not null references public.companies (id) on delete cascade,
  name text not null,
  color text,
  is_direct boolean not null default false,
  rate numeric,
  staff_rate numeric,
  billing_day integer,
  payment_days integer,
  contact_name text,
  email text,
  note text
);

create index if not exists contractors_company_idx on public.contractors (company_id);
-- Um nome por empresa (sem distinguir maiúsculas), porque os clientes apontam pelo nome.
create unique index if not exists contractors_company_name_key
  on public.contractors (company_id, lower(btrim(name)));

drop trigger if exists contractors_set_company_id_trigger on public.contractors;
create trigger contractors_set_company_id_trigger before insert on public.contractors
  for each row execute function private.set_company_id();
drop trigger if exists contractors_keep_company_id_trigger on public.contractors;
create trigger contractors_keep_company_id_trigger before update on public.contractors
  for each row execute function private.keep_company_id();

grant select, insert, update, delete on public.contractors to authenticated;
alter table public.contractors enable row level security;
drop policy if exists contractors_select_manager on public.contractors;
drop policy if exists contractors_insert_manager on public.contractors;
drop policy if exists contractors_update_manager on public.contractors;
drop policy if exists contractors_delete_manager on public.contractors;

create policy contractors_select_manager on public.contractors for select to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractors_insert_manager on public.contractors for insert to authenticated
  with check (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractors_update_manager on public.contractors for update to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()))
  with check (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractors_delete_manager on public.contractors for delete to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
