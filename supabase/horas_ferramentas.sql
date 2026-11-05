-- Servix — FERRAMENTAS DAS HORAS (instalar uma vez; servem para sempre)
--
-- Corre este ficheiro UMA vez no SQL Editor (é seguro repetir). Não muda
-- nenhuma hora: só instala o histórico e quatro comandos para usar quando
-- for preciso (ver horas_usar.sql).
--
--  1. HISTÓRICO  — cada vez que alguém grava horas, fica guardado o ANTES e o
--                  DEPOIS de cada funcionário alterado, quem gravou e quando.
--                  Responde a "de onde veio esta marcação?" e permite repor
--                  valores antigos. Guarda 180 dias.
--  2. horas_ver(empresa, de, até, [cliente], [funcionário])
--                — lista as linhas (para conferir antes de mexer).
--  3. horas_fixar(empresa, de, até, [cliente], [funcionário])
--                — deixa as horas ATUAIS fixas (nenhum cálculo automático as
--                  volta a mudar). Não muda números.
--  4. horas_definir(empresa, funcionário, dia, cliente, horas)
--                — põe uma linha num valor certo e deixa-a fixa.
--  5. horas_rasto(empresa, funcionário, dia, [cliente])
--                — mostra no histórico todas as gravações que mexeram nesse dia.
--
-- Cliente e funcionário podem ser o NOME (ex.: 'ACTE 3', 'Iago') ou o id.
-- As funções ficam no esquema `private` (a app/API não as vê; só o SQL Editor).

create schema if not exists private;

-- ───────────────────────────────────────────────────────────────────────
-- 1. Histórico das gravações de horas
-- ───────────────────────────────────────────────────────────────────────
create table if not exists private.horas_historico (
  id          bigserial primary key,
  company_id  integer not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid,            -- conta que gravou (null = SQL Editor)
  antes       jsonb not null,  -- só os funcionários que mudaram
  depois      jsonb not null
);
create index if not exists horas_historico_idx on private.horas_historico (company_id, changed_at desc);
revoke all on private.horas_historico from public, anon, authenticated;

create or replace function private.log_horas_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
begin
  if new.horas_data is not distinct from old.horas_data then
    return new;
  end if;
  select coalesce(jsonb_object_agg(k, coalesce(old.horas_data -> k, 'null'::jsonb)), '{}'::jsonb),
         coalesce(jsonb_object_agg(k, coalesce(new.horas_data -> k, 'null'::jsonb)), '{}'::jsonb)
    into v_antes, v_depois
    from (
      select k from jsonb_object_keys(coalesce(old.horas_data, '{}'::jsonb)) k
      union
      select k from jsonb_object_keys(coalesce(new.horas_data, '{}'::jsonb)) k
    ) keys
   where (old.horas_data -> k) is distinct from (new.horas_data -> k);

  if v_antes <> '{}'::jsonb or v_depois <> '{}'::jsonb then
    insert into private.horas_historico (company_id, changed_by, antes, depois)
    values (new.id, auth.uid(), v_antes, v_depois);
  end if;
  -- Limpeza de vez em quando (≈1 em cada 50 gravações): mais de 180 dias sai.
  if random() < 0.02 then
    delete from private.horas_historico where changed_at < now() - interval '180 days';
  end if;
  return new;
exception when others then
  return new;  -- o histórico nunca pode impedir uma gravação
end;
$$;

drop trigger if exists app_data_horas_historico on public.app_data;
create trigger app_data_horas_historico
  after update of horas_data on public.app_data
  for each row execute function private.log_horas_change();

-- ───────────────────────────────────────────────────────────────────────
-- Auxiliares: nome ou id → ids
-- ───────────────────────────────────────────────────────────────────────
create or replace function private.horas_staff_ids(p_company integer, p_staff text)
returns text[] language sql stable set search_path = public as $$
  select case when p_staff is null then null else
    array(select s.id::text from public.staff s
           where s.company_id = p_company
             and (s.id::text = trim(p_staff) or lower(trim(s.name)) = lower(trim(p_staff))))
  end;
$$;

create or replace function private.horas_client_ids(p_company integer, p_client text)
returns text[] language sql stable set search_path = public as $$
  select case when p_client is null then null else
    array(select c.id::text from public.clients c
           where c.company_id = p_company
             and (c.id::text = trim(p_client) or lower(trim(c.name)) = lower(trim(p_client))))
  end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 2. Ver linhas
-- ───────────────────────────────────────────────────────────────────────
create or replace function private.horas_ver(
  p_company integer, p_de date, p_ate date, p_cliente text default null, p_funcionario text default null)
