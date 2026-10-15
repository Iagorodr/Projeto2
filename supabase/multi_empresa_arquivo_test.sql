-- Teste de multi_empresa_arquivo.sql — SÓ para o projeto de TESTE (e Postgres
-- local). Tudo dentro de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE").
do $$
declare
  r text := '';
  j jsonb;
  adm text := 'root@admin.test';
  intruso text := 'intruso@c1.test';
  cid int;
  c1_staff int; c1_clients int; c1_settings int;
  users_before int;
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
  insert into public.platform_admins (email) values (adm);
  select count(*) into c1_staff from public.staff where company_id = 1;
  select count(*) into c1_clients from public.clients where company_id = 1;
  select count(*) into c1_settings from public.company_settings where id = 1;
  insert into public.staff (id, name, email, role, company_id) values (9100090, 'Intruso', intruso, 'funcionario', 1);
  c1_staff := c1_staff + 1;

  -- ── cria uma empresa descartável, com dados e logins ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_create_company('lixo-a', 'Lixo A', 'dono@lixo.test', null);
  cid := (j ->> 'id')::int;
  r := r || case when j -> 'archivedAt' = 'null'::jsonb then 'OK   ' else 'FALHOU ' end || E'lista: empresa nova traz archivedAt = null\n';
  reset role; perform set_config('request.jwt.claims', '', true);

  insert into public.staff (id, name, email, role, company_id) values
    (9100001, 'F1', 'f1@lixo.test', 'funcionario', cid),
    (9100002, 'F2 sem e-mail', null, 'funcionario', cid),
    (9100003, 'F3 vazio', '', 'funcionario', cid),
    (9100004, 'F4 com o e-mail do admin', adm, 'funcionario', cid);
  insert into public.clients (id, name, company_id) values (9100001, 'Cli 1', cid), (9100002, 'Cli 2', cid);
  insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth, company_id) values ('9100001', 'https://push.test/1', 'k', 'a', cid);
  insert into auth.users (id, email) select gen_random_uuid(), e from unnest(array['dono@lixo.test', 'f1@lixo.test', adm, 'outro@fora.test', intruso]) e;
  insert into auth.identities (user_id, provider, provider_id, identity_data) select id, 'email', id::text, '{}'::jsonb from auth.users where email in ('dono@lixo.test', 'f1@lixo.test');
  select count(*) into users_before from auth.users;

  -- ── arquivar: só suspensa; a empresa 1 nunca ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  begin perform public.admin_archive_company(cid); r := r || E'FALHOU arquivar: empresa ativa foi arquivada\n';
  exception when others then r := r || case when sqlerrm = 'not_suspended' then 'OK   ' else 'FALHOU ' end || 'arquivar: empresa ativa recusada [' || sqlerrm || E']\n'; end;
  begin perform public.admin_archive_company(1); r := r || E'FALHOU arquivar: empresa 1 foi arquivada\n';
  exception when others then r := r || case when sqlerrm = 'protected_company' then 'OK   ' else 'FALHOU ' end || 'arquivar: empresa 1 protegida [' || sqlerrm || E']\n'; end;
  begin perform public.admin_archive_company(987654); r := r || E'FALHOU arquivar: empresa inexistente aceite\n';
  exception when others then r := r || case when sqlerrm = 'not_found' then 'OK   ' else 'FALHOU ' end || 'arquivar: empresa inexistente recusada [' || sqlerrm || E']\n'; end;

  j := public.admin_update_company(cid, '{"suspended": true}'::jsonb);
  j := public.admin_archive_company(cid);
  r := r || case when j ->> 'archivedAt' is not null and (j ->> 'suspended')::boolean and j ->> 'state' = 'suspended' then 'OK   ' else 'FALHOU ' end || E'arquivar: suspensa vai para as arquivadas (continua suspensa)\n';
  r := r || case when (select count(*) from jsonb_array_elements(public.admin_list_companies()) e where e ->> 'archivedAt' is not null and (e ->> 'id')::int = cid) = 1
                 then 'OK   ' else 'FALHOU ' end || E'lista: archivedAt aparece em admin_list_companies\n';
  j := public.admin_archive_company(cid);
  r := r || case when j ->> 'archivedAt' is not null then 'OK   ' else 'FALHOU ' end || E'arquivar: repetir é inofensivo\n';

  -- arquivada não muda
  begin perform public.admin_update_company(cid, '{"suspended": false}'::jsonb); r := r || E'FALHOU arquivada: foi reativada\n';
  exception when others then r := r || case when sqlerrm = 'archived' then 'OK   ' else 'FALHOU ' end || 'arquivada: reativar recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_update_company(cid, '{"name": "Outro nome"}'::jsonb); r := r || E'FALHOU arquivada: foi renomeada\n';
  exception when others then r := r || case when sqlerrm = 'archived' then 'OK   ' else 'FALHOU ' end || 'arquivada: renomear recusado [' || sqlerrm || E']\n'; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  r := r || case when (select suspended and archived_at is not null and name = 'Lixo A' from public.companies where id = cid) then 'OK   ' else 'FALHOU ' end || E'arquivada: nada mudou na tabela\n';
  -- nem direto no banco se pode "desarquivar" por engano com suspended = false
  begin update public.companies set suspended = false where id = cid; r := r || E'FALHOU tabela: arquivada ficou reativada\n';
  exception when others then r := r || 'OK   tabela: arquivada não pode ser reativada direto [' || sqlerrm || E']\n'; end;
  begin update public.companies set archived_at = now() where id = 1; r := r || E'FALHOU tabela: empresa 1 arquivada direto\n';
  exception when others then r := r || 'OK   tabela: empresa 1 não pode ser arquivada nem direto [' || sqlstate || E']\n'; end;
  begin
    update public.companies set suspended = false, archived_at = now() where id = cid; r := r || E'FALHOU tabela: arquivada sem suspensão\n';
  exception when others then r := r || 'OK   tabela: arquivada exige suspensa [' || sqlerrm || E']\n'; end;

  -- a empresa arquivada continua sem acesso nenhum
  r := r || case when private.company_state(cid) = 'suspended' and not (cid in (select id from public.reminder_companies())) then 'OK   ' else 'FALHOU ' end || E'arquivada: sem acesso e sem lembretes\n';

  -- ── restaurar ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  begin perform public.admin_restore_company(1); r := r || E'FALHOU restaurar: empresa 1 (não arquivada) aceite\n';
  exception when others then r := r || case when sqlerrm = 'not_archived' then 'OK   ' else 'FALHOU ' end || 'restaurar: empresa não arquivada recusada [' || sqlerrm || E']\n'; end;
  j := public.admin_restore_company(cid);
  r := r || case when j -> 'archivedAt' = 'null'::jsonb and (j ->> 'suspended')::boolean then 'OK   ' else 'FALHOU ' end || E'restaurar: volta à lista normal, ainda suspensa\n';
  j := public.admin_update_company(cid, '{"name": "Lixo A2"}'::jsonb);
  r := r || case when j ->> 'name' = 'Lixo A2' then 'OK   ' else 'FALHOU ' end || E'restaurada: volta a aceitar alterações\n';
  j := public.admin_update_company(cid, '{"name": "Lixo A"}'::jsonb);

  -- ── excluir definitivamente: recusas ──
  begin perform public.admin_delete_company(cid, 'lixo-a'); r := r || E'FALHOU excluir: empresa não arquivada foi apagada\n';
  exception when others then r := r || case when sqlerrm = 'not_archived' then 'OK   ' else 'FALHOU ' end || 'excluir: só arquivadas [' || sqlerrm || E']\n'; end;
  begin perform public.admin_delete_company(1, 'demo'); r := r || E'FALHOU excluir: empresa 1 apagada\n';
  exception when others then r := r || case when sqlerrm = 'protected_company' then 'OK   ' else 'FALHOU ' end || 'excluir: empresa 1 protegida [' || sqlerrm || E']\n'; end;
  begin perform public.admin_delete_company(987654, 'x'); r := r || E'FALHOU excluir: empresa inexistente aceite\n';
  exception when others then r := r || case when sqlerrm = 'not_found' then 'OK   ' else 'FALHOU ' end || 'excluir: empresa inexistente recusada [' || sqlerrm || E']\n'; end;
  j := public.admin_update_company(cid, '{"suspended": true}'::jsonb);
  j := public.admin_archive_company(cid);
  begin perform public.admin_delete_company(cid, 'outro-codigo'); r := r || E'FALHOU excluir: código errado aceite\n';
  exception when others then r := r || case when sqlerrm = 'confirm_mismatch' then 'OK   ' else 'FALHOU ' end || 'excluir: código errado recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_delete_company(cid, null); r := r || E'FALHOU excluir: sem código aceite\n';
  exception when others then r := r || case when sqlerrm = 'confirm_mismatch' then 'OK   ' else 'FALHOU ' end || 'excluir: sem código recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_delete_company(cid, ''); r := r || E'FALHOU excluir: código vazio aceite\n';
  exception when others then r := r || case when sqlerrm = 'confirm_mismatch' then 'OK   ' else 'FALHOU ' end || 'excluir: código vazio recusado [' || sqlerrm || E']\n'; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  r := r || case when (select count(*) from public.staff where company_id = cid) = 4 and (select count(*) from public.clients where company_id = cid) = 2
                 and (select count(*) from auth.users) = users_before then 'OK   ' else 'FALHOU ' end || E'excluir: nada foi apagado pelos pedidos recusados\n';

  -- ── quem não é administração não consegue ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000b1"}', intruso), true);
  set local role authenticated;
  begin perform public.admin_archive_company(cid); r := r || E'FALHOU intruso: arquivou\n';
  exception when others then r := r || case when sqlstate = '42501' then 'OK   ' else 'FALHOU ' end || 'intruso (funcionário da empresa 1): arquivar bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_restore_company(cid); r := r || E'FALHOU intruso: restaurou\n';
  exception when others then r := r || case when sqlstate = '42501' then 'OK   ' else 'FALHOU ' end || 'intruso: restaurar bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_delete_company(cid, 'lixo-a'); r := r || E'FALHOU intruso: excluiu\n';
  exception when others then r := r || case when sqlstate = '42501' then 'OK   ' else 'FALHOU ' end || 'intruso: excluir bloqueado [' || sqlstate || E']\n'; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.admin_archive_company(cid); r := r || E'FALHOU anónimo: arquivou\n';
  exception when others then r := r || 'OK   anónimo: arquivar bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_restore_company(cid); r := r || E'FALHOU anónimo: restaurou\n';
  exception when others then r := r || 'OK   anónimo: restaurar bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_delete_company(cid, 'lixo-a'); r := r || E'FALHOU anónimo: excluiu\n';
  exception when others then r := r || 'OK   anónimo: excluir bloqueado [' || sqlstate || E']\n'; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  r := r || case when (select count(*) from public.companies where id = cid) = 1 and (select count(*) from auth.users) = users_before then 'OK   ' else 'FALHOU ' end || E'bloqueados: empresa e logins intactos\n';

  -- ── excluir definitivamente (administração; código com espaços e maiúsculas) ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_delete_company(cid, '  LIXO-A ');
  reset role; perform set_config('request.jwt.claims', '', true);
  r := r || case when (j ->> 'deleted')::boolean and (j ->> 'clients')::int = 2 and (j ->> 'staff')::int = 4 and (j ->> 'logins')::int = 2
                 then 'OK   ' else 'FALHOU ' end || 'excluir: resumo [' || j::text || E']\n';
  r := r || case when not exists (select 1 from public.companies where id = cid)
                  and not exists (select 1 from public.company_settings where id = cid)
                  and not exists (select 1 from public.app_data where id = cid)
                  and not exists (select 1 from public.staff where company_id = cid)
                  and not exists (select 1 from public.clients where company_id = cid)
                  and not exists (select 1 from public.push_subscriptions where company_id = cid)
                 then 'OK   ' else 'FALHOU ' end || E'excluir: nada da empresa ficou (empresa, definições, dados, funcionários, clientes, push)\n';
  r := r || case when not exists (select 1 from auth.users where email in ('dono@lixo.test', 'f1@lixo.test'))
                  and not exists (select 1 from auth.identities i where not exists (select 1 from auth.users u where u.id = i.user_id))
                 then 'OK   ' else 'FALHOU ' end || E'excluir: logins da gerência e do funcionário apagados (com as identidades)\n';
  r := r || case when exists (select 1 from auth.users where email = adm) then 'OK   ' else 'FALHOU ' end || E'excluir: login de uma conta de administração nunca é apagado\n';
  r := r || case when exists (select 1 from auth.users where email = 'outro@fora.test') and exists (select 1 from auth.users where email = intruso)
                  and (select count(*) from auth.users) = users_before - 2 then 'OK   ' else 'FALHOU ' end || E'excluir: logins de fora e de outra empresa intactos\n';
  r := r || case when (select count(*) from public.staff where company_id = 1) = c1_staff
                  and (select count(*) from public.clients where company_id = 1) = c1_clients
                  and (select count(*) from public.company_settings where id = 1) = c1_settings
                 then 'OK   ' else 'FALHOU ' end || E'excluir: empresa 1 intacta (funcionários, clientes, definições)\n';

  -- o código volta a ficar livre
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_create_company('lixo-a', 'Lixo A de novo', 'dono@lixo.test', null);
  r := r || case when j ->> 'code' = 'lixo-a' and (j ->> 'id')::int <> cid then 'OK   ' else 'FALHOU ' end || E'depois de excluir, o código e o e-mail da gerência voltam a poder ser usados\n';
  reset role; perform set_config('request.jwt.claims', '', true);

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
