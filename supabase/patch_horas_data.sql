-- Servix — gravação das horas SÓ do que mudou (por funcionário).
--
-- Antes, cada dispositivo gravava o JSON `app_data.horas_data` inteiro: se dois
-- telemóveis lançavam horas ao mesmo tempo, o último a gravar apagava o que o
-- outro tinha lançado. Esta função junta ("||") apenas as chaves enviadas por
-- cima do JSON que já existe, numa única instrução atómica no servidor.
--
-- Rode UMA VEZ em cada projeto Supabase (SQL Editor → New query → cole → Run).
-- É seguro rodar mais de uma vez. Enquanto não for rodada, o app continua a
-- funcionar como antes (grava o conjunto inteiro) — só não ganha a proteção.

create or replace function public.patch_horas_data(patch jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.app_data
     set horas_data = coalesce(horas_data, '{}'::jsonb) || coalesce(patch, '{}'::jsonb)
   where id = 1;
$$;

revoke all on function public.patch_horas_data(jsonb) from public;
revoke all on function public.patch_horas_data(jsonb) from anon;
grant execute on function public.patch_horas_data(jsonb) to authenticated;
