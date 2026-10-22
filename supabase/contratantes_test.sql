-- Teste de contratantes.sql — SÓ para o projeto de TESTE / Postgres local.
-- Tudo corre dentro de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE"). Precisa de contratantes.sql já aplicado.
do $$
declare
  r text := '';
  n int;
  m1 text := 'dono@c1.test';
  g1 text := 'gerente@c1.test';
  fa text := 'fa@c1.test';
  m2 text := 'dono@c2.test';
  m3 text := 'dono@c3.test'; -- assinatura vencida
  c1 int; c2 int; c3 int;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
    insert into public.companies (code, name) values ('t-a', 'A') returning id into c1;
    insert into public.companies (code, name) values ('t-b', 'B') returning id into c2;
    insert into public.companies (code, name, valid_until) values ('t-c', 'C', current_date - 60) returning id into c3;
    insert into public.company_settings (id, email) values (c1, m1), (c2, m2), (c3, m3);
    insert into public.staff (id, name, email, role, company_id) values
      (901, 'Gerente', g1, 'gerencia', c1), (903, 'FA', fa, 'funcionario', c1);
    -- dados "de confiança" (outra empresa e empresa vencida)
    insert into public.contractors (id, company_id, name, rate) values (1, c2, 'Alheio', 30), (2, c3, 'Vencida', 30);

    -- ===== gerência da empresa 1 (conta da empresa) =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000001"}', m1), true);
    set local role authenticated;
    begin insert into public.contractors (id, company_id, name, rate, staff_rate, billing_day, payment_days) values (10, c1, 'XLG', 20, 15, 28, 30);
      r := r || E'OK   gerência cria contratante\n';
    exception when others then r := r || E'FALHOU gerência não cria contratante: ' || sqlerrm || E'\n'; end;
    -- pedir outra empresa não resulta: o gatilho força a da própria conta (igual a clients)
    begin insert into public.contractors (id, company_id, name) values (11, c2, 'Invasor');
      select count(*) into n from public.contractors where id = 11 and company_id = c1;
      r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência não consegue criar em OUTRA empresa (fica na sua): ' || n || E'\n';
      delete from public.contractors where id = 11;
    exception when others then r := r || E'OK   gerência não cria em outra empresa (recusado)\n'; end;
    begin insert into public.contractors (id, company_id, name) values (12, c1, ' xlg '); r := r || E'FALHOU nome repetido aceite\n';
    exception when unique_violation then r := r || E'OK   nome repetido (sem maiúsculas/espaços) recusado\n'; when others then r := r || E'FALHOU erro inesperado: ' || sqlerrm || E'\n'; end;
    select count(*) into n from public.contractors;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência lê só a sua empresa (1): ' || n || E'\n';
    update public.contractors set rate = 21 where id = 10; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência atualiza o seu: ' || n || E'\n';
    update public.contractors set rate = 1 where id = 1; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'gerência não altera de outra empresa: ' || n || E'\n';
    update public.contractors set company_id = c2 where id = 10; get diagnostics n = row_count;
    reset role;
    select count(*) into n from public.contractors where id = 10 and company_id = c1;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'company_id não muda por update: ' || n || E'\n';

    -- ===== gerência por role em staff =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000002"}', g1), true);
    set local role authenticated;
    select count(*) into n from public.contractors;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerente (role) lê: ' || n || E'\n';
    reset role;

    -- ===== funcionário =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000003"}', fa), true);
    set local role authenticated;
    select count(*) into n from public.contractors;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário NÃO lê contratantes: ' || n || E'\n';
    begin insert into public.contractors (id, company_id, name) values (20, c1, 'F'); r := r || E'FALHOU funcionário criou contratante\n';
    exception when others then r := r || E'OK   funcionário não cria\n'; end;
    update public.contractors set rate = 0 where id = 10; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não altera: ' || n || E'\n';
    delete from public.contractors where id = 10; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não apaga: ' || n || E'\n';
    reset role;

    -- ===== empresa 3 (assinatura vencida) =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000004"}', m3), true);
    set local role authenticated;
    select count(*) into n from public.contractors;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'empresa vencida não lê: ' || n || E'\n';
    begin insert into public.contractors (id, company_id, name) values (30, c3, 'V'); r := r || E'FALHOU empresa vencida criou\n';
    exception when others then r := r || E'OK   empresa vencida não cria\n'; end;
    reset role;

    -- ===== gerência apaga o seu =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000001"}', m1), true);
    set local role authenticated;
    delete from public.contractors where id = 10; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência apaga o seu: ' || n || E'\n';
    reset role;

    -- ===== apagar a empresa leva os contratantes (ON DELETE CASCADE) =====
    perform set_config('request.jwt.claims', '', true);
    delete from public.contractors where company_id = c1;
    delete from public.staff where company_id = c1;
    delete from public.company_settings where id = c2;
    delete from public.companies where id = c2; get diagnostics n = row_count;
    select count(*) into n from public.contractors where id = 1;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'apagar a empresa apaga os seus contratantes: ' || n || E'\n';
  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
