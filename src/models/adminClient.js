// Cliente Supabase da página de administração (/admin). É um cliente À PARTE
// do do app: guarda a sessão noutra chave e só na sessão do separador
// (sessionStorage) — fechar o separador termina a sessão de administração, e
// entrar aqui nunca mexe na sessão de uma empresa neste mesmo navegador.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const adminConfigured = Boolean(url && anonKey);

function tabStorage() {
  try {
    const s = window.sessionStorage;
    s.setItem("__t", "1"); s.removeItem("__t");
    return s;
  } catch {
    const mem = {};
    return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  }
}

export const adminClient = adminConfigured
  ? createClient(url, anonKey, {
      auth: { storage: tabStorage(), storageKey: "servix-admin-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
