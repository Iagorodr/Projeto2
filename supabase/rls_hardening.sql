-- Servix — endurecimento de segurança do banco (RLS + funções + guarda de role).
--
-- ESTADO: escrito, AINDA NÃO TESTADO nem aplicado em nenhum projeto Supabase.
-- Testar primeiro no projeto de teste (funcionário, supervisor, gerência,
-- gerência-supervisor, service_role) antes de correr na produção.
--
-- Substitui `rls_staff_role_guard.sql` (agora incluído aqui) e refina as
-- políticas de `enable_auth_rls.sql`, onde QUALQUER conta autenticada tinha
-- leitura e escrita total em tudo. Sem isto, um funcionário com login podia,
-- chamando a API do Supabase diretamente (fora do app):
--   * promover-se a gerência (update staff set role = 'gerencia');
--   * alterar/apagar clientes, funcionários e definições da empresa;
--   * marcar horas como pagas, aprovar as próprias horas extra, apagar avisos,
--     períodos fechados, agendas, etc.
--
-- O QUE FICA DEPOIS DESTE FICHEIRO
--   * clients, staff, company_settings, app_data: LEITURA para todas as contas
--     autenticadas (o app precisa); ESCRITA direta só para quem é gerência
--     ("gerência" = o email das definições da empresa, ou um funcionário com
--     role 'gerencia' / 'gerencia_supervisor').
--   * Funcionários e supervisores continuam a gravar as suas horas, pedidos,
--     avisos, notas e ausências, mas só pelas funções `patch_horas_data` e
--     `patch_app_list`, que agora validam no servidor o que cada pessoa pode
--     mexer (ver comentários de cada função).
--   * Triggers em `staff`: ninguém que não seja gerência cria/altera role ou
--     email (defesa em profundidade, caso as políticas sejam alteradas).
--   * A Edge Function de lembretes usa a service_role (ignora RLS) e continua
--     a funcionar sem mudanças.
--
-- NÃO RESOLVE (fica para o redesenho multi-empresa): a LEITURA continua aberta
-- a quem tem login — um funcionário que chame a API diretamente consegue ler
-- IBANs, horas dos colegas, períodos fechados, etc.
--
-- Rode UMA VEZ em cada projeto Supabase (SQL Editor → New query → cole → Run).
-- É seguro rodar mais de uma vez. Reverter: ver o bloco ROLLBACK no fim.
--
-- ATENÇÃO — janelas/PWAs do app abertas ANTES desta mudança e com versão antiga
-- do código gravam fatias de `app_data` por escrita direta; para funcionários
-- isso passa a ser recusado (sem erro visível). Peça para recarregarem o app.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Funções auxiliares (schema `private`, não exposto pela API REST)
-- ─────────────────────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

-- Email da sessão (minúsculas, sem espaços).
create or replace function private.auth_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Chamada "de confiança": service_role (Edge Functions) ou ligação direta ao
-- Postgres (SQL Editor / migrações), que não passa pela API (não tem JWT).
create or replace function private.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (auth.role() is null and session_user <> 'authenticator');
$$;

-- Quem é gerência: o email das definições da empresa, ou um funcionário com
-- role 'gerencia' / 'gerencia_supervisor' (este último troca para a vista de
-- gerência no app). Igual a `resolveSessionAndRoute` no app.
create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_privileged()
      or (private.auth_email() <> '' and (
            exists (select 1 from public.company_settings cs
                    where lower(btrim(cs.email)) = private.auth_email())
         or exists (select 1 from public.staff s
                    where lower(btrim(s.email)) = private.auth_email()
                      and s.role in ('gerencia', 'gerencia_supervisor'))
         ));
$$;

-- Linha de `staff` da sessão (por email), se existir.
create or replace function private.my_staff_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  where private.auth_email() <> '' and lower(btrim(s.email)) = private.auth_email()
  order by s.id limit 1;
$$;

create or replace function private.my_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s
  where private.auth_email() <> '' and lower(btrim(s.email)) = private.auth_email()
  order by s.id limit 1;
$$;

