-- Sufixo de email dos funcionários (ex.: empresax.be), configurável em Definições.
alter table company_settings add column if not exists email_domain text default '';
