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
    partner_id: s.partnerId || null,
    start_date: s.startDate || null,
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
    partnerId: row.partner_id || null,
    startDate: row.start_date || "",
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
  toDbClient, fromDbClient,
  toDbStaff, fromDbStaff,
  toDbCompanySettings, fromDbCompanySettings,
};