-- Lançamentos de horas enviados por quem NÃO é gerência: `approved: true` só
-- se já existia aprovado (mesma data, cliente e minutos extra). Evita que um
-- funcionário aprove as próprias horas extra.
create or replace function private.horas_clean_entries(new_entries jsonb, old_entries jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case
      when t.e -> 'approved' = 'true'::jsonb and not exists (
        select 1 from jsonb_array_elements(
                 case when jsonb_typeof(old_entries) = 'array' then old_entries else '[]'::jsonb end) o
        where o -> 'approved' = 'true'::jsonb
          and o -> 'date' is not distinct from t.e -> 'date'
          and o -> 'clientId' is not distinct from t.e -> 'clientId'
          and coalesce(o -> 'extraMinutes', '0'::jsonb) = coalesce(t.e -> 'extraMinutes', '0'::jsonb)
      ) then t.e || '{"approved": false}'::jsonb
      else t.e
    end
    order by t.ord), '[]'::jsonb)
  from jsonb_array_elements(
         case when jsonb_typeof(new_entries) = 'array' then new_entries else '[]'::jsonb end
       ) with ordinality as t(e, ord);
$$;

revoke all on function private.auth_email() from public, anon;
revoke all on function private.is_privileged() from public, anon;
revoke all on function private.is_manager() from public, anon;
revoke all on function private.my_staff_id() from public, anon;
revoke all on function private.my_staff_role() from public, anon;
revoke all on function private.horas_clean_entries(jsonb, jsonb) from public, anon;
grant execute on function private.auth_email() to authenticated, service_role;
grant execute on function private.is_privileged() to authenticated, service_role;
grant execute on function private.is_manager() to authenticated, service_role;
grant execute on function private.my_staff_id() to authenticated, service_role;
grant execute on function private.my_staff_role() to authenticated, service_role;
grant execute on function private.horas_clean_entries(jsonb, jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Triggers em `staff` (role/email só pela gerência)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.staff_guard_role_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is not distinct from old.role) and (new.email is not distinct from old.email) then
    return new;
  end if;
  if not private.is_manager() then
    raise exception 'Só a gerência pode alterar role ou email em staff.';
  end if;
  return new;
end;
$$;

create or replace function public.staff_guard_insert_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is null or new.role not in ('gerencia', 'gerencia_supervisor') then
    return new;
  end if;
  if not private.is_manager() then
    raise exception 'Só a gerência pode criar staff com role=%.', new.role;
  end if;
  return new;
end;
$$;

drop trigger if exists staff_guard_role_email_update_trigger on public.staff;
create trigger staff_guard_role_email_update_trigger
before update on public.staff
for each row execute function public.staff_guard_role_email_update();

drop trigger if exists staff_guard_insert_role_trigger on public.staff;
create trigger staff_guard_insert_role_trigger
before insert on public.staff
for each row execute function public.staff_guard_insert_role();

-- Versão antiga do auxiliar (já não é usada por nada).
drop function if exists public.staff_caller_is_gerencia();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Políticas de RLS: ler = qualquer conta autenticada; escrever = gerência
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  tbl text;
begin
  foreach tbl in array array['clients', 'staff', 'company_settings', 'app_data'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists authenticated_full_access on public.%I', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_select', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_insert_manager', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_update_manager', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_delete_manager', tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)',
                   tbl || '_select', tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_manager()))',
                   tbl || '_insert_manager', tbl);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()))',
                   tbl || '_update_manager', tbl);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_manager()))',
                   tbl || '_delete_manager', tbl);
  end loop;
end $$;
-- `push_subscriptions` fica como está (cada pessoa regista o seu dispositivo).

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Funções de gravação (agora SECURITY DEFINER com validação por perfil)
-- ─────────────────────────────────────────────────────────────────────────

