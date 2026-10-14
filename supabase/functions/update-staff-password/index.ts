// Cria ou redefine a senha de login REAL (Supabase Auth) de um funcionário
// ou da própria empresa (gerência). É a versão "callable a partir do ecrã"
// do que scripts/setup-auth.mjs já faz à mão, com uma verificação a mais
// que o script não precisava: confirmar QUEM está a chamar.
//
// Segurança (spec 4.10 + multi-empresa): não existe claim "é gerência" no
// token — a identidade "gerência" e a empresa vivem nas tabelas do banco. A
// permissão é decidida pela função SQL can_manage_login(email), chamada com o
// JWT de quem pediu (a identidade vem de auth.getUser(), nunca do corpo do
// pedido): só passa quem é gerência da empresa do email alvo, com a assinatura
// da empresa em dia. Só depois disso se usa a chave de serviço.
// Requer multi_empresa.sql + multi_empresa_funcoes.sql aplicados.
//
// Body esperado: { email: string, newPassword?: string }
//   - email: a conta a criar/redefinir (pode ser a do próprio chamador).
//   - newPassword: opcional. Se vier (mín. 6 caracteres), usa esse valor —
//     é o caso de alguém a escolher a própria senha nova (Definições). Se
//     não vier, a função GERA uma senha aleatória e devolve-a uma única vez
//     — é o caso do botão "Redefinir" em Acessos, e de criar conta nova.

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

// Senha aleatória de 10 caracteres, sem símbolos ambíguos (0/O, 1/l/I) —
// pensada pra ser lida/ditada em voz alta ao entregar a um funcionário.
function generatePassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  let body: { email?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const targetEmail = (body.email || "").trim().toLowerCase();
  if (!targetEmail) return json({ error: "missing_email" }, 400);

  // 1) Quem está mesmo a chamar (o gateway já validou o JWT, mas getUser()
  // confirma e devolve o email real da sessão — nunca o do corpo do pedido).
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user?.email) return json({ error: "invalid_session" }, 401);

  // 2) Pode mexer neste login? A decisão vive no banco (função can_manage_login,
  // chamada com o token de quem pediu): é gerência da sua empresa (email das
  // definições, role 'gerencia' ou 'gerencia_supervisor' — a mesma definição das
  // políticas de RLS), a assinatura da empresa está em dia, e o email alvo
  // pertence a alguém DA MESMA empresa. Contas fora das empresas (ex.: a do
  // administrador da plataforma) e logins de outras empresas ficam de fora.
  const { data: allowed, error: permErr } = await callerClient.rpc("can_manage_login", { p_email: targetEmail });
  if (permErr) return json({ error: "lookup_failed", detail: permErr.message }, 500);
  if (allowed !== true) return json({ error: "forbidden" }, 403);

  // A chave de serviço só entra depois da autorização, para criar/atualizar a conta no Auth.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3) Autorizado. Gera (ou usa) a senha e aplica no Auth — cria a conta se
  // ainda não existir, senão atualiza a senha da que já existe. Mesma
  // sequência de scripts/setup-auth.mjs.
  const usingGeneratedPassword = !(body.newPassword && body.newPassword.length >= 6);
  const newPassword = usingGeneratedPassword ? generatePassword() : body.newPassword!;

  const { error: createErr } = await admin.auth.admin.createUser({
    email: targetEmail,
    password: newPassword,
    email_confirm: true,
    // Senha gerada pela gerência é temporária: a pessoa é obrigada a trocá-la no primeiro login.
    user_metadata: { must_change_password: usingGeneratedPassword },
  });
  if (!createErr) {
    return json({ email: targetEmail, password: newPassword, created: true });
  }

  if (!/already been registered|already exists/i.test(createErr.message || "")) {
    return json({ error: "create_failed", detail: createErr.message }, 500);
  }

  // Procura a conta pelo email, página a página (com várias empresas a lista
  // já pode passar de 1000 contas).
  let existing: { id: string; email?: string; user_metadata?: Record<string, unknown> } | undefined;
  for (let page = 1; page <= 50 && !existing; page += 1) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr) return json({ error: "lookup_failed", detail: listErr.message }, 500);
    existing = list.users.find((u) => (u.email || "").toLowerCase() === targetEmail);
    if (list.users.length < 1000) break;
  }
  if (!existing) return json({ error: "account_not_found" }, 404);

  const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
    password: newPassword,
    user_metadata: { ...(existing.user_metadata || {}), must_change_password: usingGeneratedPassword },
  });
  if (updErr) return json({ error: "update_failed", detail: updErr.message }, 500);

  return json({ email: targetEmail, password: newPassword, created: false });
});
