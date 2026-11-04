-- Servix — redesign B1: cor do app por papel (funcionários e supervisores).
--
-- Só ADITIVO e seguro de repetir. Correr no SQL Editor ANTES de publicar a
-- versão que tem "Cor do app da equipa" em Definições → Cor e aparência.
--
-- employee_theme / supervisor_theme: um dos temas (verde, ciano, indigo,
-- violeta, fucsia, lima) ou NULL = igual à cor da empresa (por defeito).
-- A leitura já está coberta pela política company_settings_select (toda a
-- equipa da empresa lê) e a gravação pela company_settings_update_manager
-- (só a gerência grava). Nada muda nas políticas.

alter table public.company_settings add column if not exists employee_theme text;
alter table public.company_settings add column if not exists supervisor_theme text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.company_settings'::regclass and conname = 'company_settings_employee_theme_ok') then
    alter table public.company_settings
      add constraint company_settings_employee_theme_ok
      check (employee_theme is null or employee_theme in ('verde', 'ciano', 'indigo', 'violeta', 'fucsia', 'lima'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.company_settings'::regclass and conname = 'company_settings_supervisor_theme_ok') then
    alter table public.company_settings
      add constraint company_settings_supervisor_theme_ok
      check (supervisor_theme is null or supervisor_theme in ('verde', 'ciano', 'indigo', 'violeta', 'fucsia', 'lima'));
  end if;
end $$;

-- Verificação (deve devolver as 2 colunas):
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'company_settings'
  and column_name in ('employee_theme', 'supervisor_theme');
