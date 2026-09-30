// Cria/atualiza contas reais no Supabase Auth (login com email + senha) a
// partir dos dados já gravados nas tabelas "company_settings" e "staff".
//
// Como usar:
//   1. Rode supabase/schema.sql (se ainda não rodou).
//   2. No app, abra Definições e defina uma senha real para a empresa; abra
//      Acessos e defina uma senha real (mín. 6 caracteres) para cada
//      funcionário que vai ter login próprio. Quem ficar com a senha de
//      demonstração ("••••••••") ou em branco é ignorado por este script.
//   3. Neste ficheiro .env.local, adicione (além das duas variáveis
//      VITE_SUPABASE_*) uma terceira: SUPABASE_SERVICE_ROLE_KEY — a chave
//      "secret" do projeto (Project Settings → API Keys → Secret keys).
//      Repare que esta NÃO tem o prefixo VITE_ de propósito: assim o Vite
//      nunca a inclui no código que vai para o navegador. Nunca partilhe
//      essa chave nem a publique num repositório público.
//   4. Rode: node scripts/setup-auth.mjs
//   5. Só depois disso rode supabase/enable_auth_rls.sql no SQL Editor.
//
// Seguro rodar mais de uma vez: contas que já existem têm a senha
// sincronizada com a que está gravada agora, em vez de dar erro.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function loadEnvLocal() {
  const envPath = join(rootDir, ".env.local");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const fileEnv = loadEnvLocal();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltam variáveis. Confirme que o .env.local tem VITE_SUPABASE_URL e " +
    "SUPABASE_SERVICE_ROLE_KEY (esta última é a chave \"secret\" do projeto, " +
    "não a publishable/anon)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PLACEHOLDER = "••••••••";

function isUsablePassword(pw) {
  return typeof pw === "string" && pw.length >= 6 && pw !== DEMO_PLACEHOLDER;
}

async function upsertAuthUser(email, password, label) {
  if (!email) {
    console.warn(`  ⚠ ${label}: sem email definido — a ignorar.`);
    return;
  }
  if (!isUsablePassword(password)) {
    console.warn(`  ⚠ ${label} (${email}): ainda não tem uma senha real (mín. 6 caracteres) — defina uma no app e rode este script de novo. A ignorar por agora.`);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) {
    console.log(`  ✓ ${label} (${email}): conta criada.`);
    return;
  }

  if (/already been registered|already exists/i.test(error.message || "")) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      console.error(`  ✗ ${label} (${email}): erro ao procurar conta existente:`, listErr.message);
      return;
    }
    const existing = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (!existing) {
      console.error(`  ✗ ${label} (${email}): o Supabase diz que já existe, mas não foi encontrada na lista.`);
      return;
    }
    const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (updErr) console.error(`  ✗ ${label} (${email}): erro ao sincronizar senha:`, updErr.message);
    else console.log(`  ✓ ${label} (${email}): já existia — senha sincronizada.`);
    return;
  }

  console.error(`  ✗ ${label} (${email}): erro ao criar conta:`, error.message);
}

async function run() {
  const { data: settings, error: settingsErr } = await supabase
    .from("company_settings").select("*").eq("id", 1).maybeSingle();
  if (settingsErr) throw settingsErr;

  console.log("A criar/atualizar a conta da gerência...");
  if (settings) await upsertAuthUser(settings.email, settings.password, "Gerência");

  const { data: staffRows, error: staffErr } = await supabase.from("staff").select("*");
  if (staffErr) throw staffErr;

  console.log(`A criar/atualizar contas de ${staffRows.length} funcionário(s)...`);
  for (const s of staffRows) {
    await upsertAuthUser(s.email, s.password, s.name);
  }

  console.log("Pronto! Contas de login reais sincronizadas com o Supabase Auth.");
}

run().catch((err) => {
  console.error("Falhou:", err.message || err);
  process.exit(1);
});