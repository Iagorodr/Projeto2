-- Coberturas de férias (troca temporária de quem faz um cliente).
--
-- Nova lista `covers` em app_data: [{ id, clientId, fromStaffId, toStaffId,
-- from, to, createdAt }]. Só a gerência grava (funcionários só leem, como em
-- `closed_periods`). A agenda semanal NÃO é alterada: a cobertura vale só
-- entre `from` e `to`, por isso a volta é automática.
--
-- Aplicar nos DOIS projetos (teste e produção) ANTES de publicar a versão do
-- app que lê a coluna. Idempotente.

alter table public.app_data
  add column if not exists covers jsonb not null default '[]'::jsonb;

create or replace function public.patch_app_list(
  slice text,
  upserts jsonb,
  removed jsonb,
  prepend boolean default false,
  p_company integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid integer;
  cur jsonb;
  res jsonb;
  ups jsonb;
  rem jsonb;
  me bigint;
  me_txt text;
  my_role text;
begin
  if slice not in ('missing_items', 'sent_items', 'closed_periods', 'personal_notes', 'absences', 'covers') then
    raise exception 'patch_app_list: fatia desconhecida %', slice;
  end if;
  if auth.role() is distinct from 'authenticated' and not private.is_privileged() then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  cid := case when private.is_privileged() then p_company else private.my_company_id() end;
  if cid is null then
    raise exception 'sem empresa associada' using errcode = '42501';
  end if;
  if not private.is_privileged() and private.company_state(cid) not in ('active', 'grace') then
    raise exception 'assinatura da empresa indisponível' using errcode = '42501';
  end if;

  -- Bloqueia a linha até ao fim: gravações simultâneas ficam em fila.
  execute format('select %I from public.app_data where id = $1 for update', slice) into cur using cid;
  if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  ups := case when jsonb_typeof(upserts) = 'array' then upserts else '[]'::jsonb end;
  rem := case when jsonb_typeof(removed) = 'array' then removed else '[]'::jsonb end;

  if not private.is_manager() then
    me := private.my_staff_id();
    if me is null or slice in ('closed_periods', 'covers') then
      raise exception 'sem permissão para alterar %', slice using errcode = '42501';
    end if;
    me_txt := me::text;
    my_role := private.my_staff_role();

    if slice = 'missing_items' then
      select coalesce(jsonb_agg(((u.e - 'seenByManagement') ||
               jsonb_build_object('staffId', me, 'resolved', false, 'response', '')) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and u.e ->> 'staffId' = me_txt
         and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id');
      rem := '[]'::jsonb;

    elsif slice = 'sent_items' then
      select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb)
        into ups
        from (
          -- itens novos: só supervisor, sempre em nome dele
          select ((u.e - 'seenByManagement' - 'read') ||
                  jsonb_build_object('sentBy', 'supervisor', 'sentByStaffId', me)) as e, u.ord
            from jsonb_array_elements(ups) with ordinality as u(e, ord)
           where my_role = 'supervisor'
             and u.e ->> 'id' is not null
             and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id')
          union all
          -- itens existentes dirigidos a ele: só o "lido"
          select (c.e || jsonb_build_object('read', u.e -> 'read')) as e, u.ord
            from jsonb_array_elements(ups) with ordinality as u(e, ord)
            join jsonb_array_elements(cur) as c(e) on c.e ->> 'id' = u.e ->> 'id'
           where c.e ->> 'staffId' = me_txt
             and u.e ? 'read'
        ) x;
      rem := '[]'::jsonb;

    elsif slice = 'personal_notes' then
      select coalesce(jsonb_agg((u.e || jsonb_build_object('ownerId', me)) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and (
           not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id')
           or exists (select 1 from jsonb_array_elements(cur) c
                       where c ->> 'id' = u.e ->> 'id' and c ->> 'ownerId' = me_txt)
         );
      select coalesce(jsonb_agg(r.id), '[]'::jsonb)
        into rem
        from jsonb_array_elements_text(rem) as r(id)
       where exists (select 1 from jsonb_array_elements(cur) c
                      where c ->> 'id' = r.id and c ->> 'ownerId' = me_txt);

    elsif slice = 'absences' then
      select coalesce(jsonb_agg(((u.e - 'handled') ||
               jsonb_build_object('staffId', me, 'handled', false)) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and u.e ->> 'staffId' = me_txt
         and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id');
      select coalesce(jsonb_agg(r.id), '[]'::jsonb)
        into rem
        from jsonb_array_elements_text(rem) as r(id)
       where exists (select 1 from jsonb_array_elements(cur) c
                      where c ->> 'id' = r.id and c ->> 'staffId' = me_txt);
    end if;
  end if;

  with
    ups_t as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(ups) with ordinality as t(e, ord)
    ),
    rem_t as (
      select value as id from jsonb_array_elements_text(rem)
    ),
    curr as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(cur) with ordinality as t(e, ord)
    ),
    kept as (
      select coalesce(u.e, c.e) as e, c.ord::bigint as ord
      from curr c
      left join lateral (
        select ups_t.e from ups_t where ups_t.id = c.id order by ups_t.ord desc limit 1
      ) u on c.id is not null
      where c.id is null or c.id not in (select id from rem_t)
    ),
    added as (
      select distinct on (u.id)
        u.e,
        case when prepend then -1000000000::bigint + u.ord else 1000000000::bigint + u.ord end as ord
      from ups_t u
      where u.id is not null
        and u.id not in (select id from rem_t)
        and not exists (select 1 from curr c where c.id = u.id)
      order by u.id, u.ord desc
    )
  select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb)
    into res
    from (select e, ord from kept union all select e, ord from added) x;

  execute format('update public.app_data set %I = $1 where id = $2', slice) using res, cid;
end;
$$;

revoke all on function public.patch_app_list(text, jsonb, jsonb, boolean, integer) from public, anon;
grant execute on function public.patch_app_list(text, jsonb, jsonb, boolean, integer) to authenticated, service_role;
