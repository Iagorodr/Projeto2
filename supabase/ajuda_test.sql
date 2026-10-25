-- Teste de ajuda.sql — SÓ para o projeto de TESTE (e Postgres local). Tudo dentro de uma transação
-- desfeita no fim (nada fica gravado). Resultado esperado: um ERRO "RESULT" com linhas "OK ..."
-- (nenhuma "FALHOU" nem "ERRO NO TESTE").
do $$
declare
  r text := '';
  j jsonb; n int; hid bigint; hid2 bigint;
  mgr text;
  emp text := 'tmp-ajuda@test.local';
  adm text := 'root-ajuda@admin.test';
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select lower(btrim(email)) into mgr from public.company_settings where id = 1;
  begin
  update public.companies set valid_until = null, suspended = false where id = 1;
  insert into public.platform_admins (email) values (adm);
  insert into public.staff (id, name, email, role, company_id) values (9100001, 'Tmp Ajuda', emp, 'funcionario', 1);

  -- ── funcionário envia ──
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000e1"}', emp), true);
  set local role authenticated;
  hid := public.submit_help_report('problem', '  O botão não responde  ', 'horas', 'employee', 'pt', 'Tmp Ajuda', 'Chrome/Android');
  r := r || case when hid is not null then 'OK   ' else 'FALHOU ' end || E'funcionário: envia um pedido\n';
  begin perform public.submit_help_report('nada', 'xxxx'); r := r || E'FALHOU tipo inválido aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_kind' then 'OK   ' else 'FALHOU ' end || E'tipo inválido recusado\n'; end;
  begin perform public.submit_help_report('idea', ' a '); r := r || E'FALHOU mensagem curta aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_message' then 'OK   ' else 'FALHOU ' end || E'mensagem curta recusada\n'; end;
  begin perform * from public.help_reports; r := r || E'FALHOU funcionário leu a tabela direto\n';
  exception when others then r := r || 'OK   funcionário: sem leitura direta da tabela [' || sqlstate || E']\n'; end;
  begin insert into public.help_reports (company_id, message) values (1, 'direto'); r := r || E'FALHOU funcionário inseriu direto\n';
  exception when others then r := r || 'OK   funcionário: sem escrita direta na tabela [' || sqlstate || E']\n'; end;
  begin perform public.admin_list_help_reports(); r := r || E'FALHOU funcionário listou pedidos\n';
  exception when others then r := r || 'OK   funcionário: admin_list_help_reports bloqueado [' || sqlstate || E']\n'; end;
  begin perform public.admin_set_help_report_status(hid, 'done'); r := r || E'FALHOU funcionário mudou estado\n';
  exception when others then r := r || 'OK   funcionário: admin_set_help_report_status bloqueado [' || sqlstate || E']\n'; end;
  -- limite diário (já enviou 1)
  for n in 1..19 loop perform public.submit_help_report('support', 'pedido ' || n); end loop;
  begin perform public.submit_help_report('support', 'um a mais'); r := r || E'FALHOU limite diário não aplicado\n';
  exception when others then r := r || case when sqlerrm = 'too_many' then 'OK   ' else 'FALHOU ' end || E'limite de 20 por dia aplicado\n'; end;
  reset role;

  -- gerência também envia (e a empresa vem do login, não do pedido)
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000a1"}', mgr), true);
  set local role authenticated;
  hid2 := public.submit_help_report('idea', 'Ideia da gerência', 'dashboard', 'manager', 'fr', null, null);
  r := r || case when hid2 is not null then 'OK   ' else 'FALHOU ' end || E'gerência: envia um pedido\n';
  reset role;
  r := r || case when (select company_id from public.help_reports where id = hid2) = 1
                  and (select author_email from public.help_reports where id = hid2) = mgr
                  and (select role from public.help_reports where id = hid2) = 'manager'
                 then 'OK   ' else 'FALHOU ' end || E'empresa e e-mail vêm do login\n';
  r := r || case when (select message from public.help_reports where id = hid) = 'O botão não responde' and (select author_email from public.help_reports where id = hid) = emp then 'OK   ' else 'FALHOU ' end || E'mensagem aparada e autor registado\n';

  -- anónimo
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.submit_help_report('problem', 'anónimo'); r := r || E'FALHOU anónimo enviou\n';
  exception when others then r := r || 'OK   anónimo: submit_help_report bloqueado [' || sqlstate || E']\n'; end;
  reset role;

  -- conta sem empresa
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"ninguem@nada.test","sub":"00000000-0000-0000-0000-0000000000f1"}', true);
  set local role authenticated;
  begin perform public.submit_help_report('problem', 'sem empresa'); r := r || E'FALHOU conta sem empresa enviou\n';
  exception when others then r := r || 'OK   conta sem empresa: bloqueada [' || sqlstate || E']\n'; end;
  reset role;

  -- administração
  perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-0000000000ad"}', adm), true);
  set local role authenticated;
  j := public.admin_list_help_reports();
  r := r || case when jsonb_array_length(j) = 21 then 'OK   ' else 'FALHOU ' end || 'admin: lista os pedidos (' || jsonb_array_length(j) || E')\n';
  r := r || case when (j -> 0 ->> 'companyCode') = 'empresa1' and (j -> 0 ->> 'status') = 'new' and (j -> 0 ->> 'companyName') is not null then 'OK   ' else 'FALHOU ' end || E'admin: cada pedido traz empresa e estado\n';
  perform public.admin_set_help_report_status(hid, 'done');
  reset role;
  r := r || case when (select status from public.help_reports where id = hid) = 'done' and (select handled_at from public.help_reports where id = hid) is not null then 'OK   ' else 'FALHOU ' end || E'admin: marca como resolvido\n';
  set local role authenticated;
  r := r || case when jsonb_array_length(public.admin_list_help_reports('new')) = 20 then 'OK   ' else 'FALHOU ' end || E'admin: filtro por estado\n';
  perform public.admin_set_help_report_status(hid, 'new');
  reset role;
  r := r || case when (select handled_at from public.help_reports where id = hid) is null then 'OK   ' else 'FALHOU ' end || E'admin: voltar a novo limpa a data\n';
  set local role authenticated;
  begin perform public.admin_set_help_report_status(hid, 'xpto'); r := r || E'FALHOU estado inválido aceite\n';
  exception when others then r := r || case when sqlerrm = 'invalid_status' then 'OK   ' else 'FALHOU ' end || E'admin: estado inválido recusado\n'; end;
  reset role;

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
