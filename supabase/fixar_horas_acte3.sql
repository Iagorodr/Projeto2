-- Servix (L&A) — fixar as horas de ACTE 3 que o Iago corrigiu à mão (4/11).
--
-- Correr DEPOIS de publicar a versão com "horas fixas". Marca as linhas de ACTE 3
-- do período aberto (21/10 a 20/11) como FIXAS (`manualBase`), para que nenhum
-- cálculo automático (um colega a marcar o mesmo dia, as Revisões) as volte a pôr
-- nas 8 horas. Não muda nenhum número: as horas ficam exatamente as atuais.
-- Seguro de repetir. Depois de correr, recarregar a app (F5) no PC da gerência.

update public.app_data a
set horas_data = (
  select jsonb_object_agg(k.key,
    case when jsonb_typeof(k.value -> 'entries') = 'array' then
      jsonb_set(k.value, '{entries}', coalesce((
        select jsonb_agg(
          case when (x.e ->> 'clientId') = '1791901116037'
                 and (x.e ->> 'date') >= '2026-10-21'
                 and coalesce((x.e ->> 'voided')::boolean, false) = false
                 and not (x.e ? 'manualBase')
            then x.e || jsonb_build_object('manualBase', greatest(0, (x.e ->> 'hours')::numeric - coalesce((x.e ->> 'extraMinutes')::numeric, 0) / 60))
            else x.e end
          order by x.ord)
        from jsonb_array_elements(k.value -> 'entries') with ordinality as x(e, ord)
      ), '[]'::jsonb))
    else k.value end)
  from jsonb_each(a.horas_data) k
)
where a.id = 1 and jsonb_typeof(a.horas_data) = 'object';

-- Verificação: linhas de ACTE 3 e se ficaram fixas (manual_base preenchido).
select (select name from public.staff s where s.id::text = k.key) as funcionario,
       x.e ->> 'date' as dia, x.e ->> 'hours' as horas, x.e ->> 'manualBase' as manual_base, x.e ->> 'voided' as anulada
from public.app_data a, jsonb_each(a.horas_data) k, jsonb_array_elements(coalesce(k.value -> 'entries', '[]'::jsonb)) x(e)
where a.id = 1 and (x.e ->> 'clientId') = '1791901116037'
order by 2, 1;
