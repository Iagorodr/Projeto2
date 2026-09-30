// Popula o Supabase com os mesmos dados de demonstração que o app já usa
// (models/data.js + models/seedHistory.js), para a transição para o banco
// de dados real ser invisível — os dados continuam os mesmos.
//
// Como usar:
//   1. Rode supabase/schema.sql uma vez no SQL Editor do seu projeto Supabase.
//   2. Crie um ficheiro .env.local na raiz do projeto (copie .env.example) com
//      VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do seu projeto.
//   3. Rode: node scripts/seed-supabase.mjs
//
// É seguro rodar mais de uma vez — clientes e funcionários são upsert (por
// id), e as linhas únicas (definições/app_data) são substituídas por igual.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_HORAS,
  INITIAL_MISSING, INITIAL_SENT,
} from "../src/models/data.js";
import { INITIAL_CLOSED_PERIODS } from "../src/models/seedHistory.js";
import { toDbClient, toDbStaff } from "../src/models/dbMappers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Lê .env.local à mão (sem depender do pacote "dotenv") — só as duas
// variáveis que interessam aqui.
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
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n" +
    "Defina-as em .env.local (copie .env.example) ou exporte-as no terminal antes de rodar este script."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("A gravar clientes...");
  {
    const { error } = await supabase.from("clients").upsert(INITIAL_CLIENTS.map(toDbClient));
    if (error) throw error;
  }

  console.log("A gravar funcionários...");
  {
    const { error } = await supabase.from("staff").upsert(INITIAL_STAFF.map(toDbStaff));
    if (error) throw error;
  }

  console.log("A gravar definições da empresa...");
  {
    const { error } = await supabase.from("company_settings").update({
      name: "Empresa X",
      email: "empresax@login1.gmail.com",
      password: "",
      photo_url: null,
      cutoff_day: 20,
      contract_alert_days: 30,
      reclamacao_base_clients: 10,
      reclamacao_excelente_count: 1,
      reclamacao_razoavel_count: 3,
    }).eq("id", 1);
    if (error) throw error;
  }

  console.log("A gravar atribuições, horas, avisos e histórico...");
  {
    const { error } = await supabase.from("app_data").update({
      assignments: INITIAL_ASSIGNMENTS,
      horas_data: INITIAL_HORAS,
      missing_items: INITIAL_MISSING,
      sent_items: INITIAL_SENT,
      closed_periods: INITIAL_CLOSED_PERIODS,
    }).eq("id", 1);
    if (error) throw error;
  }

  console.log("Pronto! Os dados de demonstração estão no Supabase.");
}

run().catch((err) => {
  console.error("Falhou ao gravar no Supabase:", err.message || err);
  process.exit(1);
});
