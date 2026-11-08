-- Servix — empresa de testes do banco passa a ter o código "teste-interno".
--
-- O código "teste" (e "demo") passou a abrir a DEMONSTRAÇÃO no browser (dados
-- gerados para hoje, nada gravado). A empresa de testes real (id 2, EMPRESATESTE)
-- continua com todos os dados e contas; só muda o código que se escreve no ecrã
-- "Qual é a sua empresa?". Seguro de repetir.

update public.companies
   set code = 'teste-interno'
 where id = 2 and code = 'teste';

-- Verificação: deve mostrar 2 | teste-interno | EMPRESATESTE
select id, code, name from public.companies order by id;
