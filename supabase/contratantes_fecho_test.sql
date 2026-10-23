-- Teste de contratantes_fecho.sql — SÓ para o projeto de TESTE / Postgres local.
-- Tudo corre dentro de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE"). Precisa de contratantes.sql e contratantes_fecho.sql já aplicados.
do $$
declare
  r text := '';
  n int;
  m1 text := 'dono@c1.test';
  g1 text := 'gerente@c1.test';
  fa text := 'fa@c1.test';
  m2 text := 'dono@c2.test';
  c1 int; c2 int;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
    insert into public.companies (code, name) values ('t-a', 'A') returning id into c1;
    insert into public.companies (code, name) values ('t-b', 'B') returning id into c2;
    insert into public.company_settings (id, email) values (c1, m1), (c2, m2);
    insert into public.staff (id, name, email, role, company_id) values
      (901, 'Gerente', g1, 'gerencia', c1), (903, 'FA', fa, 'funcionario', c1);
    insert into public.contractors (id, company_id, name, rate) values (1, c2, 'Alheio', 30), (10, c1, 'XLG', 20);
    insert into public.contractor_periods (id, company_id, contractor_id, period_end, hours) values (500, c2, 1, '2026-09-20', 5);

    -- ===== gerência da empresa 1 =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000001"}', m1), true);
    set local role authenticated;
    begin
      insert into public.contractor_periods (id, company_id, contractor_id, period_start, period_end, period_label, hours, rate, receivable, staff_cost, by_client, closed_at)
      values (100, c1, 10, '2026-08-21', '2026-09-20', '21 Ago - 20 Set', 100, 20, 2000, 1500, '[{"clientId":1,"name":"A","hours":100}]', now());
      r := r || E'OK   gerência fecha um mês (cria)\n';
    exception when others then r := r || E'FALHOU gerência não cria: ' || sqlerrm || E'\n'; end;
    begin
      insert into public.contractor_periods (id, company_id, contractor_id, period_end, hours) values (101, c1, 10, '2026-09-20', 1);
      r := r || E'FALHOU mês repetido aceite\n';
    exception when unique_violation then r := r || E'OK   o mesmo contratante+período só fecha uma vez\n'; when others then r := r || E'FALHOU erro inesperado: ' || sqlerrm || E'\n'; end;
    begin
      insert into public.contractor_periods (id, company_id, contractor_id, period_end, status) values (102, c1, 10, '2026-10-20', 'xyz');
      r := r || E'FALHOU estado inválido aceite\n';
    exception when check_violation then r := r || E'OK   estado inválido recusado\n'; when others then r := r || E'FALHOU erro inesperado: ' || sqlerrm || E'\n'; end;
    begin
      insert into public.contractor_periods (id, company_id, contractor_id, period_end, hours) values (103, c2, 10, '2026-07-20', 1);
      select count(*) into n from public.contractor_periods where id = 103 and company_id = c1;
      r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'pedir outra empresa fica na sua: ' || n || E'\n';
      delete from public.contractor_periods where id = 103;
    exception when others then r := r || E'OK   outra empresa recusada\n'; end;
    select count(*) into n from public.contractor_periods;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência lê só os seus (1): ' || n || E'\n';
    update public.contractor_periods set status = 'reopened', history = '[{"event":"reopened","reason":"erro"}]' where id = 100; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência reabre (atualiza): ' || n || E'\n';
    update public.contractor_periods set invoiced_on = '2026-09-28', received_on = '2026-10-28' where id = 100; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência marca faturado/recebido: ' || n || E'\n';
    update public.contractor_periods set hours = 1 where id = 500; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'não altera de outra empresa: ' || n || E'\n';
    begin delete from public.contractors where id = 10; r := r || E'FALHOU apagou contratante com meses fechados\n';
    exception when foreign_key_violation then r := r || E'OK   contratante com meses fechados não se apaga\n'; when others then r := r || E'FALHOU erro inesperado: ' || sqlerrm || E'\n'; end;
    -- cofre
    begin
      r := r || case when private.can_access_file(c1 || '/docs-contractors/10/a.pdf', 'write') then 'OK   ' else 'FALHOU ' end || E'gerência escreve em docs-contractors\n';
      r := r || case when private.can_access_file(c1 || '/docs-contractors/10/a.pdf', 'read') then 'OK   ' else 'FALHOU ' end || E'gerência lê em docs-contractors\n';
      r := r || case when not private.can_access_file(c2 || '/docs-contractors/10/a.pdf', 'read') then 'OK   ' else 'FALHOU ' end || E'gerência não lê docs-contractors de outra empresa\n';
      r := r || case when private.can_access_file(c1 || '/docs-clients/x.pdf', 'read') then 'OK   ' else 'FALHOU ' end || E'pastas antigas continuam a funcionar\n';
    end;
    reset role;

    -- ===== gerência por role em staff =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000002"}', g1), true);
    set local role authenticated;
    select count(*) into n from public.contractor_periods;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerente (role) lê: ' || n || E'\n';
    reset role;

    -- ===== funcionário =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000003"}', fa), true);
    set local role authenticated;
    select count(*) into n from public.contractor_periods;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário NÃO lê os meses fechados: ' || n || E'\n';
    begin insert into public.contractor_periods (id, company_id, contractor_id, period_end) values (110, c1, 10, '2026-06-20'); r := r || E'FALHOU funcionário criou\n';
    exception when others then r := r || E'OK   funcionário não cria\n'; end;
    update public.contractor_periods set hours = 0 where id = 100; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não altera: ' || n || E'\n';
    delete from public.contractor_periods where id = 100; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não apaga: ' || n || E'\n';
    r := r || case when not private.can_access_file(c1 || '/docs-contractors/10/a.pdf', 'read') then 'OK   ' else 'FALHOU ' end || E'funcionário não acede a docs-contractors\n';
    reset role;

    -- ===== apagar a empresa leva tudo (contratantes e meses fechados) =====
    perform set_config('request.jwt.claims', '', true);
    delete from public.staff where company_id = c1;
    delete from public.company_settings where id = c1;
    delete from public.companies where id = c1; get diagnostics n = row_count;
    select count(*) into n from public.contractor_periods where company_id = c1;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'apagar a empresa apaga os meses fechados e os contratantes: ' || n || E'\n';
  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
