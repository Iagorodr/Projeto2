-- Teste de multi_empresa_admin.sql — SÓ para o projeto de TESTE (e Postgres
-- local). Tudo dentro de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE").
do $$
declare
  r text := '';
  j jsonb; n int; b boolean; t text;
  mgr_a text;
  emp_a text := 'tmp-a@test.local';
  adm text := 'root@admin.test';
  new_mgr text := 'dono@nova.test';
  new_id int;
  code_1 text;
  n_companies int;
  today date := (now() at time zone 'Europe/Brussels')::date;
begin
  perform set_config('request.jwt.claims', '', true);
  select lower(btrim(email)) into mgr_a from public.company_settings where id = 1;
  begin
  update public.companies set valid_until = null, suspended = false where id = 1;
  insert into public.platform_admins (email) values (adm);
  insert into public.staff (id, name, email, role, company_id) values
    (9000001, 'Tmp A', emp_a, 'funcionario', 1);
  select count(*) into n_companies from public.companies;
  select code into code_1 from public.companies where id = 1;

  -- ── administração ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  r := r || case when public.is_platform_admin() then 'OK   ' else 'FALHOU ' end || E'admin: is_platform_admin = true\n';

  j := public.admin_list_companies();
  r := r || case when jsonb_array_length(j) = n_companies then 'OK   ' else 'FALHOU ' end || 'admin: lista todas as empresas (' || jsonb_array_length(j) || E')\n';
  r := r || case when (j -> 0 ->> 'managerEmail') = mgr_a and (j -> 0 ->> 'state') = 'active' and (j -> 0 ->> 'staffCount')::int >= 1
                 then 'OK   ' else 'FALHOU ' end || E'admin: lista traz e-mail da gerência, estado e totais\n';

  -- criar
  j := public.admin_create_company('  Nova-Lda ', '  Nova Lda  ', ' DONO@Nova.test ', today + 30, 'Europe/Lisbon', ' cliente piloto ');
  new_id := (j ->> 'id')::int;
  r := r || case when j ->> 'code' = 'nova-lda' and j ->> 'name' = 'Nova Lda' and j ->> 'managerEmail' = new_mgr
                      and j ->> 'state' = 'active' and (j ->> 'daysLeft')::int = 30 and j ->> 'timezone' = 'Europe/Lisbon' and j ->> 'notes' = 'cliente piloto'
                 then 'OK   ' else 'FALHOU ' end || E'admin: criar empresa (código/nome/e-mail normalizados, 30 dias)\n';
  r := r || case when jsonb_array_length(public.admin_list_companies()) = n_companies + 1 then 'OK   ' else 'FALHOU ' end || E'admin: a nova empresa aparece na lista\n';

  -- erros de validação (cada um sem criar nada)
  begin perform public.admin_create_company('nova-lda', 'Outra', 'outro@x.test'); r := r || E'FALHOU admin: código repetido aceite\n';
  exception when others then r := r || case when sqlerrm = 'code_taken' then 'OK   ' else 'FALHOU ' end || 'admin: código repetido recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('NOVA-LDA', 'Outra', 'outro@x.test'); r := r || E'FALHOU admin: código repetido (maiúsculas) aceite\n';
  exception when others then r := r || case when sqlerrm = 'code_taken' then 'OK   ' else 'FALHOU ' end || 'admin: código repetido em maiúsculas recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('outra', 'Outra', new_mgr); r := r || E'FALHOU admin: e-mail repetido aceite\n';
  exception when others then r := r || case when sqlerrm = 'email_taken' then 'OK   ' else 'FALHOU ' end || 'admin: e-mail de gerência repetido recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('outra', 'Outra', emp_a); r := r || E'FALHOU admin: e-mail de funcionário aceite\n';
  exception when others then r := r || case when sqlerrm = 'email_taken' then 'OK   ' else 'FALHOU ' end || 'admin: e-mail que já é de um funcionário recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('A', 'Outra', 'outro@x.test'); r := r || E'FALHOU admin: código curto aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_code' then 'OK   ' else 'FALHOU ' end || 'admin: código inválido recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('com espaco', 'Outra', 'outro@x.test'); r := r || E'FALHOU admin: código com espaço aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_code' then 'OK   ' else 'FALHOU ' end || 'admin: código com espaço recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('outra', '   ', 'outro@x.test'); r := r || E'FALHOU admin: nome vazio aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_name' then 'OK   ' else 'FALHOU ' end || 'admin: nome vazio recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('outra', 'Outra', 'sem-arroba'); r := r || E'FALHOU admin: e-mail inválido aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_email' then 'OK   ' else 'FALHOU ' end || 'admin: e-mail inválido recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_create_company('outra', 'Outra', 'outro@x.test', null, 'Marte/Olympus'); r := r || E'FALHOU admin: fuso inválido aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_timezone' then 'OK   ' else 'FALHOU ' end || 'admin: fuso horário inválido recusado [' || sqlerrm || E']\n'; end;
  r := r || case when jsonb_array_length(public.admin_list_companies()) = n_companies + 1 then 'OK   ' else 'FALHOU ' end || E'admin: nenhum pedido recusado deixou empresa pela metade\n';

  -- atualizar / renovar / suspender
  j := public.admin_update_company(new_id, format('{"validUntil":"%s"}', today - 3)::jsonb);
  r := r || case when j ->> 'state' = 'grace' and (j ->> 'daysLeft')::int = -3 then 'OK   ' else 'FALHOU ' end || 'admin: validade 3 dias atrás = tolerância [' || (j ->> 'state') || E']\n';
  j := public.admin_update_company(new_id, format('{"validUntil":"%s"}', today - 20)::jsonb);
  r := r || case when j ->> 'state' = 'expired' then 'OK   ' else 'FALHOU ' end || 'admin: validade 20 dias atrás = vencida [' || (j ->> 'state') || E']\n';
  j := public.admin_update_company(new_id, format('{"validUntil":"%s"}', today + 365)::jsonb);
  r := r || case when j ->> 'state' = 'active' and (j ->> 'daysLeft')::int = 365 then 'OK   ' else 'FALHOU ' end || E'admin: renovar 365 dias = ativa\n';
  j := public.admin_update_company(new_id, '{"validUntil":null}'::jsonb);
  r := r || case when j ->> 'state' = 'active' and j -> 'validUntil' = 'null'::jsonb and j -> 'daysLeft' = 'null'::jsonb then 'OK   ' else 'FALHOU ' end || E'admin: validUntil null = sem prazo\n';
  j := public.admin_update_company(new_id, '{"suspended":true}'::jsonb);
  r := r || case when j ->> 'state' = 'suspended' then 'OK   ' else 'FALHOU ' end || E'admin: suspender\n';
  j := public.admin_update_company(new_id, '{"suspended":false,"name":"Nova Lda 2","notes":"","code":"nova2"}'::jsonb);
  r := r || case when j ->> 'state' = 'active' and j ->> 'name' = 'Nova Lda 2' and j ->> 'code' = 'nova2' and j -> 'notes' = 'null'::jsonb then 'OK   ' else 'FALHOU ' end || E'admin: reativar + renomear + novo código + notas vazias\n';
  begin perform public.admin_update_company(new_id, format('{"code":"%s"}', code_1)::jsonb); r := r || E'FALHOU admin: código de outra empresa aceite\n';
  exception when others then r := r || case when sqlerrm = 'code_taken' then 'OK   ' else 'FALHOU ' end || 'admin: trocar para código já usado recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_update_company(new_id, '{"validUntil":"31/12/2026"}'::jsonb); r := r || E'FALHOU admin: data inválida aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_date' then 'OK   ' else 'FALHOU ' end || 'admin: data inválida recusada [' || sqlerrm || E']\n'; end;
  begin perform public.admin_update_company(new_id, '{"name":"  "}'::jsonb); r := r || E'FALHOU admin: nome vazio aceite no update\n';
  exception when others then r := r || case when sqlerrm = 'invalid_name' then 'OK   ' else 'FALHOU ' end || 'admin: update com nome vazio recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_update_company(987654, '{"name":"x"}'::jsonb); r := r || E'FALHOU admin: empresa inexistente aceite\n';
  exception when others then r := r || case when sqlerrm = 'not_found' then 'OK   ' else 'FALHOU ' end || 'admin: empresa inexistente [' || sqlerrm || E']\n'; end;
  j := public.admin_update_company(new_id, format('{"validUntil":"%s"}', today + 30)::jsonb);

  -- a conta de administração NÃO vê dados das empresas nem as tabelas
  select count(*) into n from public.clients;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'admin: não lê clientes de nenhuma empresa (' || n || E')\n';
  select count(*) into n from public.staff;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'admin: não lê funcionários de nenhuma empresa (' || n || E')\n';
  begin perform 1 from public.companies limit 1; r := r || E'FALHOU admin: leu a tabela companies diretamente\n';
  exception when others then r := r || 'OK   admin: tabela companies só por funções [' || sqlstate || E']\n'; end;
  begin perform 1 from public.platform_admins limit 1; r := r || E'FALHOU admin: leu platform_admins diretamente\n';
  exception when others then r := r || 'OK   admin: platform_admins só por funções [' || sqlstate || E']\n'; end;
  begin
    perform public.my_company_status();
    r := r || 'OK   admin: my_company_status sem empresa = ' || (public.my_company_status() ->> 'state') || E'\n';
  exception when others then r := r || 'FALHOU admin: my_company_status deu erro ' || sqlerrm || E'\n'; end;

  -- palavra-passe da gerência (Edge Function): só contas de gerência de empresas
  r := r || case when public.admin_can_set_manager_login(new_mgr) and public.admin_can_set_manager_login(' ' || upper(new_mgr) || ' ') and public.admin_can_set_manager_login(mgr_a)
                 then 'OK   ' else 'FALHOU ' end || E'admin: pode (re)definir a palavra-passe da gerência de qualquer empresa\n';
  r := r || case when not public.admin_can_set_manager_login(emp_a) then 'OK   ' else 'FALHOU ' end || E'admin: NÃO pode mexer na conta de um funcionário\n';
  r := r || case when not public.admin_can_set_manager_login(adm) then 'OK   ' else 'FALHOU ' end || E'admin: NÃO pode mexer na conta de administração\n';
  r := r || case when not public.admin_can_set_manager_login('desconhecido@x.test') and not public.admin_can_set_manager_login('') and not public.admin_can_set_manager_login(null)
                 then 'OK   ' else 'FALHOU ' end || E'admin: contas sem empresa / vazio recusados\n';
  reset role;

  -- ── a empresa nova funciona de ponta a ponta ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000d1"}', new_mgr), true);
  set local role authenticated;
  j := public.my_company_status();
  r := r || case when j ->> 'state' = 'active' and (j ->> 'companyId')::int = new_id and j ->> 'code' = 'nova2' then 'OK   ' else 'FALHOU ' end || E'gerência nova: my_company_status mostra a empresa dela\n';
  select count(*) into n from public.company_settings;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência nova: lê só as definições dela (' || n || E')\n';
  select count(*) into n from public.app_data where id = new_id;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || E'gerência nova: tem a sua linha de dados\n';
  select count(*) into n from public.clients;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'gerência nova: não vê clientes da empresa 1 (' || n || E')\n';
  select count(*) into n from public.staff;
  r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'gerência nova: não vê funcionários da empresa 1 (' || n || E')\n';
  insert into public.clients (id, name) values (9000200, 'Cliente da Nova');
  select company_id into n from public.clients where id = 9000200;
  r := r || case when n = new_id then 'OK   ' else 'FALHOU ' end || E'gerência nova: cliente criado fica na empresa dela\n';
  perform public.patch_app_list('personal_notes', '[{"id":1,"ownerId":"management","text":"olá","date":"x"}]'::jsonb, '[]'::jsonb, false);
  select jsonb_array_length(personal_notes) into n from public.app_data where id = new_id;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || E'gerência nova: grava notas nos dados dela\n';
  begin perform public.admin_list_companies(); r := r || E'FALHOU gerência nova: chamou admin_list_companies\n';
  exception when others then r := r || 'OK   gerência nova: admin_list_companies bloqueado [' || sqlstate || E']\n'; end;
  r := r || case when not public.is_platform_admin() then 'OK   ' else 'FALHOU ' end || E'gerência nova: is_platform_admin = false\n';
  reset role;

  -- suspensa pela administração: a gerência nova fica sem acesso, mas vê o estado
  perform set_config('request.jwt.claims', '', true);
  perform public.admin_update_company(new_id, '{"suspended":true}'::jsonb);
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000d1"}', new_mgr), true);
  set local role authenticated;
  j := public.my_company_status();
  select count(*) into n from public.clients;
  r := r || case when j ->> 'state' = 'suspended' and n = 0 then 'OK   ' else 'FALHOU ' end || E'empresa suspensa: estado visível e dados bloqueados\n';
  reset role;

  -- ── quem NÃO administra ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  begin perform public.admin_list_companies(); r := r || E'FALHOU gerência A: listou empresas\n';
  exception when others then r := r || 'OK   gerência A: admin_list_companies bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_create_company('hack', 'Hack', 'hack@x.test'); r := r || E'FALHOU gerência A: criou empresa\n';
  exception when others then r := r || 'OK   gerência A: admin_create_company bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_update_company(1, '{"validUntil":null}'::jsonb); r := r || E'FALHOU gerência A: alterou a própria validade\n';
  exception when others then r := r || 'OK   gerência A: não altera a própria validade [' || sqlstate || E']\n'; end;
  r := r || case when not public.admin_can_set_manager_login(emp_a) and not public.admin_can_set_manager_login(mgr_a) then 'OK   ' else 'FALHOU ' end || E'gerência A: admin_can_set_manager_login = false\n';
  r := r || case when not public.is_platform_admin() then 'OK   ' else 'FALHOU ' end || E'gerência A: is_platform_admin = false\n';
  reset role;

  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-00000000000a"}', emp_a), true);
  set local role authenticated;
  begin perform public.admin_list_companies(); r := r || E'FALHOU funcionário A: listou empresas\n';
  exception when others then r := r || 'OK   funcionário A: admin_list_companies bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.admin_list_companies(); r := r || E'FALHOU anónimo: listou empresas\n';
  exception when others then r := r || 'OK   anónimo: admin_list_companies bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.is_platform_admin(); r := r || E'FALHOU anónimo: chamou is_platform_admin\n';
  exception when others then r := r || 'OK   anónimo: is_platform_admin bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_can_set_manager_login(mgr_a); r := r || E'FALHOU anónimo: chamou admin_can_set_manager_login\n';
  exception when others then r := r || 'OK   anónimo: admin_can_set_manager_login bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  -- um e-mail só passa a administrador por quem tem acesso direto (nunca pela API)
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr_a), true);
  set local role authenticated;
  begin insert into public.platform_admins (email) values (mgr_a); r := r || E'FALHOU gerência A: inseriu-se como administrador\n';
  exception when others then r := r || 'OK   gerência A: não consegue inserir em platform_admins [' || sqlstate || E']\n'; end;
  reset role;

  -- service_role / SQL Editor (de confiança) também administram
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  r := r || case when jsonb_array_length(public.admin_list_companies()) = n_companies + 1 then 'OK   ' else 'FALHOU ' end || E'service_role: admin_list_companies funciona\n';
  reset role;

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
