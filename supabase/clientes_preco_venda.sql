-- PREÇO DE VENDA POR CLIENTE (só para contratantes "Diretos").
-- Só ADITIVO: acrescenta uma coluna opcional à tabela `clients`; não altera nem apaga dados.
-- Corre uma vez no SQL Editor ANTES de publicar a versão do app que usa isto. Pode repetir-se.
--
-- sell_price = o que a empresa cobra por hora a este cliente (€/h). Os contratantes normais têm um
-- valor/hora único (na ficha do contratante); os "Diretos" (clientes sem contratante) têm um preço
-- por cliente. Fica vazio (null) enquanto não for definido.

alter table public.clients add column if not exists sell_price numeric;