-- Horas. Gerência: junta o patch tal como vem. Funcionário/supervisor:
--  * na PRÓPRIA chave: tudo, exceto `paid` e `reopened` (só a gerência marca
--    pago / reabre) e `approved` das horas extra (só se já estava aprovado);
--  * nas chaves dos COLEGAS: só a lista `entries` (divisão partilhada de horas
--    de uma mesma visita), nunca estado, pagamento, semanas fechadas, etc.;
--  * chaves que não são de um funcionário existente são ignoradas.
create or replace function public.patch_horas_data(patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint;
  cur jsonb;
  clean jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  old jsonb;
  nv jsonb;
begin
  if auth.role() is distinct from 'authenticated' and not private.is_privileged() then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  patch := coalesce(patch, '{}'::jsonb);
  if jsonb_typeof(patch) <> 'object' then
    raise exception 'patch_horas_data: o patch tem de ser um objeto';
  end if;

  if private.is_manager() then
    update public.app_data
       set horas_data = coalesce(horas_data, '{}'::jsonb) || patch
     where id = 1;
    return;
  end if;

  me := private.my_staff_id();
  if me is null then
    raise exception 'sem permissão para gravar horas' using errcode = '42501';
  end if;

  select coalesce(horas_data, '{}'::jsonb) into cur from public.app_data where id = 1 for update;
  if cur is null then return; end if;

  for k, v in select key, value from jsonb_each(patch) loop
    if jsonb_typeof(v) <> 'object' then continue; end if;
    old := cur -> k;

    if k = me::text then
      nv := v - 'paid' - 'reopened';
      nv := nv || jsonb_build_object('paid', coalesce(old -> 'paid', 'false'::jsonb));
      if old ? 'reopened' then
        nv := nv || jsonb_build_object('reopened', old -> 'reopened');
      end if;
      nv := nv || jsonb_build_object(
        'entries', private.horas_clean_entries(coalesce(v -> 'entries', old -> 'entries', '[]'::jsonb), old -> 'entries'));
    elsif exists (select 1 from public.staff s where s.id::text = k) then
      if old is null then
        nv := jsonb_build_object(
          'status', 'pendente', 'paid', false, 'lockedWeeks', '{}'::jsonb, 'noClientDays', '[]'::jsonb,
          'entries', private.horas_clean_entries(coalesce(v -> 'entries', '[]'::jsonb), '[]'::jsonb));
      else
        nv := old || jsonb_build_object(
          'entries', private.horas_clean_entries(coalesce(v -> 'entries', old -> 'entries', '[]'::jsonb), old -> 'entries'));
      end if;
    else
      continue;
    end if;
    clean := clean || jsonb_build_object(k, nv);
  end loop;

  update public.app_data
     set horas_data = coalesce(horas_data, '{}'::jsonb) || clean
   where id = 1;
end;
$$;

-- Atribuições (agenda): só gerência.
create or replace function public.patch_assignments(upserts jsonb, removed jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'authenticated' and not private.is_privileged() then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if not private.is_manager() then
    raise exception 'sem permissão para alterar a agenda' using errcode = '42501';
  end if;
  update public.app_data
     set assignments =
       (coalesce(assignments, '{}'::jsonb) || coalesce(upserts, '{}'::jsonb))
       - coalesce(array(select jsonb_array_elements_text(coalesce(removed, '[]'::jsonb))), '{}'::text[])
   where id = 1;
end;
$$;

-- Listas (missing_items, sent_items, closed_periods, personal_notes, absences).
-- Gerência: aplica tudo. Funcionário/supervisor (o resto é ignorado em silêncio):
--  * missing_items  — cria pedidos SEUS (staffId = ele); não altera nem apaga;
--  * sent_items     — supervisor cria avisos/reclamações/elogios (sentByStaffId
--                     = ele); qualquer um marca como lido ("read") os SEUS;
--  * personal_notes — cria/altera/apaga só notas SUAS (ownerId = ele);
--  * absences       — cria/apaga só ausências SUAS (nunca `handled`);
--  * closed_periods — só gerência.
create or replace function public.patch_app_list(
  slice text,
  upserts jsonb,
  removed jsonb,
  prepend boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur jsonb;
  res jsonb;
  ups jsonb;
  rem jsonb;
  me bigint;
  me_txt text;
  my_role text;
begin
  if slice not in ('missing_items', 'sent_items', 'closed_periods', 'personal_notes', 'absences') then
    raise exception 'patch_app_list: fatia desconhecida %', slice;
  end if;
  if auth.role() is distinct from 'authenticated' and not private.is_privileged() then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  -- Bloqueia a linha até ao fim: gravações simultâneas ficam em fila.
  execute format('select %I from public.app_data where id = 1 for update', slice) into cur;
  if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  ups := case when jsonb_typeof(upserts) = 'array' then upserts else '[]'::jsonb end;
  rem := case when jsonb_typeof(removed) = 'array' then removed else '[]'::jsonb end;

  if not private.is_manager() then
    me := private.my_staff_id();
    if me is null or slice = 'closed_periods' then
      raise exception 'sem permissão para alterar %', slice using errcode = '42501';
    end if;
    me_txt := me::text;
    my_role := private.my_staff_role();

    if slice = 'missing_items' then
      select coalesce(jsonb_agg(((u.e - 'seenByManagement') ||
               jsonb_build_object('staffId', me, 'resolved', false, 'response', '')) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and u.e ->> 'staffId' = me_txt
         and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id');
      rem := '[]'::jsonb;

    elsif slice = 'sent_items' then
      select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb)
        into ups
        from (
          -- itens novos: só supervisor, sempre em nome dele
          select ((u.e - 'seenByManagement' - 'read') ||
                  jsonb_build_object('sentBy', 'supervisor', 'sentByStaffId', me)) as e, u.ord
            from jsonb_array_elements(ups) with ordinality as u(e, ord)
           where my_role = 'supervisor'
             and u.e ->> 'id' is not null
             and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id')
          union all
          -- itens existentes dirigidos a ele: só o "lido"
          select (c.e || jsonb_build_object('read', u.e -> 'read')) as e, u.ord
            from jsonb_array_elements(ups) with ordinality as u(e, ord)
            join jsonb_array_elements(cur) as c(e) on c.e ->> 'id' = u.e ->> 'id'
           where c.e ->> 'staffId' = me_txt
             and u.e ? 'read'
        ) x;
      rem := '[]'::jsonb;

    elsif slice = 'personal_notes' then
      select coalesce(jsonb_agg((u.e || jsonb_build_object('ownerId', me)) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and (
           not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id')
           or exists (select 1 from jsonb_array_elements(cur) c
                       where c ->> 'id' = u.e ->> 'id' and c ->> 'ownerId' = me_txt)
         );
      select coalesce(jsonb_agg(r.id), '[]'::jsonb)
        into rem
        from jsonb_array_elements_text(rem) as r(id)
       where exists (select 1 from jsonb_array_elements(cur) c
                      where c ->> 'id' = r.id and c ->> 'ownerId' = me_txt);

    elsif slice = 'absences' then
      select coalesce(jsonb_agg(((u.e - 'handled') ||
               jsonb_build_object('staffId', me, 'handled', false)) order by u.ord), '[]'::jsonb)
        into ups
        from jsonb_array_elements(ups) with ordinality as u(e, ord)
       where u.e ->> 'id' is not null
         and u.e ->> 'staffId' = me_txt
         and not exists (select 1 from jsonb_array_elements(cur) c where c ->> 'id' = u.e ->> 'id');
      select coalesce(jsonb_agg(r.id), '[]'::jsonb)
        into rem
        from jsonb_array_elements_text(rem) as r(id)
       where exists (select 1 from jsonb_array_elements(cur) c
                      where c ->> 'id' = r.id and c ->> 'staffId' = me_txt);
    end if;
  end if;

  with
    ups_t as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(ups) with ordinality as t(e, ord)
    ),
    rem_t as (
      select value as id from jsonb_array_elements_text(rem)
    ),
    curr as (
      select t.e, t.ord, t.e ->> 'id' as id
      from jsonb_array_elements(cur) with ordinality as t(e, ord)
    ),
    kept as (
      select coalesce(u.e, c.e) as e, c.ord::bigint as ord
      from curr c
      left join lateral (
        select ups_t.e from ups_t where ups_t.id = c.id order by ups_t.ord desc limit 1
      ) u on c.id is not null
      where c.id is null or c.id not in (select id from rem_t)
    ),
    added as (
      select distinct on (u.id)
        u.e,
        case when prepend then -1000000000::bigint + u.ord else 1000000000::bigint + u.ord end as ord
      from ups_t u
      where u.id is not null
        and u.id not in (select id from rem_t)
        and not exists (select 1 from curr c where c.id = u.id)
      order by u.id, u.ord desc
    )
  select coalesce(jsonb_agg(x.e order by x.ord), '[]'::jsonb)
    into res
    from (select e, ord from kept union all select e, ord from added) x;

  execute format('update public.app_data set %I = $1 where id = 1', slice) using res;
end;
$$;

revoke all on function public.patch_horas_data(jsonb) from public, anon;
revoke all on function public.patch_assignments(jsonb, jsonb) from public, anon;
revoke all on function public.patch_app_list(text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.patch_horas_data(jsonb) to authenticated, service_role;
grant execute on function public.patch_assignments(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.patch_app_list(text, jsonb, jsonb, boolean) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (voltar ao comportamento anterior, tudo aberto a quem tem login):
--
--   do $$ declare t text; begin
--     foreach t in array array['clients','staff','company_settings','app_data'] loop
--       execute format('drop policy if exists %I on public.%I', t||'_select', t);
--       execute format('drop policy if exists %I on public.%I', t||'_insert_manager', t);
--       execute format('drop policy if exists %I on public.%I', t||'_update_manager', t);
--       execute format('drop policy if exists %I on public.%I', t||'_delete_manager', t);
--       execute format('create policy authenticated_full_access on public.%I for all to authenticated using (true) with check (true)', t);
--     end loop; end $$;
--   -- e voltar a correr patch_horas_data.sql e patch_app_data.sql (versões invoker).
-- ─────────────────────────────────────────────────────────────────────────
