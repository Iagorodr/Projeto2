-- ARMAZENAMENTO DE FOTOS E FICHEIROS (recibos, fotos de avisos, documentos de
-- clientes e de funcionários). Só ADITIVO: não altera nem apaga nada que já existe.
--
-- Corre uma vez no SQL Editor, ANTES de publicar a versão do app que usa isto
-- (a versão nova grava a coluna `documents`; sem ela a gravação de clientes e
-- funcionários falharia). Pode ser repetido sem problema (idempotente).
--
-- O que cria:
--   1. Colunas `documents` (jsonb) em `clients` e `staff` — guardam, para cada um
--      dos 4 espaços de documentos, {name, path, size, type[, validUntil]}.
--   2. O "cofre" `servix-files` (Storage): PRIVADO (nunca há link público),
--      máximo 10 MB por ficheiro, só imagens, PDF, Word e Excel.
--   3. Regras de acesso por empresa. Os ficheiros ficam em pastas
--        <empresa>/receipts/<funcionário>/...   recibos de despesas
--        <empresa>/avisos/...                   fotos de reclamações/elogios/avisos
--        <empresa>/docs-clients/...             documentos de clientes
--        <empresa>/docs-staff/...               documentos de funcionários
--      e quem pode o quê:
--        gerência ............ tudo da SUA empresa (ler, enviar, apagar)
--        funcionário ......... recibos: só os seus (ler/enviar/apagar);
--                              fotos de avisos: ler (os avisos aparecem-lhe na app);
--                              documentos de clientes/funcionários: nada
--        supervisor .......... como o funcionário + enviar fotos de avisos
--      Outra empresa nunca vê nada, e uma empresa com a assinatura vencida
--      também deixa de aceder (igual às tabelas).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Colunas dos documentos
-- ─────────────────────────────────────────────────────────────────────────
alter table public.clients add column if not exists documents jsonb not null default '[null,null,null,null]'::jsonb;
alter table public.staff   add column if not exists documents jsonb not null default '[null,null,null,null]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. O cofre (privado)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'servix-files', 'servix-files', false, 10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Regras de acesso
-- ─────────────────────────────────────────────────────────────────────────
-- p_mode: 'read' | 'write' (enviar) | 'delete'.
-- O caminho tem sempre a forma  <empresa>/<tipo>/[<funcionário>/]<ficheiro>.
create or replace function private.can_access_file(p_name text, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  cid integer;
begin
  if p_name is null or p_mode not in ('read', 'write', 'delete') then
    return false;
  end if;
  cid := private.my_company_id();
  if cid is null or not private.company_ok() then
    return false;
  end if;
  parts := storage.foldername(p_name);
  -- primeira pasta = a empresa de quem pede (nunca outra)
  if parts[1] is distinct from cid::text then
    return false;
  end if;
  -- gerência: tudo da própria empresa
  if private.is_manager() then
    return array_length(parts, 1) >= 2 and parts[2] in ('receipts', 'avisos', 'docs-clients', 'docs-staff');
  end if;
  -- funcionário / supervisor
  if parts[2] = 'receipts' then
    return parts[3] is not null and parts[3] = private.my_staff_id()::text;
  elsif parts[2] = 'avisos' then
    return p_mode = 'read' or (p_mode = 'write' and private.my_staff_role() = 'supervisor');
  end if;
  return false;
end;
$$;

grant execute on function private.can_access_file(text, text) to authenticated;

drop policy if exists servix_files_select on storage.objects;
drop policy if exists servix_files_insert on storage.objects;
drop policy if exists servix_files_delete on storage.objects;

create policy servix_files_select on storage.objects for select to authenticated
  using (bucket_id = 'servix-files' and (select private.can_access_file(name, 'read')));

create policy servix_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'servix-files' and (select private.can_access_file(name, 'write')));

create policy servix_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'servix-files' and (select private.can_access_file(name, 'delete')));
-- (sem política de update: os ficheiros nunca são reescritos, só substituídos por outro novo)
