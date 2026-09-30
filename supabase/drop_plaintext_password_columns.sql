-- Servix — passo 4 (último) da Etapa 0b, achado de segurança 4.10/4.11:
-- remove as colunas de senha em texto puro que já não têm nenhum uso no
-- app. O login real acontece inteiramente via Supabase Auth
-- (signInWithPassword) e a gestão de senha via a Edge Function
-- update-staff-password; estas colunas só guardavam texto simples sem
-- nenhum efeito no login, e tanto a UI que as editava (Acessos,
-- Definições) quanto o código que as lia/gravava (dbMappers.js) já foram
-- removidos.
--
-- PRÉ-REQUISITOS (confirmar todos antes de rodar):
--   1. Backup exportado de `staff` e `company_settings` (CSV via SQL Editor) — feito.
--   2. Edge Function update-staff-password já testada e funcionando — feito.
--   3. Trigger RLS de staff (rls_staff_role_guard.sql) já aplicado e testado — feito.
--   4. UI de Acessos/Definições já ligada à Edge Function e testada — feito.
--   5. dbMappers.js já não envia/lê mais o campo `password` nos saves de
--      staff/company_settings — corrigido nesta mesma leva de mudanças.
--      IMPORTANTE: o ponto 5 precisa estar em produção (deploy feito e
--      confirmado) ANTES de rodar este SQL. Se rodar este SQL com a
--      versão antiga do app ainda no ar, todo save de funcionário ou de
--      Definições passa a dar erro ("column password does not exist").
--
-- Isto é uma mudança de schema IRREVERSÍVEL — os dados nessas colunas
-- somem de vez (por isso o backup do pré-requisito 1).

alter table staff drop column if exists password;
alter table company_settings drop column if exists password;
