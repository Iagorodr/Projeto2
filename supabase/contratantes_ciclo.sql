-- CONTRATANTES: ciclo de faturação PRÓPRIO de cada contratante (opcional).
-- Só ADITIVO: acrescenta 4 colunas vazias à tabela `contractors`; não altera nem apaga nada.
--
-- Corre uma vez no SQL Editor, ANTES de publicar a versão do app que usa isto.
-- Pode ser repetido sem problema (idempotente).
--
--   period_start_day / period_end_day ... dia do mês em que o ciclo começa e acaba
--                                         (ex.: 1 e 31; ou 21 e 20 = do dia 21 ao dia 20 do mês seguinte)
--   period_months ....................... de quantos em quantos meses se fatura (1 = todos os meses, 2 = de 2 em 2…)
--   period_anchor ....................... data de início de um ciclo (só preciso quando period_months > 1)
-- Vazio = o contratante segue o período geral da empresa (21 a 20), como até agora.

alter table public.contractors add column if not exists period_start_day integer;
alter table public.contractors add column if not exists period_end_day integer;
alter table public.contractors add column if not exists period_months integer;
alter table public.contractors add column if not exists period_anchor date;
