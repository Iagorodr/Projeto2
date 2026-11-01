-- Servix — redesign B1: cor da empresa + preferências por utilizador.
--
-- Só ADITIVO e seguro de repetir. Correr no SQL Editor ANTES de publicar a
-- versão B1 (a página Definições grava a coluna `theme`).
--
-- 1. company_settings.theme — a cor da empresa (verde, ciano, indigo, violeta,
--    fucsia, lima). Sem valor = verde.
-- 2. user_prefs — preferências de cada pessoa (ex.: ordem e blocos ocultos do
--    Dashboard). Só lidas/gravadas pelas funções my_prefs / set_my_prefs, sempre
--    da própria pessoa na sua empresa.

alter table public.company_settings add column if not exists theme text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.company_settings'::regclass and conname = 'company_settings_theme_ok') then
    alter table public.company_settings
      add constraint company_settings_theme_ok
      check (theme is null or theme in ('verde', 'ciano', 'indigo', 'violeta', 'fucsia', 'lima'));
  end if;
end $$;

create table if not exists public.user_prefs (
  company_id integer not null references public.companies(id) on delete cascade,
  email      text not null,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (company_id, email)
);
alter table public.user_prefs enable row level security;
revoke all on public.user_prefs from anon, authenticated;

create or replace function public.my_prefs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select prefs from public.user_prefs
                    where company_id = private.my_company_id() and email = private.auth_email()), '{}'::jsonb);
$$;
revoke all on function public.my_prefs() from public, anon;
grant execute on function public.my_prefs() to authenticated;

-- Junta as chaves enviadas às que já existem (não apaga as outras).
create or replace function public.set_my_prefs(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid integer := private.my_company_id();
  mail text := nullif(private.auth_email(), '');
  out jsonb;
begin
  if cid is null or mail is null then
    raise exception 'sem empresa associada' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 20000 then
    raise exception 'invalid_prefs';
  end if;
  insert into public.user_prefs (company_id, email, prefs)
  values (cid, mail, p_patch)
  on conflict (company_id, email) do update
    set prefs = public.user_prefs.prefs || excluded.prefs, updated_at = now()
  returning prefs into out;
  return out;
end;
$$;
revoke all on function public.set_my_prefs(jsonb) from public, anon;
grant execute on function public.set_my_prefs(jsonb) to authenticated;