returns table (funcionario text, dia text, cliente text, horas numeric, extra_min numeric,
               fixa numeric, anulada boolean, pela_gerencia boolean, staff_id text, client_id text)
language sql stable set search_path = public, private as $$
  with f as (select private.horas_staff_ids(p_company, p_funcionario) s,
                    private.horas_client_ids(p_company, p_cliente) c)
  select coalesce(st.name, k.key), x.e ->> 'date',
         coalesce(cl.name, x.e ->> 'clientName', x.e ->> 'custom', x.e ->> 'clientId'),
         (x.e ->> 'hours')::numeric, coalesce((x.e ->> 'extraMinutes')::numeric, 0),
         (x.e ->> 'manualBase')::numeric,
         coalesce((x.e ->> 'voided')::boolean, false), coalesce((x.e ->> 'byManagement')::boolean, false),
         k.key, x.e ->> 'clientId'
    from f, public.app_data a
    cross join lateral jsonb_each(coalesce(a.horas_data, '{}'::jsonb)) k
    cross join lateral jsonb_array_elements(coalesce(k.value -> 'entries', '[]'::jsonb)) x(e)
    left join public.staff st on st.id::text = k.key
    left join public.clients cl on cl.id::text = (x.e ->> 'clientId')
   where a.id = p_company
     and (x.e ->> 'date') between p_de::text and p_ate::text
     and (f.s is null or k.key = any(f.s))
     and (f.c is null or (x.e ->> 'clientId') = any(f.c))
   order by 2, 1, 3;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 3. Fixar as horas atuais (não muda números)
-- ───────────────────────────────────────────────────────────────────────
create or replace function private.horas_fixar(
  p_company integer, p_de date, p_ate date, p_cliente text default null, p_funcionario text default null)
returns integer
language plpgsql set search_path = public, private as $$
declare
  v_s text[] := private.horas_staff_ids(p_company, p_funcionario);
  v_c text[] := private.horas_client_ids(p_company, p_cliente);
  v_n integer;
begin
  if p_funcionario is not null and cardinality(v_s) = 0 then raise exception 'Funcionário "%" não encontrado', p_funcionario; end if;
  if p_cliente is not null and cardinality(v_c) = 0 then raise exception 'Cliente "%" não encontrado', p_cliente; end if;

  select count(*) into v_n
    from public.app_data a, jsonb_each(coalesce(a.horas_data, '{}'::jsonb)) k,
         jsonb_array_elements(coalesce(k.value -> 'entries', '[]'::jsonb)) x(e)
   where a.id = p_company
     and (x.e ->> 'date') between p_de::text and p_ate::text
     and (v_s is null or k.key = any(v_s))
     and (v_c is null or (x.e ->> 'clientId') = any(v_c))
     and coalesce((x.e ->> 'voided')::boolean, false) = false
     and not (x.e ? 'manualBase')
     and (x.e ->> 'hours') is not null;

  update public.app_data a
     set horas_data = (
       select jsonb_object_agg(k.key,
         case when jsonb_typeof(k.value -> 'entries') = 'array'
               and (v_s is null or k.key = any(v_s)) then
           jsonb_set(k.value, '{entries}', coalesce((
             select jsonb_agg(
               case when (x.e ->> 'date') between p_de::text and p_ate::text
                      and (v_c is null or (x.e ->> 'clientId') = any(v_c))
                      and coalesce((x.e ->> 'voided')::boolean, false) = false
                      and not (x.e ? 'manualBase')
                      and (x.e ->> 'hours') is not null
                 then x.e || jsonb_build_object('manualBase',
                        trim_scale(round(greatest(0, (x.e ->> 'hours')::numeric - coalesce((x.e ->> 'extraMinutes')::numeric, 0) / 60), 4)))
                 else x.e end
               order by x.ord)
             from jsonb_array_elements(k.value -> 'entries') with ordinality x(e, ord)
           ), '[]'::jsonb))
         else k.value end)
       from jsonb_each(a.horas_data) k)
   where a.id = p_company and jsonb_typeof(a.horas_data) = 'object' and v_n > 0;

  return v_n;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 4. Definir as horas de uma linha (e deixá-la fixa)
--    p_horas = horas da visita SEM as extra (as extra aprovadas somam-se por cima).
-- ───────────────────────────────────────────────────────────────────────
create or replace function private.horas_definir(
  p_company integer, p_funcionario text, p_dia date, p_cliente text, p_horas numeric)
returns integer
language plpgsql set search_path = public, private as $$
declare
  v_s text[] := private.horas_staff_ids(p_company, p_funcionario);
  v_c text[] := private.horas_client_ids(p_company, p_cliente);
  v_n integer;
