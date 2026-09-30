-- Servix — fecha o risco de escalação de privilégio descrito no documento de
-- design (4.10/6.4): a política de RLS atual em `staff` (enable_auth_rls.sql)
-- dá acesso total de leitura/escrita a QUALQUER conta autenticada, incluindo
-- um funcionário comum. Como "ser gerência" é decidido pela app olhando
-- para staff.role === "gerencia" (e staff.email pra ligar a conta ao Auth),
-- isso significa que, HOJE, qualquer funcionário com login pode fazer:
--
--   update staff set role = 'gerencia' where id = <o próprio id>;
--
-- e ganhar acesso total — incluindo, depois de update-staff-password
-- existir, poder redefinir a senha de qualquer pessoa. Isto já é um risco
-- ativo mesmo sem a Edge Function.
--
-- Este ficheiro NÃO muda a política de RLS em si (continua "authenticated
-- full access", que a app precisa pra funcionar normalmente). Em vez disso
-- adiciona dois triggers que bloqueiam especificamente mudanças a `role`/
-- `email` feitas por quem não é gerência — RLS no Postgres é por LINHA, não
-- por coluna, por isso um trigger é o jeito certo de proteger só estes dois
-- campos sem impedir o resto da tabela `staff` de continuar a ser editada
-- normalmente pela gerência.
--
-- IMPORTANTE — testar numa cópia/staging antes de rodar em produção, e só
-- depois de já ter a Edge Function update-staff-password a funcionar (senão
-- fica sem forma de a própria gerência mudar role/email de ninguém, incluindo
-- de si mesma). Teste manual sugerido depois de rodar:
--   1. Logado como funcionário comum: tentar `update staff set role =
--      'gerencia' where id = <próprio id>` → tem de dar erro.
--   2. Logado como gerência: a mesma alteração, ou editar email/papel em
--      Acessos → tem de continuar a funcionar normalmente.

create or replace function staff_caller_is_gerencia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from company_settings cs
      where lower(cs.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or exists (
      select 1 from staff s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and s.role = 'gerencia'
    );
$$;

-- UPDATE: impede que role ou email mudem numa linha existente, a não ser
-- que quem está a chamar já seja gerência.
create or replace function staff_guard_role_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is not distinct from old.role) and (new.email is not distinct from old.email) then
    return new;
  end if;

  if not staff_caller_is_gerencia() then
    raise exception 'Só a gerência pode alterar role ou email em staff.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_guard_role_email_update_trigger on staff;
create trigger staff_guard_role_email_update_trigger
before update on staff
for each row execute function staff_guard_role_email_update();

-- INSERT: impede criar uma linha já com role = 'gerencia' sem ser gerência
-- quem está a criar. (O fluxo normal de "+ Novo funcionário" cria sempre
-- com role = 'funcionario' por omissão, então isto não afeta o caminho
-- normal.)
create or replace function staff_guard_insert_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is null or new.role <> 'gerencia' then
    return new;
  end if;

  if not staff_caller_is_gerencia() then
    raise exception 'Só a gerência pode criar staff com role=gerencia.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_guard_insert_role_trigger on staff;
create trigger staff_guard_insert_role_trigger
before insert on staff
for each row execute function staff_guard_insert_role();
