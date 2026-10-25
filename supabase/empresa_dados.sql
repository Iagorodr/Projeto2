-- DADOS DA EMPRESA (Definições): morada, nº de empresa/IVA, IBAN e telefone, para o cabeçalho dos PDF.
-- Só ADITIVO: acrescenta 4 colunas de texto vazias a `company_settings`; não altera nem apaga nada.
--
-- Corre uma vez no SQL Editor, ANTES de publicar a versão do app que usa isto.
-- Pode ser repetido sem problema (idempotente).

alter table public.company_settings add column if not exists address text;
alter table public.company_settings add column if not exists vat_number text;
alter table public.company_settings add column if not exists iban text;
alter table public.company_settings add column if not exists phone text;
