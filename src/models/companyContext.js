// Várias empresas no mesmo banco (ver supabase/multi_empresa.sql).
//
// Este módulo concentra o que o app precisa de saber sobre "qual empresa":
//   * o CÓDIGO da empresa (ex.: "lea"), que a pessoa escreve uma vez por
//     aparelho antes do login e fica guardado — também pode vir num link
//     (`?e=lea`);
//   * o ESTADO da assinatura (ativa, em tolerância, vencida, suspensa), lido
//     do banco depois do login;
//   * a regra de INATIVIDADE da gerência (volta a pedir a palavra-passe);
//   * mensagens "de passagem" que sobrevivem ao recarregamento da página.
// Tudo o que mexe no browser (localStorage, sessionStorage, URL) está
// protegido: modo privado ou armazenamento bloqueado nunca quebram o app.
import { isMissingRpc } from "./horasSync.js";

// WhatsApp do suporte (renovações e dúvidas).
export const SUPPORT_WHATSAPP = "+32 465 39 46 04";
const SUPPORT_WHATSAPP_DIGITS = "32465394604";
export function supportWhatsappUrl(message) {
  return `https://wa.me/${SUPPORT_WHATSAPP_DIGITS}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

// A gerência (gerência, gerência-supervisor e a conta da empresa) volta a
// pedir a palavra-passe depois de tanto tempo sem usar o app.
export const IDLE_MINUTES = 30;
// A gerência é avisada a partir de tantos dias antes de a assinatura acabar.
export const SOON_DAYS = 14;

const CODE_KEY = "servix_company";
const ACTIVITY_KEY = "servix_last_active";
const FLASH_KEY = "servix_flash";

// ── Código da empresa ──────────────────────────────────────────────────────
// Mesmo formato que o banco aceita: letras minúsculas, números e hífen.
export function normalizeCompanyCode(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}
export function isValidCompanyCode(code) {
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(code || "");
}

function safeStorage(kind) {
  try {
    const s = typeof window !== "undefined" ? window[kind] : null;
    return s || null;
  } catch { return null; }
}

export function getStoredCompanyCode() {
  try {
    const v = normalizeCompanyCode(safeStorage("localStorage")?.getItem(CODE_KEY));
    return isValidCompanyCode(v) ? v : null;
  } catch { return null; }
}
export function storeCompanyCode(code) {
  try { safeStorage("localStorage")?.setItem(CODE_KEY, code); } catch { /* sem armazenamento: o código só não fica guardado */ }
}
export function clearStoredCompanyCode() {
  try { safeStorage("localStorage")?.removeItem(CODE_KEY); } catch { /* ignora */ }
}

// Link com o código dentro (https://…/?e=lea): guarda-o e tira-o do endereço.
// Chamado uma vez, ao carregar a página (fora do React — assim o StrictMode
// não o executa duas vezes).
export function consumeUrlCompanyCode() {
  try {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("e");
    if (raw == null) return null;
    url.searchParams.delete("e");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    const code = normalizeCompanyCode(raw);
    if (!isValidCompanyCode(code)) return null;
    storeCompanyCode(code);
    return code;
  } catch { return null; }
}

// ── Chamadas ao banco ──────────────────────────────────────────────────────
// O código existe? (função aberta a qualquer pessoa; só responde sim/não.)
//   { kind: "ok", found, legacy? } | { kind: "error" }
// `legacy`: o SQL de várias empresas ainda não está neste projeto → não há
// código a validar (o app continua a funcionar como antes, com uma empresa).
export async function lookupCompany(client, code) {
  try {
    const { data, error } = await client.rpc("company_lookup", { p_code: code });
    if (error) {
      if (isMissingRpc(error)) return { kind: "ok", found: true, legacy: true };
      return { kind: "error" };
    }
    return { kind: "ok", found: data?.found === true };
  } catch { return { kind: "error" }; }
}

// Estado da empresa de quem está com sessão iniciada (funciona também com a
// assinatura vencida — é por aqui que o app sabe o que mostrar).
//   { kind: "status", status } | { kind: "legacy" } | { kind: "error" }
export async function fetchCompanyStatus(client) {
  try {
    const { data, error } = await client.rpc("my_company_status");
    if (error) {
      if (isMissingRpc(error)) return { kind: "legacy" };
      return { kind: "error" };
    }
    if (!data || typeof data.state !== "string") return { kind: "error" };
    return { kind: "status", status: data };
  } catch { return { kind: "error" }; }
}

export function isBlockedState(state) {
  return state === "expired" || state === "suspended";
}

// Aviso a mostrar (ou null). A gerência vê o aviso de "acaba em breve" e o de
// tolerância; os restantes só veem o de tolerância (mais discreto).
//   { kind: "soon" | "grace", daysLeft, validUntil }
export function companyNotice(status, isManager) {
  if (!status || status.validUntil == null) return null;
  if (status.state === "grace") {
    const left = Number.isFinite(status.graceDaysLeft) ? Math.max(1, status.graceDaysLeft) : 1;
    return { kind: "grace", daysLeft: left, validUntil: status.validUntil };
  }
  if (status.state === "active" && isManager && Number.isFinite(status.daysLeft) && status.daysLeft >= 0 && status.daysLeft <= SOON_DAYS) {
    return { kind: "soon", daysLeft: status.daysLeft, validUntil: status.validUntil };
  }
  return null;
}

// "2026-11-30" → "30/11/2026"
export function formatIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// ── Papéis ─────────────────────────────────────────────────────────────────
// Quem é "gerência" para efeitos de segurança (saída por inatividade).
export function isManagerRole(role) {
  return role === "company" || role === "gerencia" || role === "gerencia_supervisor";
}

// Papel da conta com sessão: "company" (login da empresa), o papel do
// funcionário, ou null se não corresponde a ninguém.
export function sessionRole(sessionEmail, companyEmail, staffList) {
  const email = String(sessionEmail || "").toLowerCase();
  if (companyEmail && email === String(companyEmail).toLowerCase()) return "company";
  const s = (staffList || []).find((x) => String(x.email || "").toLowerCase() === email);
  return s ? s.role : null;
}

// ── Inatividade ────────────────────────────────────────────────────────────
export function markActive(now = Date.now()) {
  try { safeStorage("localStorage")?.setItem(ACTIVITY_KEY, String(now)); } catch { /* ignora */ }
}
export function lastActiveAt() {
  try {
    const v = Number(safeStorage("localStorage")?.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}
export function clearActivity() {
  try { safeStorage("localStorage")?.removeItem(ACTIVITY_KEY); } catch { /* ignora */ }
}
// Passou do limite sem atividade? Sem registo nenhum não conta como inativo.
export function idleExceeded(now = Date.now(), minutes = IDLE_MINUTES) {
  const last = lastActiveAt();
  return last != null && now - last > minutes * 60000;
}

// Se o pedido de saída ao servidor falhar (sem rede), a sessão ficaria guardada
// no aparelho. Esta função apaga-a à força: só mexe nas chaves de sessão do
// Supabase (`sb-…-auth-token`), nada mais.
export function forceLocalSignOut() {
  try {
    const s = safeStorage("localStorage");
    if (!s) return;
    const keys = [];
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && /^sb-.*-auth-token/.test(k)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch { /* ignora */ }
}

// ── Mensagem que sobrevive ao recarregamento ──────────────────────────────
// Depois de sair da empresa (inatividade, assinatura vencida…) a página
// recarrega para não deixar dados da empresa na memória; a razão fica aqui
// para o ecrã seguinte a mostrar. Lida e apagada uma única vez.
export function setFlash(flash) {
  try { safeStorage("sessionStorage")?.setItem(FLASH_KEY, JSON.stringify(flash)); } catch { /* ignora */ }
}
export function takeFlash() {
  try {
    const s = safeStorage("sessionStorage");
    const raw = s?.getItem(FLASH_KEY);
    if (!raw) return null;
    s.removeItem(FLASH_KEY);
    const v = JSON.parse(raw);
    return v && typeof v.type === "string" ? v : null;
  } catch { return null; }
}
