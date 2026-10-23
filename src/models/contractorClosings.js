// Fecho do mês por contratante: o mês (período 21→20) de um contratante pode ser FECHADO —
// os valores (horas, a receber, pago aos funcionários, margem) ficam guardados e deixam de
// ser recalculados — e REABERTO (sempre com motivo, que fica guardado).
//
// Um registo ("closing") por contratante e período, guardado na tabela `contractor_periods`
// (supabase/contratantes_fecho.sql). Forma no app:
//   { id, contractorId, periodStart, periodEnd, periodLabel, status: "closed" | "reopened",
//     hours, rate, receivable, staffCost, byClient: [{ clientId, name, hours }],
//     pending: { note, items: [texto] } | null, docs: [ref de ficheiro], invoicedOn, receivedOn,
//     closedAt, history: [{ event, at, by, note? }] }
// `periodEnd` e as datas são ISO "AAAA-MM-DD".
import { reconcileVisits, clientExpectedHours, isoDateStr, dateStrInPeriod, clientById } from "./utils.js";
import { clientsOfContractor } from "./contractors.js";

export function findClosing(closings, contractorId, periodEndIso) {
  return (closings || []).find((c) => String(c.contractorId) === String(contractorId) && c.periodEnd === periodEndIso) || null;
}
export const isClosed = (row) => !!row && row.status === "closed";

// Congela os valores do mês que `stat` (de contractorPeriods) calculou na hora.
export function buildClosing({ contractor, period, existing, clients, pendingItems, note, docs, who, now }) {
  const d = period.contractors.get(contractor.id) || { hours: 0, value: null, staffCost: 0, byClient: new Map() };
  const at = (now || new Date()).toISOString();
  const entry = { event: "closed", at, by: who || "" };
  if (pendingItems && pendingItems.length) entry.note = note;
  return {
    id: existing ? existing.id : Date.now(),
    contractorId: contractor.id,
    periodStart: period.start ? isoDateStr(period.start) : (existing ? existing.periodStart : null),
    periodEnd: period.iso,
    periodLabel: period.rangeLabel,
    status: "closed",
    hours: d.hours,
    rate: contractor.isDirect || !(Number(contractor.rate) > 0) ? null : Number(contractor.rate),
    receivable: d.value,
    staffCost: d.pricedStaffCost != null ? d.pricedStaffCost : d.staffCost, // o custo que corresponde ao valor a receber
    byClient: [...d.byClient.entries()].map(([clientId, hours]) => ({ clientId, name: (clientById(clients, clientId) || {}).name || "—", hours })),
    pending: pendingItems && pendingItems.length ? { note, items: pendingItems } : null,
    docs: docs || (existing ? existing.docs : []) || [],
    invoicedOn: existing ? existing.invoicedOn : null,
    receivedOn: existing ? existing.receivedOn : null,
    closedAt: at,
    history: [...((existing && existing.history) || []), entry],
  };
}

export function reopenClosing(row, reason, who, now) {
  return { ...row, status: "reopened", closedAt: null, invoicedOn: null, receivedOn: null, history: [...(row.history || []), { event: "reopened", at: (now || new Date()).toISOString(), by: who || "", note: reason }] };
}

export function markStage(row, stage, isoDate, who, now) {
  // stage: "invoiced" | "received"; isoDate vazio/null desfaz a marca.
  const key = stage === "invoiced" ? "invoicedOn" : "receivedOn";
  const event = isoDate ? stage : `un${stage}`;
  const next = { ...row, [key]: isoDate || null, history: [...(row.history || []), { event, at: (now || new Date()).toISOString(), by: who || "", note: isoDate || undefined }] };
  if (stage === "invoiced" && !isoDate) next.receivedOn = null; // sem fatura não há recebimento
  return next;
}

export function addDocs(row, docs) { return { ...row, docs: [...(row.docs || []), ...docs] }; }

// O que ainda precisa de atenção antes de fechar o mês deste contratante (só os clientes dele).
// Devolve [{ key, text(lang → texto vem do i18n), count }] como { key, count }.
export function closingPendencies({ contractor, period, clients, horasData, staff, assignments, covers, absences, today, openPeriodIso }) {
  const mine = clientsOfContractor(clients, contractor);
  const ids = new Set(mine.map((c) => c.id));
  const out = [];
  if (!contractor.isDirect && !(Number(contractor.rate) > 0)) out.push({ key: "noRate", count: 1 });
  // Contratante direto: cada cliente com horas neste mês precisa do seu preço de venda.
  const dEntry = period.contractors.get(contractor.id);
  if (contractor.isDirect && dEntry && dEntry.missingPrice) out.push({ key: "noSellPrice", count: dEntry.missingPrice });
  const noStaffRate = mine.filter((c) => !(Number(c.valueHour) > 0)).length;
  if (noStaffRate) out.push({ key: "noStaffRate", count: noStaffRate });
  if (period.iso === openPeriodIso) out.push({ key: "horasOpen", count: 1 });
  let overtime = 0, share = 0;
  Object.values(horasData || {}).forEach((h) => ((h && h.entries) || []).forEach((e) => {
    if (e.voided || !e.clientId || !ids.has(e.clientId) || !dateStrInPeriod(e.date, period)) return;
    if (e.extra && !e.approved) overtime += 1;
    if (e.shareReview) share += 1;
  }));
  if (overtime) out.push({ key: "overtime", count: overtime });
  if (share) out.push({ key: "share", count: share });
  try {
    const rec = reconcileVisits(horasData, clients, { start: period.start, end: period.end }, { staff, assignments, covers, absences }, isoDateStr(today));
    const n = rec.issues.filter((i) => i.clientId != null && ids.has(i.clientId) && i.kind !== "pending" && i.kind !== "repass").length;
    if (n) out.push({ key: "reviews", count: n });
  } catch { /* sem conferência possível: não bloqueia */ }
  return out;
}

// Horas registadas × previstas pela agenda, por cliente deste contratante.
export function crossCheck({ contractor, period, clients, horasData, staff, assignments, covers, absences, today }) {
  const mine = clientsOfContractor(clients, contractor);
  const d = period.contractors.get(contractor.id);
  const ctx = { staff, assignments, covers, absences };
  return mine.map((cl) => {
    const registered = d ? d.byClient.get(cl.id) || 0 : 0;
    let expected = 0;
    try { expected = clientExpectedHours(cl, { start: period.start, end: period.end }, ctx, today).whole; } catch { /* sem agenda */ }
    return { clientId: cl.id, name: cl.name, registered, expected, diff: registered - expected };
  }).filter((r) => r.registered > 0 || r.expected > 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

// Datas de faturação/pagamento reais quando o mês já foi faturado: o prazo conta a partir da data da fatura.
export function paymentDueFromInvoice(contractor, invoicedOnIso) {
  const days = Number(contractor && contractor.paymentDays);
  if (!invoicedOnIso || !(days >= 0) || contractor.paymentDays === "" || contractor.paymentDays == null) return null;
  const [y, m, d] = invoicedOnIso.split("-").map(Number);
  const out = new Date(y, m - 1, d + days);
  return out;
}
