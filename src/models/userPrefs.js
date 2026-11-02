// Preferências de cada pessoa (ex.: ordem e blocos ocultos do Dashboard).
// Guardadas no Supabase (redesign_b1.sql: my_prefs / set_my_prefs) e, sempre,
// também neste aparelho — assim funciona mesmo antes de o SQL estar aplicado
// ou sem rede.
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

const LOCAL_KEY = "servix.prefs";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; } catch { return {}; }
}
function writeLocal(p) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch { /* ignora */ }
}

export function localPrefs() { return readLocal(); }

export async function loadPrefs() {
  const local = readLocal();
  if (!isSupabaseConfigured || !supabase) return local;
  try {
    const { data, error } = await supabase.rpc("my_prefs");
    if (error || !data || typeof data !== "object") return local;
    const merged = { ...local, ...data };
    writeLocal(merged);
    return merged;
  } catch { return local; }
}

export async function savePrefs(patch) {
  writeLocal({ ...readLocal(), ...patch });
  if (!isSupabaseConfigured || !supabase) return;
  try { await supabase.rpc("set_my_prefs", { p_patch: patch }); } catch { /* fica só local */ }
}
