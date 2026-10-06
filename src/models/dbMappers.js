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
    availability: c.availability,
    duration: numOrNull(c.duration),
    days: c.days,
    description: c.description,
    priorities: c.priorities,
    note: c.note,
    client_type: c.clientType,
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
    availability: row.availability,
    duration: row.duration,
    days: row.days || [],
    description: row.description || "",
    priorities: row.priorities || "",
    note: row.note || "",
    clientType: row.client_type,
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
  };
}

function toDbCompanySettings({ company, cutoffDay, contractAlertDays, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount }) {
  return {
    id: 1,
    name: company.name,
    email: company.email,
    photo_url: company.photoUrl || null,
    cutoff_day: cutoffDay,
    contract_alert_days: contractAlertDays,
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