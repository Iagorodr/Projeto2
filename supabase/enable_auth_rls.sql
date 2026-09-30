-- Servix — 2ª etapa do banco de dados: liga o RLS (Row Level Security) agora
-- que existe login real (Supabase Auth). Sem isto, qualquer pessoa com a
-- chave pública (anon) do projeto conseguiria ler/gravar os dados sem
-- precisar de login nenhum — o que era aceitável só enquanto o login era de
-- demonstração.
--
-- IMPORTANTE — ordem de execução (não rode isto primeiro):
--   1. Rode supabase/schema.sql (se ainda não rodou).
--   2. Abra o app, defina uma senha de verdade para a empresa (Definições) e
--      para cada funcionário que vai ter login (Acessos).
--   3. Rode `node scripts/setup-auth.mjs` para criar as contas reais no
--      Supabase Auth a partir dessas senhas.
--   4. só então rode este ficheiro (SQL Editor → New query → cole tudo → Run).
-- Se rodar este ficheiro antes do passo 3, ninguém consegue mais entrar nem
-- ler dados pelo app até criar pelo menos uma conta de autenticação.

alter table clients enable row level security;
alter table staff enable row level security;
alter table company_settings enable row level security;
alter table app_data enable row level security;

-- Uma política única e simples: qualquer conta autenticada (gerência ou
-- qualquer funcionário) tem acesso total às 4 tabelas — não há separação por
-- empresa/utilizador porque esta é uma app de empresa única. Quem não fez
-- login (papel "anon") não acessa nada.
drop policy if exists "authenticated_full_access" on clients;
create policy "authenticated_full_access" on clients for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on staff;
create policy "authenticated_full_access" on staff for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on company_settings;
create policy "authenticated_full_access" on company_settings for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on app_data;
create policy "authenticated_full_access" on app_data for all to authenticated using (true) with check (true);