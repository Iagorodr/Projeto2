-- Servix — protege a função `send-note-reminders` (lembretes de notas).
--
-- Antes, qualquer pessoa que conhecesse o endereço da função e uma chave do
-- projeto conseguia disparar os lembretes (a função corre com a chave de
-- serviço). Agora a função exige um cabeçalho `x-cron-secret` igual ao valor
-- guardado aqui. O valor é gerado pela própria base de dados (ninguém o digita
-- nem o vê) e o agendamento diário (pg_cron) passa a enviá-lo sozinho.
--
-- A tabela fica com RLS ligada e SEM políticas, e sem acesso para anon/
-- authenticated: só a chave de serviço (a função) e o agendador a conseguem ler.
--
-- É seguro rodar mais de uma vez.

create table if not exists public.cron_secret (
  id int primary key default 1 check (id = 1),
  value text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

alter table public.cron_secret enable row level security;
revoke all on public.cron_secret from anon, authenticated;

insert into public.cron_secret (id) values (1) on conflict (id) do nothing;

-- Faz o agendamento diário enviar o cabeçalho (sem mexer na chave que já lá está).
do $$
declare
  j record;
begin
  select jobid, command into j from cron.job where jobname = 'send-note-reminders-daily';
  if found and position('x-cron-secret' in j.command) = 0 then
    perform cron.alter_job(
      job_id := j.jobid,
      command := regexp_replace(
        j.command,
        'jsonb_build_object\(',
        'jsonb_build_object(''x-cron-secret'', (select value from public.cron_secret where id = 1), '
      )
    );
  end if;
end $$;
