-- Servix — administração da plataforma (várias empresas): criar, renovar,
-- suspender e consultar empresas. Alimenta a página /admin do app.
--
-- ESTADO: validado num Postgres local e aplicado no projeto de TESTE em 2026-10-14
-- (multi_empresa_admin_test.sql: 55 OK). Aplicado na produção (L & A) em 2026-10-15.
--
-- PRÉ-REQUISITO: `multi_empresa.sql` já aplicado. Seguro rodar mais de uma vez.
--
-- COMO FUNCIONA
--   * `platform_admins`: os e-mails de quem administra a plataforma (você). Só
--     essas contas passam nas funções abaixo. A conta de administração é uma
--     conta do Supabase Auth SEM empresa (não é gerência nem funcionário de
--     ninguém): crie-a em Authentication → Users → Add user (com "Auto Confirm
--     User") e depois acrescente o e-mail no fim deste ficheiro.
--   * admin_list_companies()          → todas as empresas, com estado e totais.
--   * admin_create_company(...)       → cria empresa + definições + dados vazios.
--   * admin_update_company(id, patch) → renovar (validUntil), suspender, renomear…
--   * admin_can_set_manager_login(e)  → a Edge Function admin-company-login usa-a
--     antes de criar/redefinir a palavra-passe da gerência de uma empresa.
--   * is_platform_admin()             → a página /admin usa-a para saber se a
--     conta que entrou é de administração.
-- Nenhuma destas funções dá acesso aos DADOS das empresas (clientes, horas…):
-- só ao registo (nome, código, validade) e a contagens.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Quem administra
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  email text primary key,
  constraint platform_admins_email_norm check (email = lower(btrim(email)))
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.auth_email() <> ''
     and exists (select 1 from public.platform_admins a where a.email = private.auth_email());
$$;

-- Quem pode chamar as funções de administração: a conta de administração
-- (logada) ou uma chamada de confiança (service_role / SQL Editor).
create or replace function private.admin_guard()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_privileged() then
    return;
  end if;
  if auth.role() is distinct from 'authenticated' or not private.is_platform_admin() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
end;
$$;

-- Uma empresa como JSON (o que a página mostra).
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

revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.admin_guard() from public, anon, authenticated;
revoke all on function private.admin_company_json(integer) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Funções para a página /admin
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'authenticated' and private.is_platform_admin();
$$;

create or replace function public.admin_list_companies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.admin_guard();
  return coalesce(
    (select jsonb_agg(private.admin_company_json(c.id) order by c.id) from public.companies c),
    '[]'::jsonb);
end;
$$;

-- Erros (mensagem fixa, para a página traduzir): invalid_code, invalid_name,
-- invalid_email, invalid_timezone, code_taken, email_taken.
create or replace function public.admin_create_company(
  p_code text,
  p_name text,
  p_manager_email text,
  p_valid_until date default null,
  p_timezone text default 'Europe/Brussels',
  p_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_manager_email, '')));
  v_tz text := coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'Europe/Brussels');
  cid integer;
begin
  perform private.admin_guard();
  if v_code !~ '^[a-z0-9][a-z0-9-]{1,30}$' then raise exception 'invalid_code'; end if;
  if v_name = '' then raise exception 'invalid_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'invalid_timezone';
  end if;

  begin
    insert into public.companies (code, name, valid_until, timezone, notes)
    values (v_code, v_name, p_valid_until, v_tz, nullif(btrim(coalesce(p_notes, '')), ''))
    returning id into cid;
  exception when unique_violation then
    raise exception 'code_taken';
  end;

  begin
    insert into public.company_settings (id, name, email) values (cid, v_name, v_email);
  exception when unique_violation then
    raise exception 'email_taken';   -- desfaz também a empresa criada acima
  end;
  insert into public.app_data (id) values (cid);

  return private.admin_company_json(cid);
end;
$$;

-- `p_patch` só muda o que vier: name, code, validUntil (data ou null = sem
-- prazo), suspended, timezone, notes. Erros: not_found, invalid_*, code_taken.
create or replace function public.admin_update_company(p_id integer, p_patch jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.companies;
  v text;
begin
  perform private.admin_guard();
  select * into c from public.companies where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  p_patch := coalesce(p_patch, '{}'::jsonb);

  if p_patch ? 'name' then
    v := btrim(coalesce(p_patch ->> 'name', ''));
    if v = '' then raise exception 'invalid_name'; end if;
    c.name := v;
  end if;
  if p_patch ? 'code' then
    v := lower(btrim(coalesce(p_patch ->> 'code', '')));
    if v !~ '^[a-z0-9][a-z0-9-]{1,30}$' then raise exception 'invalid_code'; end if;
    c.code := v;
  end if;
  if p_patch ? 'validUntil' then
    begin
      c.valid_until := nullif(btrim(coalesce(p_patch ->> 'validUntil', '')), '')::date;
    exception when others then
      raise exception 'invalid_date';
    end;
  end if;
  if p_patch ? 'suspended' then
    c.suspended := coalesce((p_patch ->> 'suspended')::boolean, false);
  end if;
  if p_patch ? 'timezone' then
    v := btrim(coalesce(p_patch ->> 'timezone', ''));
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = v) then
      raise exception 'invalid_timezone';
    end if;
    c.timezone := v;
  end if;
  if p_patch ? 'notes' then
    c.notes := nullif(btrim(coalesce(p_patch ->> 'notes', '')), '');
  end if;

  begin
    update public.companies
       set code = c.code, name = c.name, valid_until = c.valid_until,
           suspended = c.suspended, timezone = c.timezone, notes = c.notes
     where id = p_id;
  exception when unique_violation then
    raise exception 'code_taken';
  end;
  return private.admin_company_json(p_id);
end;
$$;

-- A Edge Function admin-company-login só mexe na palavra-passe de quem é a
-- conta de gerência de uma empresa (nunca a de um administrador, nem a de um
-- funcionário, nem uma conta sem empresa).
create or replace function public.admin_can_set_manager_login(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.role() is distinct from 'authenticated' or not private.is_platform_admin() then
    return false;
  end if;
  return e <> ''
     and exists (select 1 from public.company_settings c where lower(btrim(c.email)) = e)
     and not exists (select 1 from public.platform_admins a where a.email = e);
end;
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.admin_list_companies() from public, anon;
revoke all on function public.admin_create_company(text, text, text, date, text, text) from public, anon;
revoke all on function public.admin_update_company(integer, jsonb) from public, anon;
revoke all on function public.admin_can_set_manager_login(text) from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.admin_list_companies() to authenticated, service_role;
grant execute on function public.admin_create_company(text, text, text, date, text, text) to authenticated, service_role;
grant execute on function public.admin_update_company(integer, jsonb) to authenticated, service_role;
grant execute on function public.admin_can_set_manager_login(text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. PASSO FINAL — quem administra (troque o e-mail e rode só esta linha)
-- ─────────────────────────────────────────────────────────────────────────
-- insert into public.platform_admins (email) values ('SEU-EMAIL-DE-ADMINISTRADOR') on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (remove só a administração; as empresas ficam como estão):
--   drop function if exists public.admin_can_set_manager_login(text);
--   drop function if exists public.admin_update_company(integer, jsonb);
--   drop function if exists public.admin_create_company(text, text, text, date, text, text);
--   drop function if exists public.admin_list_companies();
--   drop function if exists public.is_platform_admin();
--   drop function if exists private.admin_company_json(integer);
--   drop function if exists private.admin_guard();
--   drop function if exists private.is_platform_admin();
--   drop table if exists public.platform_admins;
-- ─────────────────────────────────────────────────────────────────────────