begin
  if cardinality(v_s) <> 1 then raise exception 'Funcionário "%": % correspondências (use o id)', p_funcionario, cardinality(v_s); end if;
  if cardinality(v_c) = 0 then raise exception 'Cliente "%" não encontrado', p_cliente; end if;
  if p_horas is null or p_horas < 0 or p_horas > 24 then raise exception 'Horas inválidas: %', p_horas; end if;

  select count(*) into v_n
    from public.app_data a, jsonb_array_elements(coalesce(a.horas_data -> v_s[1] -> 'entries', '[]'::jsonb)) x(e)
   where a.id = p_company and (x.e ->> 'date') = p_dia::text
     and (x.e ->> 'clientId') = any(v_c) and coalesce((x.e ->> 'voided')::boolean, false) = false;
  if v_n = 0 then raise exception 'Não há linha ativa de % em % para %', p_funcionario, p_dia, p_cliente; end if;
  if v_n > 1 then raise exception 'Há % linhas ativas de % em % para % — corrija na app', v_n, p_funcionario, p_dia, p_cliente; end if;

  update public.app_data a
     set horas_data = jsonb_set(a.horas_data, array[v_s[1], 'entries'], (
       select jsonb_agg(
         case when (x.e ->> 'date') = p_dia::text and (x.e ->> 'clientId') = any(v_c)
                and coalesce((x.e ->> 'voided')::boolean, false) = false
           then (x.e - 'shareReview' - 'needsReview')
                || jsonb_build_object('manualBase', trim_scale(p_horas),
                                      'hours', trim_scale(round(p_horas + coalesce((x.e ->> 'extraMinutes')::numeric, 0) / 60, 4)))
           else x.e end
         order by x.ord)
       from jsonb_array_elements(a.horas_data -> v_s[1] -> 'entries') with ordinality x(e, ord)))
   where a.id = p_company;
  return v_n;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 5. Rasto: que gravações mexeram num funcionário/dia (só a partir de hoje,
--    quando o histórico passou a existir)
-- ───────────────────────────────────────────────────────────────────────
create or replace function private.horas_rasto(
  p_company integer, p_funcionario text, p_dia date, p_cliente text default null)
returns table (quando timestamptz, quem text, antes jsonb, depois jsonb)
language sql stable set search_path = public, private, auth as $$
  with f as (select private.horas_staff_ids(p_company, p_funcionario) s,
                    private.horas_client_ids(p_company, p_cliente) c)
  select h.changed_at,
         coalesce((select st.name from public.staff st join auth.users u on lower(u.email) = lower(st.email)
                    where u.id = h.changed_by and st.company_id = p_company limit 1),
                  (select u.email from auth.users u where u.id = h.changed_by),
                  'SQL Editor'),
         (select jsonb_agg(e) from jsonb_array_elements(coalesce(h.antes -> sid -> 'entries', '[]'::jsonb)) e
           where e ->> 'date' = p_dia::text and (f.c is null or e ->> 'clientId' = any(f.c))),
         (select jsonb_agg(e) from jsonb_array_elements(coalesce(h.depois -> sid -> 'entries', '[]'::jsonb)) e
           where e ->> 'date' = p_dia::text and (f.c is null or e ->> 'clientId' = any(f.c)))
    from f, unnest(f.s) sid, private.horas_historico h
   where h.company_id = p_company and (h.antes ? sid or h.depois ? sid)
     and (select jsonb_agg(e) from jsonb_array_elements(coalesce(h.antes -> sid -> 'entries', '[]'::jsonb)) e
           where e ->> 'date' = p_dia::text and (f.c is null or e ->> 'clientId' = any(f.c)))
         is distinct from
         (select jsonb_agg(e) from jsonb_array_elements(coalesce(h.depois -> sid -> 'entries', '[]'::jsonb)) e
           where e ->> 'date' = p_dia::text and (f.c is null or e ->> 'clientId' = any(f.c)))
   order by h.changed_at;
$$;

revoke all on function private.horas_ver(integer, date, date, text, text) from public, anon, authenticated;
revoke all on function private.horas_fixar(integer, date, date, text, text) from public, anon, authenticated;
revoke all on function private.horas_definir(integer, text, date, text, numeric) from public, anon, authenticated;
revoke all on function private.horas_rasto(integer, text, date, text) from public, anon, authenticated;

-- Confirmação
select 'ferramentas instaladas' as estado,
       (select count(*) from pg_trigger where tgname = 'app_data_horas_historico') as historico_ativo;
