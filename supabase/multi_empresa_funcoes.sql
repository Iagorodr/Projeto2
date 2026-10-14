-- Servix — funções de apoio às Edge Functions no modo multi-empresa.
--
-- ESTADO: validado num Postgres local e aplicado no projeto de TESTE em 2026-10-14
-- (multi_empresa_funcoes_test.sql: 17 OK). Ainda não aplicado na produção (L & A).
--
-- PRÉ-REQUISITO: `multi_empresa.sql` já aplicado. Seguro rodar mais de uma vez.
--
--   * can_manage_login(email): "quem chama é gerência e este email é de alguém
--     da SUA empresa?" — usada pela Edge Function update-staff-password antes de
--     criar/redefinir a senha de um login. Assim nenhuma gerência consegue mexer
--     no login de outra empresa (nem em contas fora das empresas, como a sua).
--     É a mesma definição de "gerência" que as políticas de RLS usam
--     (inclui o gerência-supervisor).
--   * reminder_companies(): empresas cuja assinatura permite enviar lembretes
--     (ativa ou em tolerância), com o fuso de cada uma. Só a service_role chama.

create or replace function public.can_manage_login(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  cid integer;
begin
  if auth.role() is distinct from 'authenticated' then
    return false;
  end if;
  if e = '' or not private.is_manager() then
    return false;
  end if;
  cid := private.my_company_id();
  if cid is null or private.company_state(cid) not in ('active', 'grace') then
    return false;
  end if;
  return exists (select 1 from public.staff s
                  where lower(btrim(s.email)) = e and s.company_id = cid)
      or exists (select 1 from public.company_settings c
                  where lower(btrim(c.email)) = e and c.id = cid);
end;
$$;

create or replace function public.reminder_companies()
returns table (id integer, timezone text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.timezone
    from public.companies c
   where private.company_state(c.id) in ('active', 'grace')
   order by c.id;
$$;

revoke all on function public.can_manage_login(text) from public, anon;
grant execute on function public.can_manage_login(text) to authenticated, service_role;
revoke all on function public.reminder_companies() from public, anon, authenticated;
grant execute on function public.reminder_companies() to service_role;
