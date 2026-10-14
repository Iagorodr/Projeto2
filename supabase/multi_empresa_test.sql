-- Teste de multi_empresa.sql — SÓ para o projeto de TESTE (e para um Postgres
-- local). NÃO rode na produção: cria uma empresa "B" fictícia (id 2) dentro de
-- uma transação que é desfeita no fim, mas não deve tocar numa base real.
--
-- Prova que: (1) uma empresa não lê nem escreve na outra (tabelas, funções,
-- notificações, emails repetidos); (2) cada estado de validade — ativa, tolerância,
-- vencida, suspensa, sem prazo — dá o resultado certo; (3) anónimo, desconhecido e
-- service_role se comportam como esperado.
--
-- Resultado esperado: um ERRO "RESULT" com uma linha por verificação. Todas
-- devem começar por "OK"; nenhuma por "FALHOU" nem "ERRO NO TESTE".
-- Usa a empresa 1 existente (email da gerência lido de company_settings).
do $$
declare
  r text := '';
  n int; n2 int;
  v jsonb; b boolean; ok boolean; p text;
  today date;
  rec record;
  mgr_a text; emp_a text := 'tmp-a@test.local';
  emp_b text := 'bob@b.test'; mgr_b text := 'boss@b.test';
  code_a text;
begin
  perform set_config('request.jwt.claims', '', true);
  select lower(btrim(email)) into mgr_a from public.company_settings where id = 1;
  select code into code_a from public.companies where id = 1;
  today := (now() at time zone 'Europe/Brussels')::date;

  begin
  -- ===== preparação (como postgres, sem JWT) =====
  update public.companies set valid_until = null, suspended = false where id = 1;
  insert into public.companies (id, code, name) values (2, 'testb', 'Empresa B');
  insert into public.company_settings (id, name, email) values (2, 'Empresa B', mgr_b);
  insert into public.app_data (id, assignments, horas_data, personal_notes) values (
    2, '{"2999-05-05":[9]}',
    '{"9000002":{"status":"pendente","paid":false,"entries":[],"lockedWeeks":{},"noClientDays":[]}}',
    '[{"id":777,"ownerId":9000002,"text":"nota B","date":"2026-10-01"}]');
  insert into public.staff (id, name, email, role, company_id) values
    (9000001, 'Tmp A', emp_a, 'funcionario', 1),
    (9000002, 'Bob B', emp_b, 'funcionario', 2);
  insert into public.clients (id, name, company_id) values (9000100, 'Cliente B', 2), (9000101, 'Cliente A', 1);
  insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth, company_id)
    values ('9000002', 'https://push/b', 'k', 'a', 2);
  update public.app_data set
    horas_data = coalesce(horas_data, '{}'::jsonb) ||
      '{"9000001":{"status":"pendente","paid":false,"entries":[],"lockedWeeks":{},"noClientDays":[]}}'::jsonb,
    personal_notes = '[]'::jsonb, closed_periods = '[]'::jsonb
  where id = 1;

  -- ===== 1. Funcionário da empresa A =====
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-00000000000a"}', emp_a), true);
  set local role authenticated;
  select count(*) into n from public.clients;
  r := r || case when n > 0 and not exists (select 1 from public.clients where company_id <> 1) then 'OK   ' else 'FALHOU ' end || 'A funcionário: lê só clientes da A (linhas=' || n || E')\n';
  select count(*) into n from public.staff where company_id = 2;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: staff da B visíveis=' || n || E' (0)\n';
  select count(*) into n from public.company_settings where id = 2;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: definições da B visíveis=' || n || E' (0)\n';
  select count(*) into n from public.app_data where id = 2;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: app_data da B visível=' || n || E' (0)\n';
  select count(*) into n from public.push_subscriptions where company_id = 2;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: notificações da B visíveis=' || n || E' (0)\n';
  select count(*) into n from public.clients where id = 9000100;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: cliente da B por id visível=' || n || E' (0)\n';
  update public.staff set role = 'gerencia' where id = 9000001; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A funcionário: promover-se linhas=' || n || E' (0)\n';
  v := public.my_company_status();
  r := r || case when v ->> 'state' = 'active' and (v ->> 'companyId')::int = 1 then 'OK   ' else 'FALHOU ' end || 'A funcionário: my_company_status=' || (v ->> 'state') || E'/empresa ' || (v ->> 'companyId') || E'\n';
  reset role;

  -- ===== 2. Gerência da empresa A (email das definições) =====
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  update public.clients set name = name || 'X' where id = 9000100; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: alterar cliente da B linhas=' || n || E' (0)\n';
  delete from public.clients where id = 9000100; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: apagar cliente da B linhas=' || n || E' (0)\n';
  update public.staff set role = 'gerencia' where id = 9000002; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: promover staff da B linhas=' || n || E' (0)\n';
  update public.company_settings set name = 'hack' where id = 2; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: alterar definições da B linhas=' || n || E' (0)\n';
  update public.app_data set assignments = '{}'::jsonb where id = 2; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: alterar app_data da B linhas=' || n || E' (0)\n';
  delete from public.push_subscriptions where company_id = 2; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'A gerência: apagar notificações da B linhas=' || n || E' (0)\n';
  begin
    insert into public.company_settings (id, name, email) values (3, 'Intrusa', 'intrusa@x.test');
    r := r || E'FALHOU A gerência: criou definições de outra empresa\n';
  exception when others then r := r || 'OK   A gerência: criar definições de outra empresa bloqueado [' || sqlstate || E']\n'; end;
  begin
    insert into public.app_data (id) values (3);
    r := r || E'FALHOU A gerência: criou app_data de outra empresa\n';
  exception when others then r := r || 'OK   A gerência: criar app_data de outra empresa bloqueado [' || sqlstate || E']\n'; end;
  insert into public.clients (id, name, company_id) values (9000103, 'Spoof', 2);
  insert into public.staff (id, name, email, role, company_id) values (9000104, 'Spoof S', 'spoof@a.test', 'funcionario', 2);
  update public.clients set company_id = 2 where id = 9000101;
  reset role;
  select count(*) into n from public.clients where id in (9000103, 9000101) and company_id = 1;
  r := r || case when n = 2 then 'OK   ' else 'FALHOU ' end || 'A gerência: cliente criado/atualizado com company_id=2 ficou na A (' || n || E' de 2)\n';
  select count(*) into n from public.staff where id = 9000104 and company_id = 1;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'A gerência: staff criado com company_id=2 ficou na A (' || n || E' de 1)\n';

  -- emails repetidos entre empresas
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  begin
    insert into public.staff (id, name, email, role) values (9000105, 'Dup', ' Bob@B.test ', 'funcionario');
    r := r || E'FALHOU A gerência: criou staff com email da B\n';
  exception when others then r := r || 'OK   A gerência: staff com email da B bloqueado [' || sqlstate || ': ' || sqlerrm || E']\n'; end;
  begin
    update public.company_settings set email = 'BOSS@b.test' where id = 1;
    r := r || E'FALHOU A gerência: pôs o email da gerência da B\n';
  exception when others then r := r || 'OK   A gerência: email da gerência da B bloqueado [' || sqlstate || E']\n'; end;
  begin
    update public.staff set email = 'tmp-a@test.local' where id = 9000104;
    r := r || E'FALHOU A gerência: dois staff com o mesmo email\n';
  exception when others then r := r || 'OK   A gerência: email repetido dentro da A bloqueado [' || sqlstate || E']\n'; end;

  -- funções de gravação (gerência A só mexe na A)
  perform public.patch_horas_data('{"9000002":{"status":"finalizado","paid":true,"entries":[]}}'::jsonb);
  perform public.patch_assignments('{"2999-01-01":[1]}'::jsonb, '[]'::jsonb);
  perform public.patch_app_list('closed_periods', '[{"id":"zz","x":1}]'::jsonb, '[]'::jsonb, true);
  reset role;
  select (horas_data -> '9000002' ->> 'status') into p from public.app_data where id = 2;
  r := r || case when p = 'pendente' then 'OK   ' else 'FALHOU ' end || 'A gerência: patch_horas_data não tocou nas horas da B (status=' || p || E')\n';
  select (assignments ? '2999-01-01'), (assignments ? '2999-05-05') into b, ok from public.app_data where id = 2;
  r := r || case when not b and ok then 'OK   ' else 'FALHOU ' end || E'A gerência: patch_assignments não tocou na agenda da B\n';
  select (assignments ? '2999-01-01') into b from public.app_data where id = 1;
  r := r || case when b then 'OK   ' else 'FALHOU ' end || E'A gerência: patch_assignments gravou na agenda da A\n';
  select (closed_periods @> '[{"id":"zz"}]'::jsonb) into b from public.app_data where id = 2;
  r := r || case when not b then 'OK   ' else 'FALHOU ' end || E'A gerência: patch_app_list não tocou nos períodos da B\n';
  select (closed_periods @> '[{"id":"zz"}]'::jsonb) into b from public.app_data where id = 1;
  r := r || case when b then 'OK   ' else 'FALHOU ' end || E'A gerência: patch_app_list gravou nos períodos da A\n';

  -- ===== 3. Funcionário da empresa B =====
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000b2"}', emp_b), true);
  set local role authenticated;
  select count(*) into n from public.clients;
  r := r || case when n = 1 and not exists (select 1 from public.clients where company_id <> 2) then 'OK   ' else 'FALHOU ' end || 'B funcionário: lê só os clientes da B (linhas=' || n || E')\n';
  select count(*) into n from public.staff where company_id <> 2;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'B funcionário: staff da A visíveis=' || n || E' (0)\n';
  perform public.patch_horas_data(
    '{"9000001":{"status":"x","entries":[{"date":"2026-10-09","clientId":1,"hours":1}]},"9000002":{"status":"finalizado","paid":true,"entries":[{"date":"2026-10-02","clientId":1,"hours":1}]}}'::jsonb);
  perform public.patch_app_list('personal_notes', '[{"id":888,"ownerId":9000002,"text":"b2","date":"x"}]'::jsonb, '[777]'::jsonb, false);
  reset role;
  select (horas_data -> '9000001' ->> 'status'), jsonb_array_length(horas_data -> '9000001' -> 'entries')
    into p, n from public.app_data where id = 1;
  r := r || case when p = 'pendente' and n = 0 then 'OK   ' else 'FALHOU ' end || 'B funcionário: não alterou as horas de gente da A (status=' || p || ', entradas=' || n || E')\n';
  select (horas_data -> '9000002' ->> 'status'), (horas_data -> '9000002' ->> 'paid'), jsonb_array_length(horas_data -> '9000002' -> 'entries')
    into p, v, n from public.app_data where id = 2;
  r := r || case when p = 'finalizado' and v::text = 'false' and n = 1 then 'OK   ' else 'FALHOU ' end || 'B funcionário: gravou as próprias horas (status=' || p || ', paid=' || v::text || E')\n';
  select (personal_notes @> '[{"id":888}]'::jsonb) and not (personal_notes @> '[{"id":777}]'::jsonb) into b from public.app_data where id = 2;
  r := r || case when b then 'OK   ' else 'FALHOU ' end || E'B funcionário: nota própria criada e antiga apagada na B\n';
  select (personal_notes @> '[{"id":888}]'::jsonb) into b from public.app_data where id = 1;
  r := r || case when not b then 'OK   ' else 'FALHOU ' end || E'B funcionário: nada apareceu nas notas da A\n';

  -- ===== 4. Gerência da empresa B não vê a A =====
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000b1"}', mgr_b), true);
  set local role authenticated;
  update public.clients set name = name || 'Y' where id = 9000101; get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'B gerência: alterar cliente da A linhas=' || n || E' (0)\n';
  update public.clients set name = name || 'Y' where id = 9000100; get diagnostics n = row_count;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'B gerência: alterar cliente da B linhas=' || n || E' (1)\n';
  begin
    update public.company_settings set email = mgr_a where id = 2;
    r := r || E'FALHOU B gerência: ficou com o email da gerência da A\n';
  exception when others then
    r := r || case when sqlstate = '23505' then 'OK   ' else 'FALHOU ' end || 'B gerência: usar o email da gerência da A bloqueado [' || sqlstate || E']\n';
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- ===== 5. Estados da validade (empresa A) =====
  for rec in
    select * from (values
      ('ativa, faltam 3 dias',  3, false, 'active',    3,    null::int, true),
      ('ativa, vence hoje',     0, false, 'active',    0,    null,      true),
      ('tolerância, 1º dia',   -1, false, 'grace',    -1,    7,         true),
      ('tolerância, último dia',-7, false, 'grace',    -7,    1,         true),
      ('vencida (8 dias)',     -8, false, 'expired',   -8,   null,      false),
      ('vencida (60 dias)',   -60, false, 'expired',   -60,  null,      false),
      ('suspensa',             null, true, 'suspended', null, null,     false),
      ('sem prazo',            null, false, 'active',   null, null,     true)
    ) as x(label, d_off, susp, st, dl, gdl, usable)
  loop
    perform set_config('request.jwt.claims', '', true);
    update public.companies
       set valid_until = case when rec.d_off is null then null else today + rec.d_off end,
           suspended = rec.susp
     where id = 1;

    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-00000000000a"}', emp_a), true);
    set local role authenticated;
    v := public.my_company_status();
    select count(*) into n from public.clients;
    ok := true;
    begin perform public.patch_horas_data('{}'::jsonb);
    exception when others then ok := false; end;
    begin perform public.patch_app_list('absences', '[]'::jsonb, '[]'::jsonb, false);
    exception when others then ok := ok and false; end;
    reset role;

    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
    set local role authenticated;
    update public.clients set name = name where id = 9000101; get diagnostics n2 = row_count;
    reset role;

    r := r || case when v ->> 'state' = rec.st then 'OK   ' else 'FALHOU ' end || 'estado [' || rec.label || ']: status=' || (v ->> 'state') || E' (' || rec.st || E')\n';
    r := r || case when (v ->> 'daysLeft')::int is not distinct from rec.dl and (v ->> 'graceDaysLeft')::int is not distinct from rec.gdl then 'OK   ' else 'FALHOU ' end
              || 'estado [' || rec.label || ']: dias=' || coalesce(v ->> 'daysLeft', 'null') || ' tolerância=' || coalesce(v ->> 'graceDaysLeft', 'null') || E'\n';
    r := r || case when (n > 0) = rec.usable then 'OK   ' else 'FALHOU ' end || 'estado [' || rec.label || ']: funcionário lê clientes (linhas=' || n || E')\n';
    r := r || case when ok = rec.usable then 'OK   ' else 'FALHOU ' end || 'estado [' || rec.label || ']: funcionário grava horas/ausências=' || ok || E'\n';
    r := r || case when (n2 = 1) = rec.usable then 'OK   ' else 'FALHOU ' end || 'estado [' || rec.label || ']: gerência grava clientes (linhas=' || n2 || E')\n';
  end loop;

  -- vencida: a empresa B continua a funcionar; o código da A ainda existe
  perform set_config('request.jwt.claims', '', true);
  update public.companies set valid_until = today - 30, suspended = false where id = 1;
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000b2"}', emp_b), true);
  set local role authenticated;
  select count(*) into n from public.clients;
  reset role;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'A vencida: a B continua a ler os seus clientes (linhas=' || n || E')\n';
  perform set_config('request.jwt.claims', '', true);
  update public.companies set valid_until = null, suspended = false where id = 1;

  -- ===== 6. Anónimo =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  r := r || case when (public.company_lookup('testb') ->> 'found') = 'true' then 'OK   ' else 'FALHOU ' end || E'anónimo: company_lookup(testb) encontra\n';
  r := r || case when (public.company_lookup(' TESTB ') ->> 'found') = 'true' then 'OK   ' else 'FALHOU ' end || E'anónimo: company_lookup(" TESTB ") ignora caixa/espaços\n';
  r := r || case when (public.company_lookup('naoexiste') ->> 'found') = 'false' then 'OK   ' else 'FALHOU ' end || E'anónimo: company_lookup(naoexiste) não encontra\n';
  r := r || case when (public.company_lookup(null) ->> 'found') = 'false' then 'OK   ' else 'FALHOU ' end || E'anónimo: company_lookup(null) não encontra\n';
  r := r || case when not (public.company_lookup('testb') ? 'name') then 'OK   ' else 'FALHOU ' end || E'anónimo: company_lookup não revela o nome\n';
  begin
    select count(*) into n from public.companies;
    r := r || E'FALHOU anónimo: leu a tabela companies (' || n || E')\n';
  exception when others then r := r || 'OK   anónimo: ler companies bloqueado [' || sqlstate || E']\n'; end;
  begin
    perform public.my_company_status();
    r := r || E'FALHOU anónimo: my_company_status permitido\n';
  exception when others then r := r || 'OK   anónimo: my_company_status bloqueado [' || sqlstate || E']\n'; end;
  begin
    perform public.patch_horas_data('{}'::jsonb);
    r := r || E'FALHOU anónimo: patch_horas_data permitido\n';
  exception when others then r := r || 'OK   anónimo: patch_horas_data bloqueado [' || sqlstate || E']\n'; end;
  select count(*) into n from public.clients;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'anónimo: lê clientes linhas=' || n || E' (0)\n';
  reset role;

  -- ===== 7. Autenticado sem empresa =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"estranho@x.test","sub":"00000000-0000-0000-0000-0000000000ee"}', true);
  set local role authenticated;
  v := public.my_company_status();
  r := r || case when v ->> 'state' = 'none' then 'OK   ' else 'FALHOU ' end || 'desconhecido: my_company_status=' || (v ->> 'state') || E' (none)\n';
  select count(*) into n from public.clients;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'desconhecido: lê clientes linhas=' || n || E' (0)\n';
  begin
    perform public.patch_horas_data('{}'::jsonb);
    r := r || E'FALHOU desconhecido: patch_horas_data permitido\n';
  exception when others then r := r || 'OK   desconhecido: patch_horas_data bloqueado [' || sqlstate || E']\n'; end;
  begin
    insert into public.clients (id, name) values (9000106, 'Falso');
    r := r || E'FALHOU desconhecido: criou cliente\n';
  exception when others then r := r || 'OK   desconhecido: criar cliente bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  -- ===== 8. service_role (função de lembretes) =====
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  perform public.patch_app_list('personal_notes', '[{"id":999,"ownerId":9000002,"text":"lembrete","date":"x","notified":true}]'::jsonb, '[]'::jsonb, false, 2);
  begin
    perform public.patch_app_list('personal_notes', '[{"id":998,"ownerId":9000002,"text":"x","date":"x"}]'::jsonb, '[]'::jsonb, false);
    r := r || E'FALHOU service_role: patch_app_list sem p_company permitido\n';
  exception when others then r := r || 'OK   service_role: patch_app_list sem p_company bloqueado [' || sqlstate || E']\n'; end;
  select count(*) into n from public.app_data;
  r := r || case when n = 2 then 'OK   ' else 'FALHOU ' end || 'service_role: lê as app_data das duas empresas (' || n || E')\n';
  reset role;
  select (personal_notes @> '[{"id":999}]'::jsonb), (personal_notes @> '[{"id":998}]'::jsonb) into b, ok from public.app_data where id = 2;
  r := r || case when b and not ok then 'OK   ' else 'FALHOU ' end || E'service_role: lembrete gravado na B, e só nela\n';
  perform set_config('request.jwt.claims', '', true);

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
