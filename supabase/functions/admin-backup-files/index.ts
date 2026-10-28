// Backup dos FICHEIROS de uma empresa (fotos de avisos, recibos, documentos de
// clientes e de funcionários): copia-os do cofre `servix-files` para o cofre
// `servix-backups`, mantendo o mesmo caminho (<empresa>/...). Só o administrador da
// plataforma chama isto (botão "Fazer backup agora" em /admin), logo depois de
// guardar a fotografia dos dados (admin_backup_company, em backup.sql).
//
// Segurança: quem chama é validado com o JWT (função SQL is_platform_admin, que só
// devolve true para a tabela platform_admins). Só depois se usa a chave de serviço.
// A empresa vem do corpo do pedido, mas só é usada como pasta (número inteiro).
//
// Regras: copia SÓ o que ainda não está no cofre dos backups e NUNCA apaga nem
// substitui nada. No fim regista o resultado na última fotografia da empresa
// (tabela company_backups), que é o que a página mostra.
//
// Body: { companyId: number }
//   →  { companyId, filesCount, filesTotal, filesCopied, filesBytes, filesAt, partial }
//   filesCount  = ficheiros da empresa que já estão no cofre dos backups
//   filesTotal  = ficheiros da empresa no cofre principal
//   filesCopied = ficheiros copiados agora (os restantes já estavam guardados)
//   partial     = true se ficaram ficheiros por copiar (limite por pedido): clicar outra vez

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SOURCE = "servix-files";
const TARGET = "servix-backups";
const MAX_COPIES_PER_CALL = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type Entry = { path: string; size: number };

// Lista todos os ficheiros debaixo de `prefix` (entra nas subpastas). No Storage,
// uma "pasta" aparece como item sem `id`.
async function listAll(
  // deno-lint-ignore no-explicit-any
  bucket: any,
  prefix: string,
  depth = 0,
): Promise<Entry[]> {
  if (depth > 6) return [];
  const out: Entry[] = [];
  const PAGE = 100;
  for (let offset = 0; offset < 100000; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message || "list_failed");
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = `${prefix}/${item.name}`;
      if (item.id === null || item.id === undefined) {
        out.push(...(await listAll(bucket, full, depth + 1)));
      } else {
        out.push({ path: full, size: Number(item.metadata?.size ?? 0) });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  let body: { companyId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const companyId = Number(body.companyId);
  if (!Number.isInteger(companyId) || companyId < 1) return json({ error: "invalid_company" }, 400);

  // 1) Quem chama é o administrador da plataforma?
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user?.email) return json({ error: "invalid_session" }, 401);
  const { data: isAdmin, error: permErr } = await callerClient.rpc("is_platform_admin");
  if (permErr) return json({ error: "lookup_failed", detail: permErr.message }, 500);
  if (isAdmin !== true) return json({ error: "forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2) Tem de existir uma fotografia dos dados (a página tira-a primeiro).
  const { data: latest, error: latestErr } = await admin
    .from("company_backups")
    .select("id")
    .eq("company_id", companyId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) return json({ error: "lookup_failed", detail: latestErr.message }, 500);
  if (!latest) return json({ error: "no_data_backup" }, 409);

  try {
    // 3) O que há na empresa e o que já está guardado.
    const source = await listAll(admin.storage.from(SOURCE), String(companyId));
    const have = new Set((await listAll(admin.storage.from(TARGET), String(companyId))).map((e) => e.path));
    const missing = source.filter((e) => !have.has(e.path));

    // 4) Copia o que falta (nunca apaga nem substitui).
    let copied = 0;
    for (const e of missing.slice(0, MAX_COPIES_PER_CALL)) {
      const { error } = await admin.storage.from(SOURCE).copy(e.path, e.path, { destinationBucket: TARGET });
      if (error && !/already exists|duplicate/i.test(error.message || "")) {
        return json({ error: "copy_failed", detail: `${e.path}: ${error.message}` }, 500);
      }
      if (!error) copied += 1;
    }
    const partial = missing.length > MAX_COPIES_PER_CALL;

    // 5) Regista o resultado na última fotografia (a página mostra isto).
    const filesAt = new Date().toISOString();
    const notCopied = new Set(missing.slice(MAX_COPIES_PER_CALL).map((e) => e.path));
    const inBackup = source.filter((e) => !notCopied.has(e.path));
    const stored = inBackup.length;
    const storedBytes = inBackup.reduce((s, e) => s + e.size, 0);
    const { error: updErr } = await admin
      .from("company_backups")
      .update({ files_at: filesAt, files_count: stored, files_copied: copied, files_bytes: storedBytes })
      .eq("id", latest.id);
    if (updErr) return json({ error: "record_failed", detail: updErr.message }, 500);

    return json({ companyId, filesCount: stored, filesTotal: source.length, filesCopied: copied, filesBytes: storedBytes, filesAt, partial });
  } catch (err) {
    return json({ error: "files_failed", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
