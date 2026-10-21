-- Teste de armazenamento.sql — SÓ para o projeto de TESTE / Postgres local.
-- Tudo corre dentro de uma transação desfeita no fim (nada fica gravado).
-- Resultado esperado: um ERRO "RESULT" com linhas "OK ..." (nenhuma "FALHOU"
-- nem "ERRO NO TESTE"). Precisa de armazenamento.sql já aplicado.
do $$
declare
  r text := '';
  n int;
  ok boolean;
  -- email por papel
  m1 text := 'dono@c1.test';  -- conta da empresa 1 (company_settings)
  g1 text := 'gerente@c1.test'; -- gerência (staff.role gerencia) da empresa 1
  sup text := 'sup@c1.test';
  fa text := 'fa@c1.test';   -- funcionário A, id 903
  fb text := 'fb@c1.test';   -- funcionário B, id 904
  m2 text := 'dono@c2.test';
  m3 text := 'dono@c3.test'; -- empresa com a assinatura vencida
  c1 int; c2 int; c3 int;

begin
  perform set_config('request.jwt.claims', '', true);
  begin
    insert into public.companies (code, name) values ('t-a', 'A') returning id into c1;
    insert into public.companies (code, name) values ('t-b', 'B') returning id into c2;
    insert into public.companies (code, name, valid_until) values ('t-c', 'C', current_date - 60) returning id into c3;
    insert into public.company_settings (id, email) values (c1, m1), (c2, m2), (c3, m3);
    insert into public.staff (id, name, email, role, company_id) values
      (901, 'Gerente', g1, 'gerencia', c1), (902, 'Sup', sup, 'supervisor', c1),
      (903, 'FA', fa, 'funcionario', c1), (904, 'FB', fb, 'funcionario', c1);
    insert into storage.buckets (id, name, public) values ('servix-files', 'servix-files', false) on conflict do nothing;
    insert into storage.buckets (id, name, public) values ('outro', 'outro', false) on conflict do nothing;

    -- ficheiros que já existem (criados "de confiança")
    insert into storage.objects (bucket_id, name) values
      ('servix-files', c1 || '/receipts/904/b1.jpg'),
      ('servix-files', c1 || '/avisos/av1.jpg'),
      ('servix-files', c1 || '/docs-clients/9/d1.pdf'),
      ('servix-files', c1 || '/docs-staff/9/d2.pdf'),
      ('servix-files', c2 || '/avisos/x2.jpg');

    -- ===== GERÊNCIA da empresa 1 (conta da empresa) =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000001"}', m1), true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'servix-files';
    r := r || case when n = 4 then 'OK   ' else 'FALHOU ' end || 'gerência lê só a sua empresa (4 de 5): ' || n || E'\n';
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/receipts/903/g.jpg'); r := r || E'OK   gerência envia recibo\n';
    exception when others then r := r || E'FALHOU gerência não consegue enviar recibo\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/docs-clients/9/g.pdf'); r := r || E'OK   gerência envia doc de cliente\n';
    exception when others then r := r || E'FALHOU gerência não consegue enviar doc de cliente\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c2 || '/avisos/inv.jpg'); r := r || E'FALHOU gerência enviou para OUTRA empresa\n';
    exception when others then r := r || E'OK   gerência não envia para outra empresa\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/outros/x.jpg'); r := r || E'FALHOU pasta desconhecida aceite\n';
    exception when others then r := r || E'OK   pasta desconhecida recusada\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('outro', c1 || '/avisos/x.jpg'); r := r || E'FALHOU outro bucket aceite\n';
    exception when others then r := r || E'OK   outro bucket não é coberto pelas regras\n'; end;
    delete from storage.objects where bucket_id = 'servix-files' and name = c1 || '/docs-staff/9/d2.pdf'; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'gerência apaga doc de funcionário: ' || n || E'\n';
    delete from storage.objects where bucket_id = 'servix-files' and name = c2 || '/avisos/x2.jpg'; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'gerência não apaga ficheiro de outra empresa: ' || n || E'\n';
    reset role;

    -- ===== gerência por role em staff =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000002"}', g1), true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name like c1 || '/docs-clients/%';
    r := r || case when n >= 1 then 'OK   ' else 'FALHOU ' end || 'gerente (role) lê docs de clientes: ' || n || E'\n';
    reset role;

    -- ===== FUNCIONÁRIO A (id 903) =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000003"}', fa), true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/receipts/903/a.jpg'); r := r || E'OK   funcionário envia o seu recibo\n';
    exception when others then r := r || E'FALHOU funcionário não envia o seu recibo\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/receipts/904/a.jpg'); r := r || E'FALHOU funcionário enviou recibo EM NOME de outro\n';
    exception when others then r := r || E'OK   funcionário não envia recibo de outro\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/receipts/a-sem-dono.jpg'); r := r || E'FALHOU recibo sem pasta de dono aceite\n';
    exception when others then r := r || E'OK   recibo sem pasta de dono recusado\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/avisos/f.jpg'); r := r || E'FALHOU funcionário (não supervisor) enviou foto de aviso\n';
    exception when others then r := r || E'OK   funcionário não envia foto de aviso\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/docs-staff/903/f.pdf'); r := r || E'FALHOU funcionário enviou documento de funcionário\n';
    exception when others then r := r || E'OK   funcionário não envia docs de funcionários\n'; end;
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name = c1 || '/receipts/903/a.jpg';
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'funcionário lê o seu recibo: ' || n || E'\n';
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name = c1 || '/receipts/904/b1.jpg';
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário NÃO lê recibo de outro: ' || n || E'\n';
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name = c1 || '/avisos/av1.jpg';
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'funcionário lê foto de aviso da empresa: ' || n || E'\n';
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and (name like c1 || '/docs-%');
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário NÃO lê documentos: ' || n || E'\n';
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name like c2 || '/%';
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário NÃO lê outra empresa: ' || n || E'\n';
    delete from storage.objects where bucket_id = 'servix-files' and name = c1 || '/avisos/av1.jpg'; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não apaga foto de aviso: ' || n || E'\n';
    delete from storage.objects where bucket_id = 'servix-files' and name = c1 || '/receipts/904/b1.jpg'; get diagnostics n = row_count;
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'funcionário não apaga recibo de outro: ' || n || E'\n';
    delete from storage.objects where bucket_id = 'servix-files' and name = c1 || '/receipts/903/a.jpg'; get diagnostics n = row_count;
    r := r || case when n = 1 then 'OK   ' else 'FALHOU ' end || 'funcionário apaga o seu recibo: ' || n || E'\n';
    reset role;

    -- ===== SUPERVISOR =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000004"}', sup), true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/avisos/s.jpg'); r := r || E'OK   supervisor envia foto de aviso\n';
    exception when others then r := r || E'FALHOU supervisor não envia foto de aviso\n'; end;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c1 || '/docs-clients/9/s.pdf'); r := r || E'FALHOU supervisor enviou doc de cliente\n';
    exception when others then r := r || E'OK   supervisor não envia docs de clientes\n'; end;
    reset role;

    -- ===== OUTRA EMPRESA (2) e EMPRESA VENCIDA (3) =====
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000005"}', m2), true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'servix-files' and name like c1 || '/%';
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'gerência da empresa 2 NÃO vê a empresa 1: ' || n || E'\n';
    reset role;
    perform set_config('request.jwt.claims', format('{"role":"authenticated","email":"%s","sub":"00000000-0000-0000-0000-000000000006"}', m3), true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name) values ('servix-files', c3 || '/avisos/v.jpg'); r := r || E'FALHOU empresa vencida enviou ficheiro\n';
    exception when others then r := r || E'OK   empresa vencida não envia ficheiros\n'; end;
    reset role;

    -- ===== SEM SESSÃO (anon) e email desconhecido =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin perform 1 from storage.objects limit 1; r := r || E'FALHOU anónimo leu objetos\n';
    exception when others then r := r || E'OK   anónimo sem acesso\n'; end;
    reset role;
    perform set_config('request.jwt.claims', '{"role":"authenticated","email":"estranho@x.test","sub":"00000000-0000-0000-0000-000000000007"}', true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'servix-files';
    r := r || case when n = 0 then 'OK   ' else 'FALHOU ' end || 'conta sem empresa não vê nada: ' || n || E'\n';
    reset role;
  exception when others then
    reset role;
    r := r || 'ERRO NO TESTE: ' || sqlerrm || E'\n';
  end;
  raise exception E'RESULT\n%', r;
end $$;
