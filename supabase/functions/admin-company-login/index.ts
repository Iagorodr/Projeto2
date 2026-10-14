// Cria ou redefine a palavra-passe de login (Supabase Auth) da GERÊNCIA de uma
// empresa. Só o administrador da plataforma chama isto (página /admin): ao criar
// uma empresa nova, para gerar a palavra-passe temporária que se entrega à
// gerência, ou quando ela perde o acesso.
//
// Segurança: a decisão vive no banco — a função SQL admin_can_set_manager_login
// (multi_empresa_admin.sql) é chamada com o JWT de quem pediu e só devolve true
// para a conta de administração (tabela platform_admins) e quando o e-mail alvo
// é o e-mail da gerência de uma empresa (nunca outro administrador, nem um
// funcionário, nem uma conta sem empresa). Só depois disso se usa a chave de serviço.
//
// Body: { email: string }  →  { email, password, created }
// A palavra-passe é aleatória e temporária (must_change_password = true: a
// gerência é obrigada a trocá-la no primeiro login) e só é devolvida aqui.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

// 12 caracteres, sem símbolos ambíguos (0/O, 1/l/I) — fácil de ditar/copiar.
function generatePassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const targetEmail = (body.email || "").trim().toLowerCase();
  if (!targetEmail) return json({ error: "missing_email" }, 400);

  // 1) Quem chama (o e-mail vem da sessão, nunca do corpo do pedido).
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user?.email) return json({ error: "invalid_session" }, 401);

  // 2) É o administrador, e este e-mail é o da gerência de uma empresa?
  const { data: allowed, error: permErr } = await callerClient.rpc("admin_can_set_manager_login", { p_email: targetEmail });
  if (permErr) return json({ error: "lookup_failed", detail: permErr.message }, 500);
  if (allowed !== true) return json({ error: "forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3) Cria a conta ou, se já existir, troca a palavra-passe.
  const password = generatePassword();
  const { error: createErr } = await admin.auth.admin.createUser({
    email: targetEmail,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (!createErr) return json({ email: targetEmail, password, created: true });

  if (!/already been registered|already exists/i.test(createErr.message || "")) {
    return json({ error: "create_failed", detail: createErr.message }, 500);
  }

  let existing: { id: string; email?: string; user_metadata?: Record<string, unknown> } | undefined;
  for (let page = 1; page <= 50 && !existing; page += 1) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr) return json({ error: "lookup_failed", detail: listErr.message }, 500);
    existing = list.users.find((u) => (u.email || "").toLowerCase() === targetEmail);
    if (list.users.length < 1000) break;
  }
  if (!existing) return json({ error: "account_not_found" }, 404);

  const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    user_metadata: { ...(existing.user_metadata || {}), must_change_password: true },
  });
  if (updErr) return json({ error: "update_failed", detail: updErr.message }, 500);

  return json({ email: targetEmail, password, created: false });
});
