-- Teste de backup.sql — SÓ para o projeto de TESTE (e Postgres local). Tudo dentro
-- de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE").
do $$
declare
  r text := '';
  j jsonb;
  adm text := 'root@admin.test';
  intruso text := 'intruso@c1.test';
  cid int; cid2 int;
  i int;
  n int;
begin
  perform set_config('request.jwt.claims', '', true);
  begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.platform_admins (email) values (adm);
  insert into public.staff (id, name, email, role, company_id) values (9200090, 'Intruso', intruso, 'funcionario', 1);

  -- duas empresas descartáveis, com dados
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  cid  := (public.admin_create_company('bk-a', 'Backup A', 'dono@bka.test', null) ->> 'id')::int;
  cid2 := (public.admin_create_company('bk-b', 'Backup B', 'dono@bkb.test', null) ->> 'id')::int;
  reset role; perform set_config('request.jwt.claims', '', true);

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.staff (id, name, email, role, company_id) values (9200001, 'F1', 'f1@bka.test', 'funcionario', cid), (9200002, 'F2', null, 'funcionario', cid2);
  insert into public.clients (id, name, company_id) values (9200001, 'Cli 1', cid), (9200002, 'Cli 2', cid), (9200003, 'Cli B', cid2);
  insert into public.contractors (id, company_id, name) values (9200001, cid, 'Contratante 1');

  perform set_config('request.jwt.claims', '', true);
  -- ── sem permissão ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ee"}', intruso), true);
  set local role authenticated;
  begin perform public.admin_backup_company(cid); r := r || E'FALHOU permissão: gerência de outra empresa fez backup\n';
  exception when others then r := r || case when sqlerrm = 'sem permissão' then 'OK   ' else 'FALHOU ' end || 'permissão: quem não é admin é recusado [' || sqlerrm || E']\n'; end;
  begin perform public.admin_backup_status(); r := r || E'FALHOU permissão: estado visível a quem não é admin\n';
  exception when others then r := r || case when sqlerrm = 'sem permissão' then 'OK   ' else 'FALHOU ' end || 'permissão: estado só para admin [' || sqlerrm || E']\n'; end;
  begin perform 1 from public.company_backups limit 1; r := r || E'FALHOU tabela: authenticated leu company_backups\n';
  exception when others then r := r || 'OK   tabela: authenticated não lê company_backups [' || sqlstate || E']\n'; end;
  reset role; perform set_config('request.jwt.claims', '', true);

  -- ── admin ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;

  begin perform public.admin_backup_company(987654); r := r || E'FALHOU empresa inexistente aceite\n';
  exception when others then r := r || case when sqlerrm = 'not_found' then 'OK   ' else 'FALHOU ' end || 'empresa inexistente recusada [' || sqlerrm || E']\n'; end;

  r := r || case when public.admin_backup_status() = '[]'::jsonb then 'OK   ' else 'FALHOU ' end || E'estado: sem backups = lista vazia\n';

  j := public.admin_backup_company(cid);
  r := r || case when (j ->> 'dataRows')::int = 4 and (j ->> 'dataBytes')::int > 0 and j ->> 'dataAt' is not null then 'OK   ' else 'FALHOU ' end || 'backup: devolve contagem (2 clientes + 1 funcionário + 1 contratante = 4) ' || coalesce(j::text, 'null') || E'\n';
  reset role; perform set_config('request.jwt.claims', '', true);

  -- conteúdo da fotografia
  r := r || case when (select jsonb_array_length(data -> 'clients') = 2 and jsonb_array_length(data -> 'staff') = 1 and jsonb_array_length(data -> 'contractors') = 1
                           and data #>> '{company,code}' = 'bk-a' and data #>> '{company_settings,name}' is not null
                      from public.company_backups where company_id = cid) then 'OK   ' else 'FALHOU ' end || E'conteúdo: só os dados desta empresa (2 clientes, 1 funcionário, 1 contratante)\n';
  r := r || case when not exists (select 1 from public.company_backups b, jsonb_array_elements(b.data -> 'clients') e where b.company_id = cid and e ->> 'name' = 'Cli B')
                 then 'OK   ' else 'FALHOU ' end || E'conteúdo: nada de outra empresa\n';
  r := r || case when (select data ? 'app_data' and data ? 'contractor_periods' from public.company_backups where company_id = cid) then 'OK   ' else 'FALHOU ' end || E'conteúdo: tem app_data e períodos\n';
  r := r || case when (select created_by = adm from public.company_backups where company_id = cid) then 'OK   ' else 'FALHOU ' end || E'quem fez fica registado\n';

  -- estado
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_backup_status();
  r := r || case when jsonb_array_length(j) = 1 and (j -> 0 ->> 'companyId')::int = cid and (j -> 0 ->> 'dataCount')::int = 1 and j -> 0 -> 'filesAt' = 'null'::jsonb
                 then 'OK   ' else 'FALHOU ' end || 'estado: 1 empresa, ficheiros ainda sem cópia ' || coalesce(j::text, 'null') || E'\n';
  reset role; perform set_config('request.jwt.claims', '', true);

  -- a Edge Function regista a cópia de ficheiros na última fotografia (chave de serviço)
  set local role service_role;
  update public.company_backups set files_at = now(), files_count = 3, files_copied = 2, files_bytes = 12345
   where id = (select max(id) from public.company_backups where company_id = cid);
  reset role;

  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_backup_status();
  r := r || case when (j -> 0 ->> 'filesCount')::int = 3 and (j -> 0 ->> 'filesCopied')::int = 2 and (j -> 0 ->> 'filesBytes')::bigint = 12345 and j -> 0 ->> 'filesAt' is not null
                 then 'OK   ' else 'FALHOU ' end || E'estado: mostra a cópia de ficheiros\n';

  -- 7 fotografias seguidas: ficam só 5; a com ficheiros (a 1.ª) continua a ser mostrada
  for i in 1..6 loop perform public.admin_backup_company(cid); end loop;
  reset role; perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.company_backups where company_id = cid;
  -- 7 criadas, ficam as 5 últimas + a última com ficheiros (a 1.ª) = 6
  r := r || case when n = 6 then 'OK   ' else 'FALHOU ' end || 'limpeza: ficam as 5 últimas + a que tem ficheiros (' || n || E')\n';

  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_backup_status();
  r := r || case when (j -> 0 ->> 'filesCount')::int = 3 and (j -> 0 ->> 'dataCount')::int = 6 then 'OK   ' else 'FALHOU ' end || 'estado: continua a mostrar a cópia de ficheiros ' || coalesce(j::text, 'null') || E'\n';

  -- outra empresa não mexe nesta
  perform public.admin_backup_company(cid2);
  j := public.admin_backup_status();
  r := r || case when jsonb_array_length(j) = 2 then 'OK   ' else 'FALHOU ' end || E'estado: duas empresas, uma linha cada\n';
  reset role; perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.company_backups where company_id = cid2;
  r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || E'limpeza: não toca nas fotografias de outra empresa\n';

  -- cofre
  r := r || case when exists (select 1 from storage.buckets where id = 'servix-backups' and public = false) then 'OK   ' else 'FALHOU ' end || E'cofre: servix-backups existe e é privado\n';

  -- as funções não existem para anon
  r := r || case when not has_function_privilege('anon', 'public.admin_backup_company(integer)', 'execute') and not has_function_privilege('anon', 'public.admin_backup_status()', 'execute')
                 then 'OK   ' else 'FALHOU ' end || E'permissões: anon não executa\n';
  r := r || case when has_function_privilege('authenticated', 'public.admin_backup_company(integer)', 'execute') then 'OK   ' else 'FALHOU ' end || E'permissões: authenticated executa (o guarda decide)\n';

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || ' [' || sqlstate || E']\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
