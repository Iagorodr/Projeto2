-- Servix — gravação das restantes fatias de `app_data` só com o que mudou.
--
-- Complementa `patch_horas_data.sql`. Antes, pedidos, avisos, períodos fechados,
-- notas, ausências e atribuições eram gravados como JSON inteiro: quem gravava
-- por último apagava o que outro dispositivo tinha feito entretanto. Estas duas
-- funções aplicam apenas a DIFERENÇA, de forma atómica (a linha fica bloqueada
-- durante a operação, por isso duas gravações nunca se pisam).
--
--  * patch_app_list(slice, upserts, removed, prepend)
--      listas de objetos com `id` (missing_items, sent_items, closed_periods,
--      personal_notes, absences): substitui os itens com o mesmo id, apaga os
--      ids em `removed` e coloca os itens novos à frente (prepend) ou no fim.
--  * patch_assignments(upserts, removed)
--      mapa chave -> lista: junta as chaves em `upserts` e apaga as de `removed`.
--
-- Rode UMA VEZ em cada projeto Supabase. É seguro rodar mais de uma vez.
-- Enquanto não for rodado, o app continua a funcionar como antes (grava a
-- fatia inteira) — só não ganha a proteção.

create or replace function public.patch_app_list(
  slice text,
  upserts jsonb,
  removed jsonb,
  prepend boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur jsonb;
  res jsonb;
begin
  if slice not in ('missing_items', 'sent_items', 'closed_periods', 'personal_notes', 'absences') then
    raise exception 'patch_app_list: fatia desconhecida %', slice;
  end if;

  -- Bloqueia a linha até ao fim: gravações simultâneas ficam em fila.
  execute format('select %I from public.app_data where id = 1 for update', slice) into cur;
  if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  upserts := coalesce(upserts, '[]'::jsonb);
  removed := coalesce(removed, '[]'::jsonb);

  with
    ups as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(upserts) with ordinality as t(e, ord)
    ),
    rem as (
      select value as id from jsonb_array_elements_text(removed)
    ),
    curr as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(cur) with ordinality as t(e, ord)
    ),
    kept as (
      select coalesce(u.e, c.e) as e, c.ord::bigint as ord
      from curr c
      left join lateral (
        select ups.e from ups where ups.id = c.id order by ups.ord desc limit 1
      ) u on c.id is not null
      where c.id is null or c.id not in (select id from rem)
    ),
    added as (
      select distinct on (u.id)
        u.e,
        case when prepend then -1000000000::bigint + u.ord else 1000000000::bigint + u.ord end as ord
      from ups u
      where u.id is not null
        and u.id not in (select id from rem)
        and not exists (select 1 from curr c where c.id = u.id)
      order by u.id, u.ord desc
    )
  select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb)
    into res
    from (select e, ord from kept union all select e, ord from added) x;

  execute format('update public.app_data set %I = $1 where id = 1', slice) using res;
end;
$$;

create or replace function public.patch_assignments(upserts jsonb, removed jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.app_data
     set assignments =
       (coalesce(assignments, '{}'::jsonb) || coalesce(upserts, '{}'::jsonb))
       - coalesce(array(select jsonb_array_elements_text(coalesce(removed, '[]'::jsonb))), '{}'::text[])
   where id = 1;
$$;

revoke all on function public.patch_app_list(text, jsonb, jsonb, boolean) from public;
revoke all on function public.patch_app_list(text, jsonb, jsonb, boolean) from anon;
grant execute on function public.patch_app_list(text, jsonb, jsonb, boolean) to authenticated, service_role;

revoke all on function public.patch_assignments(jsonb, jsonb) from public;
revoke all on function public.patch_assignments(jsonb, jsonb) from anon;
grant execute on function public.patch_assignments(jsonb, jsonb) to authenticated, service_role;
