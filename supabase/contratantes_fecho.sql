-- FECHO DO MÊS POR CONTRATANTE (valores congelados, relatório, documentos, faturado/recebido).
-- Só ADITIVO: cria uma tabela nova e acrescenta uma pasta ao cofre; não altera nem apaga dados.
--
-- Corre uma vez no SQL Editor, DEPOIS de contratantes.sql e ANTES de publicar a versão do app
-- que usa isto. Pode ser repetido sem problema (idempotente).
--
-- Uma linha = um mês (período 21→20) de um contratante que foi fechado:
--   hours, rate, receivable, staff_cost, by_client ... os valores CONGELADOS no fecho: depois de
--                  fechado, mudar o valor/hora do contratante ou as horas não os recalcula.
--   status ........ 'closed' (fechado) ou 'reopened' (reaberto; volta a calcular-se na hora)
--   pending ....... se fechou com pendências: { note, items[] } — a justificativa é obrigatória
--   history ....... registo de quem/quando/porquê: fechou, reabriu (com motivo), faturou, recebeu
--   docs .......... ficheiros anexados a este mês (ficam no cofre, pasta docs-contractors)
--   invoiced_on / received_on ... quando foi faturado / recebido (estados do Dashboard)
--
-- Quem vê: SÓ a gerência da própria empresa (valores confidenciais), como em `contractors`.

create table if not exists public.contractor_periods (
  id bigint primary key,
  company_id integer not null references public.companies (id) on delete cascade,
  -- sem apagar em cascata: um contratante com meses fechados não se elimina (o app avisa).
  -- (NO ACTION, não RESTRICT: apagar a EMPRESA inteira continua a funcionar, porque os dois
  -- lados saem na mesma operação.)
  contractor_id bigint not null references public.contractors (id) on delete no action,
  period_start date,
  period_end date not null,
  period_label text,
  status text not null default 'closed' check (status in ('closed', 'reopened')),
  hours numeric not null default 0,
  rate numeric,
  receivable numeric,
  staff_cost numeric not null default 0,
  by_client jsonb not null default '[]'::jsonb,
  pending jsonb,
  docs jsonb not null default '[]'::jsonb,
  invoiced_on date,
  received_on date,
  closed_at timestamptz,
  history jsonb not null default '[]'::jsonb
);

create index if not exists contractor_periods_company_idx on public.contractor_periods (company_id);
-- Um registo por contratante e período.
create unique index if not exists contractor_periods_unique_key
  on public.contractor_periods (company_id, contractor_id, period_end);

drop trigger if exists contractor_periods_set_company_id_trigger on public.contractor_periods;
create trigger contractor_periods_set_company_id_trigger before insert on public.contractor_periods
  for each row execute function private.set_company_id();
drop trigger if exists contractor_periods_keep_company_id_trigger on public.contractor_periods;
create trigger contractor_periods_keep_company_id_trigger before update on public.contractor_periods
  for each row execute function private.keep_company_id();

grant select, insert, update, delete on public.contractor_periods to authenticated;
alter table public.contractor_periods enable row level security;
drop policy if exists contractor_periods_select_manager on public.contractor_periods;
drop policy if exists contractor_periods_insert_manager on public.contractor_periods;
drop policy if exists contractor_periods_update_manager on public.contractor_periods;
drop policy if exists contractor_periods_delete_manager on public.contractor_periods;

create policy contractor_periods_select_manager on public.contractor_periods for select to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractor_periods_insert_manager on public.contractor_periods for insert to authenticated
  with check (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractor_periods_update_manager on public.contractor_periods for update to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()))
  with check (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));
create policy contractor_periods_delete_manager on public.contractor_periods for delete to authenticated
  using (company_id = (select private.my_company_id()) and (select private.company_ok()) and (select private.is_manager()));

-- ─────────────────────────────────────────────────────────────────────────
-- Cofre: nova pasta <empresa>/docs-contractors/ (só a gerência da própria empresa).
-- É a mesma função de armazenamento.sql, com a pasta nova na lista da gerência.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function private.can_access_file(p_name text, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  cid integer;
begin
  if p_name is null or p_mode not in ('read', 'write', 'delete') then
    return false;
  end if;
  cid := private.my_company_id();
  if cid is null or not private.company_ok() then
    return false;
  end if;
  parts := storage.foldername(p_name);
  -- primeira pasta = a empresa de quem pede (nunca outra)
  if parts[1] is distinct from cid::text then
    return false;
  end if;
  -- gerência: tudo da própria empresa
  if private.is_manager() then
    return array_length(parts, 1) >= 2 and parts[2] in ('receipts', 'avisos', 'docs-clients', 'docs-staff', 'docs-contractors');
  end if;
  -- funcionário / supervisor
  if parts[2] = 'receipts' then
    return parts[3] is not null and parts[3] = private.my_staff_id()::text;
  elsif parts[2] = 'avisos' then
    return p_mode = 'read' or (p_mode = 'write' and private.my_staff_role() = 'supervisor');
  end if;
  return false;
end;
$$;

grant execute on function private.can_access_file(text, text) to authenticated;
