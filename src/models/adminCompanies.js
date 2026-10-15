// Funções puras da página de administração (/admin): sem browser, sem Supabase
// (por isso dá para testar em Node). A página é só em português — é uma
// ferramenta interna do dono da plataforma, não do app das empresas.
import { SOON_DAYS, formatIsoDate } from "./companyContext.js";

// Nome → sugestão de código: "Limpezas Águia & Filhos, Lda" → "limpezas-aguia-filhos-lda".
export function slugify(name) {
  const s = String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return s;
}

export function isValidCode(code) {
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(code || "");
}
export function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim());
}

const pad = (n) => String(n).padStart(2, "0");

// Hoje (AAAA-MM-DD) num fuso horário; `now` só existe para os testes.
export function todayIso(timezone = "Europe/Brussels", now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const g = (t) => parts.find((p) => p.type === t).value;
    return `${g("year")}-${g("month")}-${g("day")}`;
  } catch {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

// Soma meses a uma data AAAA-MM-DD; dia 31 + 1 mês = último dia do mês seguinte.
export function addMonths(iso, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
  const total = mo + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

// Renovar: continua a partir do fim da validade se ainda está valida; se já
// acabou (ou nunca teve prazo), conta a partir de hoje.
export function renewedUntil(validUntil, today, months) {
  const base = validUntil && validUntil >= today ? validUntil : today;
  return addMonths(base, months);
}

// Arquivada = na lixeira (multi_empresa_arquivo.sql). Um banco sem esse SQL não
// traz `archivedAt`, e então nenhuma empresa conta como arquivada.
export function isArchived(c) {
  return c != null && c.archivedAt != null;
}
// Só uma empresa suspensa pode ir para as arquivadas, e a primeira empresa (id 1)
// nunca (o banco também recusa).
export const PROTECTED_COMPANY_ID = 1;
export function canArchive(c) {
  return c != null && c.suspended === true && !isArchived(c) && c.id !== PROTECTED_COMPANY_ID;
}

// Estado → rótulo e tom (cores) para o cartão.
//   tone: "ok" | "warn" | "bad" | "off"
export function stateInfo(c) {
  const dl = c.daysLeft;
  if (isArchived(c)) return { label: "Arquivada", tone: "off", rank: 7 };
  if (c.state === "suspended") return { label: "Suspensa", tone: "off", rank: 5 };
  if (c.state === "expired") return { label: "Vencida", tone: "bad", rank: 4 };
  if (c.state === "grace") return { label: `Em tolerância (venceu há ${Math.abs(dl ?? 0)} d)`, tone: "bad", rank: 3 };
  if (c.state === "active") {
    if (c.validUntil == null) return { label: "Sem prazo", tone: "ok", rank: 0 };
    if (dl != null && dl <= SOON_DAYS) return { label: dl <= 0 ? "Acaba hoje" : dl === 1 ? "Acaba amanhã" : `Acaba em ${dl} dias`, tone: "warn", rank: 2 };
    return { label: "Ativa", tone: "ok", rank: 1 };
  }
  return { label: c.state || "—", tone: "off", rank: 6 };
}

// Ordem da lista: primeiro o que precisa de atenção (em tolerância, vencidas,
// a acabar), depois as ativas, as sem prazo e, no fim, as suspensas.
export function sortCompanies(list) {
  const order = (c) => {
    const i = stateInfo(c);
    if (c.state === "grace") return 0;
    if (c.state === "expired") return 1;
    if (i.tone === "warn") return 2;
    if (isArchived(c)) return 6;
    if (c.state === "suspended") return 5;
    return c.validUntil == null ? 4 : 3;
  };
  return [...list].sort((a, b) => order(a) - order(b) || String(a.name).localeCompare(String(b.name), "pt"));
}

// Filtros da lista.
export const FILTERS = [
  { key: "all", label: "Todas", test: (c) => !isArchived(c) },
  { key: "active", label: "Ativas", test: (c) => !isArchived(c) && c.state === "active" },
  { key: "soon", label: "A acabar", test: (c) => !isArchived(c) && c.state === "active" && c.validUntil != null && c.daysLeft != null && c.daysLeft <= SOON_DAYS },
  { key: "grace", label: "Em tolerância", test: (c) => !isArchived(c) && c.state === "grace" },
  { key: "expired", label: "Vencidas", test: (c) => !isArchived(c) && c.state === "expired" },
  { key: "suspended", label: "Suspensas", test: (c) => !isArchived(c) && c.state === "suspended" },
  { key: "archived", label: "Arquivadas", test: (c) => isArchived(c) },
];

export function filterCompanies(list, filterKey, query) {
  const f = FILTERS.find((x) => x.key === filterKey) || FILTERS[0];
  const q = String(query || "").trim().toLowerCase();
  return list.filter((c) => f.test(c) && (!q || [c.name, c.code, c.managerEmail].some((v) => String(v || "").toLowerCase().includes(q))));
}

// Erros do banco / da função (mensagens fixas) → português.
const ERRORS = {
  code_taken: "Já existe uma empresa com este código.",
  email_taken: "Este e-mail já está em uso (é de outra empresa ou de um funcionário).",
  invalid_code: "Código inválido: use 2 a 31 letras minúsculas, números ou hífen.",
  invalid_name: "Escreva o nome da empresa.",
  invalid_email: "E-mail da gerência inválido.",
  invalid_timezone: "Fuso horário inválido.",
  invalid_date: "Data de validade inválida.",
  not_found: "Empresa não encontrada.",
  not_suspended: "Só uma empresa suspensa pode ser excluída. Suspenda-a primeiro.",
  not_archived: "A empresa não está nas arquivadas.",
  protected_company: "Esta empresa está protegida e não pode ser excluída.",
  confirm_mismatch: "O código digitado não é o da empresa.",
  archived: "A empresa está arquivada: restaure-a antes de a alterar.",
  sql_arquivo_em_falta: "O SQL de arquivar empresas (multi_empresa_arquivo.sql) ainda não foi aplicado neste projeto.",
  forbidden: "Esta conta não pode fazer isto.",
  "sem permissão": "Esta conta não tem acesso à administração.",
};
export function errorMessage(err) {
  const raw = typeof err === "string" ? err : (err && (err.message || err.error)) || "";
  const key = Object.keys(ERRORS).find((k) => raw === k || raw.includes(k));
  return key ? ERRORS[key] : (raw ? `Erro: ${raw}` : "Não foi possível concluir. Tente novamente.");
}

// Mensagem pronta para enviar à gerência de uma empresa nova.
export function deliveryMessage({ name, link, code, email, password }) {
  return [
    `Olá! O acesso da ${name} ao Servix está pronto.`,
    "",
    `Endereço: ${link}`,
    `Código da empresa: ${code}`,
    `E-mail: ${email}`,
    `Palavra-passe temporária: ${password}`,
    "",
    "No primeiro acesso vai escolher a sua própria palavra-passe. Depois, em Acessos, cria os logins dos funcionários.",
  ].join("\n");
}

export function accessLink(origin, code) {
  return `${String(origin || "").replace(/\/+$/, "")}/?e=${code}`;
}

export { formatIsoDate };
