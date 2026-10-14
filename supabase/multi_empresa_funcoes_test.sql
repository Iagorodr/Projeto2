-- Teste de multi_empresa_funcoes.sql — SÓ para o projeto de TESTE (e Postgres
-- local). Cria uma "Empresa B" fictícia (id 2) dentro de uma transação desfeita
-- no fim. Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma
-- "FALHOU" nem "ERRO NO TESTE").
do $$
declare
  r text := '';
  n int; b boolean;
  mgr_a text; emp_a text := 'tmp-a@test.local';
  emp_b text := 'bob@b.test'; mgr_b text := 'boss@b.test';
  today date := (now() at time zone 'Europe/Brussels')::date;
  ids int[];
begin
  perform set_config('request.jwt.claims', '', true);
  select lower(btrim(email)) into mgr_a from public.company_settings where id = 1;
  begin
  update public.companies set valid_until = null, suspended = false where id = 1;
  insert into public.companies (id, code, name) values (2, 'testb', 'Empresa B');
  insert into public.company_settings (id, name, email) values (2, 'Empresa B', mgr_b);
  insert into public.staff (id, name, email, role, company_id) values
    (9000001, 'Tmp A', emp_a, 'funcionario', 1),
    (9000002, 'Bob B', emp_b, 'funcionario', 2),
    (9000003, 'Gerente-supervisor A', 'gs-a@test.local', 'gerencia_supervisor', 1);

  -- gerência da A (email da empresa)
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  r := r || case when public.can_manage_login(emp_a) then 'OK   ' else 'FALHOU ' end || E'gerência A: pode mexer no login de funcionário da A\n';
  r := r || case when public.can_manage_login(' TMP-A@test.local ') then 'OK   ' else 'FALHOU ' end || E'gerência A: ignora caixa e espaços\n';
  r := r || case when public.can_manage_login(mgr_a) then 'OK   ' else 'FALHOU ' end || E'gerência A: pode mexer no próprio login\n';
  r := r || case when not public.can_manage_login(emp_b) then 'OK   ' else 'FALHOU ' end || E'gerência A: NÃO pode mexer no login de funcionário da B\n';
  r := r || case when not public.can_manage_login(mgr_b) then 'OK   ' else 'FALHOU ' end || E'gerência A: NÃO pode mexer no login da gerência da B\n';
  r := r || case when not public.can_manage_login('conta.fora@x.test') then 'OK   ' else 'FALHOU ' end || E'gerência A: NÃO pode mexer em conta que não é de nenhuma empresa\n';
  r := r || case when not public.can_manage_login('') and not public.can_manage_login(null) then 'OK   ' else 'FALHOU ' end || E'gerência A: email vazio/nulo recusado\n';
  begin perform public.reminder_companies(); r := r || E'FALHOU gerência A: chamou reminder_companies\n';
  exception when others then r := r || 'OK   gerência A: reminder_companies bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  -- gerência-supervisor (por role em staff)
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"gs-a@test.local","sub":"00000000-0000-0000-0000-0000000000a3"}', true);
  set local role authenticated;
  r := r || case when public.can_manage_login(emp_a) then 'OK   ' else 'FALHOU ' end || E'gerência-supervisor A: pode mexer no login de funcionário da A\n';
  r := r || case when not public.can_manage_login(emp_b) then 'OK   ' else 'FALHOU ' end || E'gerência-supervisor A: NÃO pode mexer no da B\n';
  reset role;

  -- funcionário da A
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-00000000000a"}', emp_a), true);
  set local role authenticated;
  r := r || case when not public.can_manage_login(emp_a) and not public.can_manage_login(mgr_a) then 'OK   ' else 'FALHOU ' end || E'funcionário A: não pode mexer em login nenhum\n';
  reset role;

  -- gerência da B só mexe na B
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000b1"}', mgr_b), true);
  set local role authenticated;
  r := r || case when public.can_manage_login(emp_b) and not public.can_manage_login(emp_a) then 'OK   ' else 'FALHOU ' end || E'gerência B: só mexe nos logins da B\n';
  reset role;

  -- anónimo
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.can_manage_login(emp_a); r := r || E'FALHOU anónimo: chamou can_manage_login\n';
  exception when others then r := r || 'OK   anónimo: can_manage_login bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  -- empresa A vencida: ninguém da A mexe em logins
  perform set_config('request.jwt.claims', '', true);
  update public.companies set valid_until = today - 20 where id = 1;
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  r := r || case when not public.can_manage_login(emp_a) then 'OK   ' else 'FALHOU ' end || E'A vencida: gerência A não mexe em logins\n';
  reset role;

  -- service_role: lista de empresas para lembretes
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  select array_agg(id order by id) into ids from public.reminder_companies();
  r := r || case when ids = array[2] then 'OK   ' else 'FALHOU ' end || 'service_role: reminder_companies com a A vencida = ' || coalesce(ids::text, 'null') || E' ({2})\n';
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.companies set valid_until = today - 3 where id = 1;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  select array_agg(id order by id) into ids from public.reminder_companies();
  r := r || case when ids = array[1, 2] then 'OK   ' else 'FALHOU ' end || 'service_role: reminder_companies com a A em tolerância = ' || coalesce(ids::text, 'null') || E' ({1,2})\n';
  select timezone into n from public.reminder_companies() limit 0;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.companies set suspended = true where id = 2;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  select array_agg(id order by id) into ids from public.reminder_companies();
  r := r || case when ids = array[1] then 'OK   ' else 'FALHOU ' end || 'service_role: reminder_companies com a B suspensa = ' || coalesce(ids::text, 'null') || E' ({1})\n';
  reset role;

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
