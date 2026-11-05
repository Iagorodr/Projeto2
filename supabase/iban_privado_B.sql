-- Servix — IBAN só para a gerência (PARTE B: correr DEPOIS de a versão nova estar no ar).
--
-- A versão nova já lê e grava o IBAN em staff_private. Esta parte limpa as
-- cópias que ficaram visíveis à equipa. Seguro de repetir.

-- 1. Volta a copiar (caso alguém tenha alterado um IBAN entre a parte A e o deploy).
insert into public.staff_private (staff_id, company_id, iban)
select s.id, s.company_id, btrim(s.iban)
from public.staff s
where coalesce(btrim(s.iban), '') <> ''
on conflict (staff_id) do update
  set iban = coalesce(public.staff_private.iban, excluded.iban), updated_at = now();

-- 2. Apaga o IBAN da tabela que a equipa lê, e impede que volte a ser gravado lá
--    (ex.: um telemóvel com a versão antiga ainda aberta).
update public.staff set iban = null where iban is not null;

create or replace function private.staff_no_iban()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.iban := null;
  return new;
end;
$$;
drop trigger if exists staff_no_iban_trigger on public.staff;
create trigger staff_no_iban_trigger before insert or update on public.staff
  for each row execute function private.staff_no_iban();

-- 3. Remove o IBAN dos períodos já fechados (Histórico), que também são lidos
--    pela equipa. O Histórico não mostra o IBAN; nada se perde na app.
update public.app_data a
set closed_periods = (
  select coalesce(jsonb_agg(
    case when jsonb_typeof(p -> 'staffSummaries') = 'array'
      then jsonb_set(p, '{staffSummaries}', (select coalesce(jsonb_agg(s - 'iban'), '[]'::jsonb) from jsonb_array_elements(p -> 'staffSummaries') s))
      else p end
  ), '[]'::jsonb)
  from jsonb_array_elements(a.closed_periods) p
)
where jsonb_typeof(a.closed_periods) = 'array';

-- Verificação (tudo a 0, menos a última coluna):
select
  (select count(*) from public.staff where iban is not null) as iban_em_staff,
  (select count(*) from public.app_data a, jsonb_array_elements(case when jsonb_typeof(a.closed_periods) = 'array' then a.closed_periods else '[]' end) p,
          jsonb_array_elements(case when jsonb_typeof(p -> 'staffSummaries') = 'array' then p -> 'staffSummaries' else '[]' end) s
    where s ? 'iban') as iban_no_historico,
  (select count(*) from public.staff_private where coalesce(btrim(iban), '') <> '') as iban_protegidos;
