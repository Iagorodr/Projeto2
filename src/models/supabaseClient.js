// Cliente Supabase do app (lado do browser). As chaves vêm de variáveis de
// ambiente do Vite (ficheiro .env.local, nunca commitado — ver .env.example).
// Se não estiverem definidas, o app continua a funcionar normalmente com os
// dados de demonstração em memória (models/data.js), só sem persistência.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Empresa de DEMONSTRAÇÃO (para mostrar a clientes novos): /demo, ou o código
// "demo"/"teste" no ecrã da empresa, liga o modo demonstração só neste separador
// (sessionStorage). O app corre então com dados gerados para hoje, sem ler nem
// gravar nada no Supabase. "Sair da demonstração" volta ao normal.
const DEMO_KEY = "servix_demo";
const DEMO_CODES = ["demo", "teste"];
function detectDemo() {
  try {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path === "/demo") { sessionStorage.setItem(DEMO_KEY, "1"); return true; }
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch { return false; }
}
const isDemoMode = typeof window !== "undefined" && detectDemo();
function isDemoCode(code) { return DEMO_CODES.includes(String(code || "").trim().toLowerCase()); }
function enterDemo() { try { sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* ignora */ } window.location.assign("/demo"); }
function exitDemo() { try { sessionStorage.removeItem(DEMO_KEY); } catch { /* ignora */ } window.location.assign("/"); }

const isSupabaseConfigured = Boolean(url && anonKey) && !isDemoMode;

const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

export { supabase, isSupabaseConfigured, isDemoMode, isDemoCode, enterDemo, exitDemo };
