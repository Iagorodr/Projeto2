-- Teste das regras de rls_hardening.sql — SÓ para o projeto de TESTE (usa os
-- funcionários de demonstração: Carlos, Beatriz, Rui, Ana e o email da empresa
-- servix@gmail.com). Corre tudo dentro de uma transação que é desfeita no fim:
-- o resultado esperado é um ERRO "RESULT" com uma linha por verificação (nenhuma
-- deve dizer FALHOU ou ERRO NO TESTE). Não deixa dados no banco.
do $$
declare
  r text := '';
  n int;
  h4 jsonb; h5 jsonb; orig5 jsonb; v jsonb;
  cid bigint;
  p text; b1 boolean; b2 boolean;
begin
  perform set_config('request.jwt.claims', '', true);
  select min(id) into cid from clients;
  select horas_data -> '5' into orig5 from app_data where id = 1;

  begin
  -- ===== preparação (como postgres, sem JWT) =====
  update app_data set
    horas_data = jsonb_set(coalesce(horas_data,'{}'::jsonb), '{4}',
      '{"status":"pendente","paid":false,"entries":[{"date":"2026-10-01","clientId":1,"hours":1,"approved":true,"extraMinutes":30}],"lockedWeeks":{},"noClientDays":[]}'::jsonb),
    sent_items = '[{"id":900100,"type":"aviso","staffId":4,"clientId":null,"text":"t","date":"2026-10-01","read":false,"seenByManagement":true},{"id":900101,"type":"aviso","staffId":5,"clientId":null,"text":"t5","date":"2026-10-01","read":false,"seenByManagement":true}]'::jsonb || coalesce(sent_items,'[]'::jsonb),
    personal_notes = '[{"id":900200,"ownerId":5,"date":"2026-10-01","text":"da Beatriz"}]'::jsonb,
    absences = '[{"id":"5-2026-10-20-1","staffId":5,"date":"2026-10-20","note":"","handled":false},{"id":"4-2026-10-21-1","staffId":4,"date":"2026-10-21","note":"","handled":false}]'::jsonb,
    missing_items = '[{"id":900300,"staffId":4,"clientId":1,"kind":"x","text":"t","date":"2026-10-01","resolved":true,"response":"ok"}]'::jsonb || coalesce(missing_items,'[]'::jsonb)
  where id = 1;

  -- ===== CARLOS (funcionario, id 4): escrita direta =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"carlos.souza@empresax.com","sub":"11111111-1111-1111-1111-111111111111"}', true);
  set local role authenticated;
  select count(*) into n from clients;
  r := r || 'carlos le clientes: ' || (n > 0) || E'\n';
  update clients set name = name || 'X' where id = cid; get diagnostics n = row_count;
  r := r || 'carlos update clients linhas=' || n || ' (esperado 0)' || E'\n';
  update staff set role = 'gerencia' where id = 4; get diagnostics n = row_count;
  r := r || 'carlos update staff role linhas=' || n || ' (esperado 0)' || E'\n';
  update company_settings set email = 'evil@x.com' where id = 1; get diagnostics n = row_count;
  r := r || 'carlos update company_settings linhas=' || n || ' (esperado 0)' || E'\n';
  update app_data set horas_data = '{}'::jsonb where id = 1; get diagnostics n = row_count;
  r := r || 'carlos update app_data linhas=' || n || ' (esperado 0)' || E'\n';
  delete from clients where id = cid; get diagnostics n = row_count;
  r := r || 'carlos delete clients linhas=' || n || ' (esperado 0)' || E'\n';
  begin
    insert into staff(id, name, email, role) values (999001, 'Hacker', 'h@x.com', 'gerencia');
    r := r || 'carlos insert staff gerencia: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'carlos insert staff gerencia: bloqueado [' || sqlerrm || ']' || E'\n'; end;
  begin
    insert into clients(id, name) values (999001, 'Falso');
    r := r || 'carlos insert clients: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'carlos insert clients: bloqueado [' || sqlerrm || ']' || E'\n'; end;

  -- ===== CARLOS: RPCs =====
  perform public.patch_horas_data('{"4":{"status":"finalizado","paid":true,"reopened":true,"entries":[{"date":"2026-10-01","clientId":1,"hours":1,"approved":true,"extraMinutes":30},{"date":"2026-10-02","clientId":2,"hours":2,"approved":true,"extraMinutes":15}],"lockedWeeks":{},"noClientDays":[]},"5":{"status":"finalizado","paid":true,"entries":[{"date":"2026-10-02","clientId":2,"hours":1}]},"99999":{"status":"x","entries":[]}}'::jsonb);
  perform public.patch_app_list('missing_items', '[{"id":900301,"staffId":4,"clientId":1,"kind":"x","text":"meu","date":"2026-10-01","resolved":true,"response":"hack","seenByManagement":true},{"id":900302,"staffId":5,"text":"falso"},{"id":900300,"staffId":4,"resolved":false,"response":""}]'::jsonb, '[900300]'::jsonb, true);
  perform public.patch_app_list('sent_items', '[{"id":900400,"type":"reclamacao","staffId":5,"clientId":1,"text":"x","date":"2026-10-01","sentBy":"supervisor","sentByStaffId":4},{"id":900100,"read":true,"text":"alterado"},{"id":900101,"read":true}]'::jsonb, '[900101]'::jsonb, true);
  perform public.patch_app_list('personal_notes', '[{"id":900201,"ownerId":5,"text":"minha","date":"x"},{"id":900200,"ownerId":4,"text":"roubada"}]'::jsonb, '[900200]'::jsonb, false);
  perform public.patch_app_list('absences', '[{"id":"4-2026-10-22-1","staffId":4,"date":"2026-10-22","handled":true},{"id":"5-2026-10-23-1","staffId":5,"date":"2026-10-23"}]'::jsonb, '["4-2026-10-21-1","5-2026-10-20-1"]'::jsonb, false);
  begin
    perform public.patch_app_list('closed_periods', '[{"id":"z","x":1}]'::jsonb, '[]'::jsonb, true);
    r := r || 'carlos closed_periods: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'carlos closed_periods: bloqueado [' || sqlstate || ']' || E'\n'; end;
  begin
    perform public.patch_assignments('{"2999-01-01":[1]}'::jsonb, '[]'::jsonb);
    r := r || 'carlos patch_assignments: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'carlos patch_assignments: bloqueado [' || sqlstate || ']' || E'\n'; end;
  reset role;

  select horas_data -> '4', horas_data -> '5' into h4, h5 from app_data where id = 1;
  r := r || 'horas 4 status=' || (h4 ->> 'status') || ' (esperado finalizado)' || E'\n';
  r := r || 'horas 4 paid=' || (h4 ->> 'paid') || ' (esperado false)' || E'\n';
  r := r || 'horas 4 reopened ausente=' || (not (h4 ? 'reopened')) || E'\n';
  r := r || 'horas 4 extra ja aprovada mantem=' || ((h4 -> 'entries' -> 0 ->> 'approved') = 'true') || ' | nova auto-aprovada anulada=' || ((h4 -> 'entries' -> 1 ->> 'approved') = 'false') || E'\n';
  r := r || 'horas 5 status inalterado=' || ((h5 -> 'status') is not distinct from (orig5 -> 'status')) || ' paid inalterado=' || ((h5 -> 'paid') is not distinct from (orig5 -> 'paid')) || ' entries trocadas=' || (jsonb_array_length(h5 -> 'entries') = 1 and (h5 -> 'entries' -> 0 ->> 'date') = '2026-10-02') || E'\n';
  select horas_data into v from app_data where id = 1;
  r := r || 'chave 99999 ignorada=' || (not (v ? '99999')) || E'\n';

  select missing_items into v from app_data where id = 1;
  r := r || 'missing: 900301 criado resolved=false/response vazio/sem seen=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900301' and e ->> 'resolved' = 'false' and e ->> 'response' = '' and not (e ? 'seenByManagement'))) || E'\n';
  r := r || 'missing: 900302 (de outro) ausente=' || (not exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900302')) || E'\n';
  r := r || 'missing: 900300 intacto (resolved=true, resposta ok)=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900300' and e ->> 'resolved' = 'true' and e ->> 'response' = 'ok')) || E'\n';

  select sent_items into v from app_data where id = 1;
  r := r || 'sent: 900400 (funcionario) ausente=' || (not exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900400')) || E'\n';
  r := r || 'sent: 900100 read=true e texto intacto=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900100' and e ->> 'read' = 'true' and e ->> 'text' = 't')) || E'\n';
  r := r || 'sent: 900101 (de outro) intacto e presente=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900101' and e ->> 'read' = 'false')) || E'\n';

  select personal_notes into v from app_data where id = 1;
  r := r || 'notas: 900201 criada com ownerId 4=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900201' and e ->> 'ownerId' = '4')) || E'\n';
  r := r || 'notas: 900200 (da Beatriz) intacta e presente=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900200' and e ->> 'ownerId' = '5' and e ->> 'text' = 'da Beatriz')) || E'\n';

  select absences into v from app_data where id = 1;
  r := r || 'ausencias: propria criada handled=false=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '4-2026-10-22-1' and e ->> 'handled' = 'false')) || E'\n';
  r := r || 'ausencias: de outro NAO criada=' || (not exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '5-2026-10-23-1')) || E'\n';
  r := r || 'ausencias: propria removida=' || (not exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '4-2026-10-21-1')) || ' | de outro mantida=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '5-2026-10-20-1')) || E'\n';
  select (closed_periods @> '[{"id":"z"}]'::jsonb) into b1 from app_data where id = 1;
  r := r || 'closed_periods intacto=' || (not b1) || E'\n';

  -- ===== RUI (supervisor, id 6) =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"rui.santos@empresax.com","sub":"22222222-2222-2222-2222-222222222222"}', true);
  set local role authenticated;
  perform public.patch_app_list('sent_items', '[{"id":900401,"type":"reclamacao","staffId":4,"clientId":1,"text":"rep","date":"2026-10-01","sentBy":"gerencia","sentByStaffId":5,"seenByManagement":true,"read":true}]'::jsonb, '[]'::jsonb, true);
  update clients set name = name || 'X' where id = cid; get diagnostics n = row_count;
  r := r || 'rui update clients linhas=' || n || ' (esperado 0)' || E'\n';
  reset role;
  select sent_items into v from app_data where id = 1;
  r := r || 'rui supervisor cria aviso: sentBy=supervisor/sentByStaffId=6/sem seen/sem read=' || (exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = '900401' and e ->> 'sentBy' = 'supervisor' and e ->> 'sentByStaffId' = '6' and not (e ? 'seenByManagement') and not (e ? 'read'))) || E'\n';

  -- ===== GERENCIA pelo email da empresa =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"servix@gmail.com","sub":"33333333-3333-3333-3333-333333333333"}', true);
  set local role authenticated;
  update clients set name = name || 'X' where id = cid; get diagnostics n = row_count;
  r := r || 'empresa(email) update clients linhas=' || n || ' (esperado 1)' || E'\n';
  update staff set role = 'gerencia_supervisor' where id = 4; get diagnostics n = row_count;
  r := r || 'empresa(email) update staff role linhas=' || n || ' (esperado 1)' || E'\n';
  perform public.patch_assignments('{"2999-01-01":[1]}'::jsonb, '[]'::jsonb);
  perform public.patch_horas_data('{"4":{"status":"finalizado","paid":true,"entries":[]}}'::jsonb);
  perform public.patch_app_list('closed_periods', '[{"id":"z","x":1}]'::jsonb, '[]'::jsonb, true);
  reset role;
  select horas_data -> '4' ->> 'paid', (assignments ? '2999-01-01'), (closed_periods @> '[{"id":"z"}]'::jsonb) into p, b1, b2 from app_data where id = 1;
  r := r || 'empresa(email): paid=true ' || (p = 'true') || ' | agenda gravada=' || b1 || ' | closed_periods gravado=' || b2 || E'\n';

  -- ===== ANA (gerencia_supervisor, id 3) =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"ana.costa@empresax.com","sub":"44444444-4444-4444-4444-444444444444"}', true);
  set local role authenticated;
  update clients set name = name || 'Y' where id = cid; get diagnostics n = row_count;
  r := r || 'ana(gerencia_supervisor) update clients linhas=' || n || ' (esperado 1)' || E'\n';
  perform public.patch_assignments('{"2999-01-02":[1]}'::jsonb, '[]'::jsonb);
  insert into staff(id, name, email, role) values (999002, 'Novo Gerente', 'novo@x.com', 'gerencia');
  get diagnostics n = row_count;
  r := r || 'ana cria staff role gerencia linhas=' || n || ' (esperado 1)' || E'\n';
  reset role;

  -- ===== utilizador desconhecido (autenticado, sem staff) =====
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@x.com","sub":"55555555-5555-5555-5555-555555555555"}', true);
  set local role authenticated;
  update clients set name = name || 'Z' where id = cid; get diagnostics n = row_count;
  r := r || 'desconhecido update clients linhas=' || n || ' (esperado 0)' || E'\n';
  begin perform public.patch_horas_data('{"4":{"status":"x","entries":[]}}'::jsonb); r := r || 'desconhecido patch_horas: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'desconhecido patch_horas: bloqueado [' || sqlstate || ']' || E'\n'; end;
  begin perform public.patch_app_list('missing_items', '[{"id":1,"staffId":4}]'::jsonb, '[]'::jsonb, true); r := r || 'desconhecido patch_app_list: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'desconhecido patch_app_list: bloqueado [' || sqlstate || ']' || E'\n'; end;
  begin perform public.patch_assignments('{"x":[1]}'::jsonb, '[]'::jsonb); r := r || 'desconhecido patch_assignments: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'desconhecido patch_assignments: bloqueado [' || sqlstate || ']' || E'\n'; end;
  reset role;

  -- ===== anónimo =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into n from clients;
    r := r || 'anon le clientes linhas=' || n || ' (esperado 0)' || E'\n';
  exception when others then r := r || 'anon le clientes: bloqueado [' || sqlstate || ']' || E'\n'; end;
  begin perform public.patch_horas_data('{}'::jsonb); r := r || 'anon patch_horas: PERMITIU (FALHOU)' || E'\n';
  exception when others then r := r || 'anon patch_horas: bloqueado [' || sqlstate || ']' || E'\n'; end;
  reset role;

  -- ===== service_role (função de lembretes) =====
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  select count(*) into n from app_data;
  r := r || 'service_role le app_data=' || (n = 1) || E'\n';
  update clients set name = name || 'S' where id = cid; get diagnostics n = row_count;
  r := r || 'service_role update clients linhas=' || n || ' (esperado 1)' || E'\n';
  perform public.patch_assignments('{"2999-01-03":[1]}'::jsonb, '[]'::jsonb);
  perform public.patch_horas_data('{"5":{"status":"pendente","entries":[]}}'::jsonb);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  exception when others then
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
