-- Servix — esquema Supabase (Postgres)
-- Execute este ficheiro UMA VEZ no SQL Editor do seu projeto Supabase
-- (https://app.supabase.com → o seu projeto → SQL Editor → New query → cole tudo → Run).

-- Clientes da empresa (donos dos locais limpos / atendidos)
create table if not exists clients (
  id bigint primary key,
  name text not null,
  type text,
  city text,
  address text,
  contact text,
  contract_start text,
  contract_end text,
  hours_month numeric,
  value_hour numeric,
  frequency text,
  frequency_anchor text, -- bancos já existentes: alter table clients add column if not exists frequency_anchor text;
  availability text,
  duration integer,
  days integer[],
  description text,
  priorities text,
  note text,
  client_type text,
  client_valid_until text,
  origin text
);

-- Funcionários e supervisores
create table if not exists staff (
  id bigint primary key,
  name text not null,
  email text,
  contact text,
  password text,
  account_type text,
  status text,
  valid_until text,
  iban text,
  role text,
  can_view_all_clients boolean not null default false,
  partner_id bigint
);
-- Bancos já existentes: alter table staff add column if not exists partner_id bigint;

-- Definições da empresa — uma única linha (id = 1)
create table if not exists company_settings (
  id integer primary key default 1,
  name text,
  email text,
  password text,
  photo_url text,
  cutoff_day integer default 20,
  contract_alert_days integer default 30,
  reclamacao_base_clients integer default 10,
  reclamacao_excelente_count integer default 1,
  reclamacao_razoavel_count integer default 3,
  constraint company_settings_singleton check (id = 1)
);

-- Restante estado do app (atribuições, horas, avisos, histórico fechado) —
-- guardado como JSON, numa única linha (id = 1). Estas estruturas já são
-- profundamente aninhadas no app; replicá-las como JSON evita uma
-- normalização relacional que não traria benefício real nesta fase.
create table if not exists app_data (
  id integer primary key default 1,
  assignments jsonb not null default '{}'::jsonb,
  horas_data jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  sent_items jsonb not null default '[]'::jsonb,
  closed_periods jsonb not null default '[]'::jsonb,
  personal_notes jsonb not null default '[]'::jsonb,
  constraint app_data_singleton check (id = 1)
);

create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  owner_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- As linhas únicas têm de existir antes do app começar a gravar (ele usa
-- update(), que não cria a linha — só a atualiza se ela já existir).
insert into company_settings (id, name, email, password)
values (1, 'Empresa X', 'empresax@login1.gmail.com', '')
on conflict (id) do nothing;

insert into app_data (id) values (1) on conflict (id) do nothing;

-- RLS desligado por agora: o login continua a ser só de demonstração (não
-- há autenticação real ligada ao Supabase ainda). Quando implementarem
-- login real, ativem RLS aqui e criem políticas por utilizador/empresa
-- antes de expor a app publicamente.
alter table clients disable row level security;
alter table staff disable row level security;
alter table company_settings disable row level security;
alter table app_data disable row level security;
alter table push_subscriptions disable row level security;
