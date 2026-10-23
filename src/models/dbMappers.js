// Funções puras de conversão entre as formas usadas no app (camelCase, tal
// como já vinham em models/data.js) e as linhas do Supabase (snake_case).
// Sem dependências de browser/Node — usado tanto pelo app (Vite) como pelo
// script de seed (Node), para as duas nunca poderem divergir.

// "" (campo numérico deixado em branco no formulário) não é um número válido
// para o Postgres — teria de ser um número ou null. Sem isto, gravar um
// cliente novo com "Horas/mês" ou "Valor/hora" em branco falha silenciosamente
// (o erro só aparece no console do navegador) e derruba a gravação inteira.
function numOrNull(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Documentos (4 espaços por cliente/funcionário) <-> coluna jsonb `documents`.
// Cada espaço é {name, path, size, type[, validUntil]} (ver models/fileStorage.js)
// ou null. Nunca vai `dataUrl` (só existe no modo demonstração) e só vale com
// `path` — sem ele o ficheiro não está guardado em lado nenhum.
function refForDb(ref) {
  if (!ref || typeof ref !== "object" || typeof ref.path !== "string" || !ref.path) return null;
  const out = { name: String(ref.name || ""), path: ref.path };
  if (Number.isFinite(ref.size)) out.size = ref.size;
  if (ref.type) out.type = String(ref.type);
  if (ref.validUntil) out.validUntil = String(ref.validUntil);
  return out;
}
function docsForDb(docs) {
  const list = Array.isArray(docs) ? docs : [];
  return [0, 1, 2, 3].map((i) => refForDb(list[i]));
}
function docsFromDb(value) {
  const list = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((i) => {
    const d = list[i];
    return d && typeof d === "object" && d.path ? { ...d } : null;
  });
}

function toDbClient(c) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    city: c.city,
    address: c.address,
    contact: c.contact,
    contract_start: c.contractStart,
    contract_end: c.contractEnd,
    hours_month: numOrNull(c.hoursMonth),
    value_hour: numOrNull(c.valueHour),
    frequency: c.frequency,
    frequency_anchor: c.frequencyAnchor || null,
    availability: c.availability,
    duration: numOrNull(c.duration),
    days: c.days,
    description: c.description,
    priorities: c.priorities,
    note: c.note,
    client_type: c.clientType,
    hours_mode: c.hoursMode || "dividida",
    duration_by_day: c.durationByDay || {},
    client_valid_until: c.clientValidUntil,
    origin: c.origin,
    documents: docsForDb(c.documents),
  };
}

function fromDbClient(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    city: row.city,
    address: row.address,
    contact: row.contact,
    contractStart: row.contract_start,
    contractEnd: row.contract_end,
    hoursMonth: row.hours_month === null ? "" : Number(row.hours_month),
    valueHour: row.value_hour === null ? "" : Number(row.value_hour),
    frequency: row.frequency,
    frequencyAnchor: row.frequency_anchor || "",
    availability: row.availability,
    duration: row.duration,
    days: row.days || [],
    description: row.description || "",
    priorities: row.priorities || "",
    note: row.note || "",
    clientType: row.client_type,
    hoursMode: row.hours_mode || "dividida",
    durationByDay: row.duration_by_day || {},
    clientValidUntil: row.client_valid_until || "",
    origin: row.origin || "",
    documents: docsFromDb(row.documents),
  };
}

// ---- Contratantes (tabela `contractors`, só a gerência lê) ----
function toDbContractor(c) {
  return {
    id: c.id,
    name: c.name,
    color: c.color || null,
    is_direct: !!c.isDirect,
    rate: c.isDirect ? null : numOrNull(c.rate),
    staff_rate: numOrNull(c.staffRate),
    billing_day: numOrNull(c.billingDay),
    payment_days: numOrNull(c.paymentDays),
    contact_name: c.contactName || null,
    email: c.email || null,
    note: c.note || null,
  };
}

function fromDbContractor(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || "#143F35",
    isDirect: !!row.is_direct,
    rate: row.rate === null || row.rate === undefined ? "" : Number(row.rate),
    staffRate: row.staff_rate === null || row.staff_rate === undefined ? "" : Number(row.staff_rate),
    billingDay: row.billing_day === null || row.billing_day === undefined ? "" : Number(row.billing_day),
    paymentDays: row.payment_days === null || row.payment_days === undefined ? "" : Number(row.payment_days),
    contactName: row.contact_name || "",
    email: row.email || "",
    note: row.note || "",
  };
}

