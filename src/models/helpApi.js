// Envio de pedidos de ajuda (função `submit_help_report`, supabase/ajuda.sql). A empresa e o
// e-mail de quem pede vêm do login no banco — o app só diz o tipo, a mensagem, a página e o aparelho.
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { isMissingRpc } from "./horasSync.js";

export const HELP_KINDS = ["problem", "support", "idea"];

// Resumo curto do aparelho (para a equipa reproduzir um erro): app instalada ou navegador,
// tamanho do ecrã e o navegador/sistema em poucas palavras.
export function deviceSummary() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "?";
  const browser = /edg\//i.test(ua) ? "Edge" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "?";
  let standalone = false;
  try { standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { /* sem matchMedia */ }
  const size = typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "";
  return `${standalone ? "app" : "browser"} · ${os} · ${browser} · ${size}`;
}

// Devolve { ok: true } ou { ok: false, reason: "too_many" | "invalid" | "missing" | "generic" }.
// Sem Supabase (demonstração) devolve { ok: true, demo: true } sem enviar nada.
export async function submitHelpReport({ kind, message, screen, role, lang, authorName }) {
  if (!isSupabaseConfigured || !supabase) return { ok: true, demo: true };
  const { error } = await supabase.rpc("submit_help_report", {
    p_kind: kind, p_message: message, p_screen: screen || null, p_role: role || null,
    p_lang: lang || null, p_author_name: authorName || null, p_device: deviceSummary() || null,
  });
  if (!error) return { ok: true };
  const msg = error.message || "";
  if (msg.includes("too_many")) return { ok: false, reason: "too_many" };
  if (msg.includes("invalid_message") || msg.includes("invalid_kind")) return { ok: false, reason: "invalid" };
  if (isMissingRpc(error)) return { ok: false, reason: "missing" };
  return { ok: false, reason: "generic" };
}