// Mês fechado de um contratante (ver models/contractorClosings.js e supabase/contratantes_fecho.sql).
function toDbClosing(r) {
  return {
    id: r.id,
    contractor_id: r.contractorId,
    period_start: r.periodStart || null,
    period_end: r.periodEnd,
    period_label: r.periodLabel || null,
    status: r.status,
    hours: Number(r.hours) || 0,
    rate: numOrNull(r.rate),
    receivable: numOrNull(r.receivable),
    staff_cost: Number(r.staffCost) || 0,
    by_client: r.byClient || [],
    pending: r.pending || null,
    docs: r.docs || [],
    invoiced_on: r.invoicedOn || null,
    received_on: r.receivedOn || null,
    closed_at: r.closedAt || null,
    history: r.history || [],
  };
}

function fromDbClosing(row) {
  const n = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    id: row.id,
    contractorId: row.contractor_id,
    periodStart: row.period_start || null,
    periodEnd: row.period_end,
    periodLabel: row.period_label || "",
    status: row.status,
    hours: Number(row.hours) || 0,
    rate: n(row.rate),
    receivable: n(row.receivable),
    staffCost: Number(row.staff_cost) || 0,
    byClient: row.by_client || [],
    pending: row.pending || null,
    docs: row.docs || [],
    invoicedOn: row.invoiced_on || null,
    receivedOn: row.received_on || null,
    closedAt: row.closed_at || null,
    history: row.history || [],
  };
}

function toDbStaff(s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    contact: s.contact,
    account_type: s.accountType,
    status: s.status,
    valid_until: s.validUntil,
    iban: s.iban,
    role: s.role,
    can_view_all_clients: !!s.canViewAllClients,
    can_expenses: !!s.canExpenses,
    partner_id: s.partnerId || null,
    start_date: s.startDate || null,
    known_clients: Array.isArray(s.knownClients) ? s.knownClients : [],
    documents: docsForDb(s.documents),
  };
}

function fromDbStaff(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    contact: row.contact,
    accountType: row.account_type,
    status: row.status,
    validUntil: row.valid_until || "",
    iban: row.iban || "",
    role: row.role,
    canViewAllClients: !!row.can_view_all_clients,
    canExpenses: !!row.can_expenses,
    partnerId: row.partner_id || null,
    startDate: row.start_date || "",
    knownClients: Array.isArray(row.known_clients) ? row.known_clients : [],
    documents: docsFromDb(row.documents),
  };
}

function toDbCompanySettings({ company, cutoffDay, contractAlertDays, closeDeadlineDays, highlightsMonths, highlightsRealtime, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount }) {
  // Sem `id`: a linha da empresa é escolhida por quem grava (`.eq("id", <empresa>)`).
  return {
    name: company.name,
    email: company.email,
    photo_url: company.photoUrl || null,
    cutoff_day: cutoffDay,
    contract_alert_days: contractAlertDays,
    close_deadline_days: closeDeadlineDays,
    highlights_months: highlightsMonths,
    highlights_realtime: !!highlightsRealtime,
    reclamacao_base_clients: reclamacaoBaseClients,
    reclamacao_excelente_count: reclamacaoExcelenteCount,
    reclamacao_razoavel_count: reclamacaoRazoavelCount,
  };
}

function fromDbCompanySettings(row) {
  return {
    company: { name: row.name, email: row.email, photoUrl: row.photo_url || null },
    cutoffDay: row.cutoff_day,
    contractAlertDays: row.contract_alert_days,
    closeDeadlineDays: row.close_deadline_days ?? 7,
    highlightsMonths: row.highlights_months ?? 3,
    highlightsRealtime: !!row.highlights_realtime,
    reclamacaoBaseClients: row.reclamacao_base_clients,
    reclamacaoExcelenteCount: row.reclamacao_excelente_count,
    reclamacaoRazoavelCount: row.reclamacao_razoavel_count,
  };
}

export {
  refForDb, docsForDb, docsFromDb,
  toDbClient, fromDbClient,
  toDbStaff, fromDbStaff,
  toDbCompanySettings, fromDbCompanySettings,
  toDbContractor, fromDbContractor, toDbClosing, fromDbClosing,
};