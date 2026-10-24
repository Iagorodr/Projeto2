// Números dos Contratantes: horas e valor a receber por período (21→20), por
// contratante e por cliente. Tudo CALCULADO na hora a partir do que já existe
// (horas dos funcionários, períodos fechados, clientes e contratantes) — nada
// disto é guardado, até ao fecho do mês (etapa seguinte, que congela os valores).
//
// Um cliente pertence a um contratante pelo NOME (`client.origin`, ver
// contractors.js). Horas sem cliente da lista (clientes "avulsos") não contam
// para nenhum contratante.
//
// Valor a receber = horas × `rate` do contratante. Contratantes "Direto" não têm
// preço único (cada cliente teria o seu, ainda não existe esse campo): ficam com
// `value = null` e não entram nos totais de valor.
import { getOpenPeriod, addDays, isoDateStr, dateStrInPeriod, staffTotalPay, staffExpensesApproved, formatPeriodLabel, monthAbbr } from "./utils.js";
import { findContractor, clientsOfContractor, cycleConfig } from "./contractors.js";

function parseIso(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function rateOf(contractor) {
  const r = Number(contractor && contractor.rate);
  return !contractor || contractor.isDirect || !(r > 0) ? null : r;
}

// Mapa clientId -> contratante (ou null).
function contractorByClient(clients, contractors) {
  const map = new Map();
  (clients || []).forEach((cl) => map.set(cl.id, findContractor(contractors, cl.origin)));
  return map;
}

function emptyBucket() { return { hours: 0, byClient: new Map() }; }

function addEntry(period, contractorId, clientId, hours) {
  const key = contractorId == null ? "none" : contractorId;
  if (!period.byContractor.has(key)) period.byContractor.set(key, emptyBucket());
  const b = period.byContractor.get(key);
  b.hours += hours;
  b.byClient.set(clientId, (b.byClient.get(clientId) || 0) + hours);
}

// Números de um contratante a partir das horas por cliente (b = { hours, byClient }).
// pricedStaffCost = o custo que corresponde ao valor a receber (para a margem comparar o mesmo com o mesmo).
function entryFromBucket(c, b, clientById) {
  const rate = rateOf(c);
  // Custo ao funcionário = horas de cada cliente × o que se paga ao funcionário nesse cliente.
  let staffCost = 0, directValue = 0, directStaff = 0, missingPrice = 0;
  b.byClient.forEach((hrs, cid) => {
    const cl = clientById.get(cid);
    const cost = hrs * (Number(cl && cl.valueHour) || 0);
    staffCost += cost;
    if (c && c.isDirect) {
      // Contratante direto: cada cliente tem o seu preço de venda; os que não têm ficam de fora da conta.
      const sp = Number(cl && cl.sellPrice);
      if (sp > 0) { directValue += hrs * sp; directStaff += cost; } else if (hrs > 0) missingPrice += 1;
    }
  });
  const direct = !!(c && c.isDirect);
  const v = direct ? (directValue > 0 ? directValue : null) : (rate != null ? b.hours * rate : null);
  return { hours: b.hours, value: v, staffCost, pricedStaffCost: direct ? directStaff : staffCost, missingPrice, byClient: b.byClient };
}

// Séries de `count` períodos: os fechados mais recentes + o período aberto agora (último).
// Devolve [{ key, label, rangeLabel, start, end, isCurrent, pay, contractors: Map(id -> {hours, value, byClient}) }]
export function contractorPeriods({ closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, today, lang, count = 6 }) {
  const cmap = contractorByClient(clients, contractors);
  const open = getOpenPeriod(closedPeriods, cutoffDay, today);
  const out = [];

  const closed = (closedPeriods || []).slice(0, Math.max(0, count - 1)).reverse(); // do mais antigo para o mais recente
  closed.forEach((p) => {
    const end = parseIso(p.periodEnd);
    const entry = {
      key: p.periodEnd, iso: p.periodEnd, label: monthAbbr(lang, end.getMonth()), rangeLabel: p.periodLabel,
      start: p.periodStart ? parseIso(p.periodStart) : addDays(new Date(end.getFullYear(), end.getMonth() - 1, end.getDate()), 1),
      end, isCurrent: false, pay: (p.totalEuros || 0) + (p.totalExpenses || 0), byContractor: new Map(),
    };
    (p.staffSummaries || []).forEach((ss) => (ss.entries || []).forEach((e) => {
      if (e.voided || !e.clientId) return;
      const c = cmap.get(e.clientId);
      addEntry(entry, c ? c.id : null, e.clientId, e.hours || 0);
    }));
    out.push(entry);
  });

  const cur = {
    key: "current", iso: isoDateStr(open.end), label: monthAbbr(lang, open.end.getMonth()), rangeLabel: formatPeriodLabel(open, lang),
    start: open.start, end: open.end, isCurrent: true, byContractor: new Map(), pay: 0,
  };
  (staff || []).forEach((st) => {
    const h = (horasData || {})[st.id];
    if (!h) return;
    cur.pay += staffTotalPay(h, clients, open) + staffExpensesApproved(h, open);
    (h.entries || []).forEach((e) => {
      if (e.voided || !e.clientId || !dateStrInPeriod(e.date, open)) return;
      const c = cmap.get(e.clientId);
      addEntry(cur, c ? c.id : null, e.clientId, e.hours || 0);
    });
  });
  out.push(cur);

  // valores e totais
  const clientById = new Map((clients || []).map((cl) => [cl.id, cl]));
  out.forEach((p) => {
    let hours = 0, value = 0, hasValue = false;
    const list = new Map();
    p.byContractor.forEach((b, key) => {
      const c = key === "none" ? null : (contractors || []).find((x) => x.id === key);
      list.set(key, entryFromBucket(c, b, clientById));
    });
    // Mês já fechado para o contratante: valem os valores guardados no fecho, não os de agora.
    (closings || []).forEach((row) => {
      if (row.status !== "closed" || row.periodEnd !== p.iso) return;
      list.set(row.contractorId, {
        hours: row.hours || 0, value: row.receivable == null ? null : Number(row.receivable), staffCost: Number(row.staffCost) || 0, pricedStaffCost: Number(row.staffCost) || 0, missingPrice: 0,
        byClient: new Map((row.byClient || []).map((b) => [b.clientId, b.hours])), frozen: true, closing: row,
      });
    });
    list.forEach((v, key) => { hours += v.hours; if (v.value != null && key !== "none") { value += v.value; hasValue = true; } });
    p.contractors = list;
    p.totalHours = hours;
    p.totalValue = hasValue ? value : null;
    delete p.byContractor;
  });
  return out;
}

// Datas de faturação e pagamento de um contratante para o período que termina em `periodEnd`:
// faturar no 1º dia `billingDay` depois do fim do período; pagamento = faturação + prazo.
export function contractorDates(contractor, periodEnd, today) {
  const day = Number(contractor && contractor.billingDay);
  if (!(day >= 1 && day <= 31)) return null;
  let d = addDays(periodEnd, 1);
  for (let i = 0; i < 62; i += 1) {
    if (d.getDate() === day) break;
    d = addDays(d, 1);
  }
  const billing = d;
  const days = Number(contractor.paymentDays);
  const payment = days >= 0 && contractor.paymentDays !== "" && contractor.paymentDays != null ? addDays(billing, days) : null;
  const diff = (x) => Math.round((x - today) / 86400000);
  return { billing, payment, billingIn: diff(billing), paymentIn: payment ? diff(payment) : null };
}

// Variação em % (inteiro) entre dois valores; null quando não dá para comparar.
export function changePct(cur, prev) {
  if (prev == null || prev === 0 || cur == null) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

// Resumo financeiro de UM período (normalmente o aberto): um cartão por contratante com horas
// e algum movimento, mais os totais. Contratantes sem preço (Direto, ou sem valor/hora)
// ficam com `value = null` e fora das contas de receber/margem.
export function periodFinance(period, contractors) {
  const cards = [];
  let receivable = 0, pricedStaff = 0, unpriced = 0;
  (contractors || []).forEach((c) => {
    const d = period.contractors.get(c.id);
    if (!d || !(d.hours > 0)) return;
    const priced = d.value != null;
    const matched = d.pricedStaffCost != null ? d.pricedStaffCost : d.staffCost; // custo dos clientes que têm preço
    const margin = priced ? d.value - matched : null;
    cards.push({ contractor: c, closing: d.closing || null, hours: d.hours, value: d.value, staffCost: d.staffCost, pricedStaffCost: matched, missingPrice: d.missingPrice || 0, margin, marginPct: priced && d.value > 0 ? Math.round((margin / d.value) * 100) : null });
    if (priced) { receivable += d.value; pricedStaff += matched; } else unpriced += 1;
  });
  return { cards, receivable, pricedStaff, margin: receivable - pricedStaff, unpriced, pricedCount: cards.length - unpriced };
}

export { isoDateStr };

// ---------------------------------------------------------------------------------------------
// Ciclo de faturação PRÓPRIO de um contratante (ver `cycleConfig`): janelas de datas independentes do
// período geral, para o relatório e o fecho. As horas vêm de todas as marcações (períodos fechados +
// horas em curso).
// ---------------------------------------------------------------------------------------------
function monthDate(monthIdx, day) {
  const y = Math.floor(monthIdx / 12), m = ((monthIdx % 12) + 12) % 12;
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, dim));
}

// Todas as marcações: { staffId, name, e }. Períodos fechados vêm do arquivo; o que vem depois do último
// fecho vem das horas em curso (sem repetir).
export function allMarks({ closedPeriods, horasData, staff }) {
  const out = [];
  const lastClosed = ((closedPeriods || [])[0] || {}).periodEnd || "";
  (closedPeriods || []).forEach((cp) => (cp.staffSummaries || []).forEach((ss) => (ss.entries || []).forEach((e) => out.push({ staffId: ss.staffId, name: ss.name || "—", e }))));
  (staff || []).forEach((st) => {
    const h = (horasData || {})[st.id];
    ((h && h.entries) || []).forEach((e) => { if (e.date > lastClosed) out.push({ staffId: st.id, name: st.name, e }); });
  });
  return out;
}

// Janelas (do mais antigo ao mais recente) do ciclo do contratante até à que contém `today`: [{ start, end, iso }].
export function cycleWindows(contractor, today, count = 12) {
  const cfg = cycleConfig(contractor);
  if (!cfg) return [];
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const cand = [];
  if (cfg.n === 1) {
    for (let i = -(count + 2); i <= 2; i += 1) cand.push(todayIdx + i);
  } else {
    const [ay, am] = cfg.anchor.split("-").map(Number);
    const a0 = ay * 12 + (am - 1);
    const k0 = Math.floor((todayIdx - a0) / cfg.n);
    for (let k = k0 - count - 2; k <= k0 + 2; k += 1) cand.push(a0 + k * cfg.n);
  }
  const wins = cand.map((startMonth) => {
    const start = monthDate(startMonth, cfg.s);
    const end = monthDate(startMonth + (cfg.s <= cfg.e ? cfg.n - 1 : cfg.n), cfg.e);
    return { start, end, iso: isoDateStr(end) };
  }).filter((w) => w.start <= today && w.end >= w.start).sort((a, b) => a.start - b.start);
  return wins.slice(-count);
}

// Séries de ciclos do contratante, no mesmo formato de `contractorPeriods` (cada uma com `contractors: Map(id -> entrada)`),
// para o detalhe, o relatório e o fecho do mês funcionarem sem mudar. `iso` = fim do ciclo (chave do fecho).
export function contractorCyclePeriods({ contractor, closedPeriods, horasData, staff, clients, contractors, closings, today, lang, count = 12 }) {
  const wins = cycleWindows(contractor, today, count);
  const marks = allMarks({ closedPeriods, horasData, staff });
  const mineIds = new Set(clientsOfContractor(clients, contractor).map((c) => c.id));
  const clientById = new Map((clients || []).map((cl) => [cl.id, cl]));
  return wins.map((w) => {
    const startIso = isoDateStr(w.start);
    const b = { hours: 0, byClient: new Map() };
    marks.forEach(({ e }) => {
      if (e.voided || !e.clientId || !mineIds.has(e.clientId) || e.date < startIso || e.date > w.iso) return;
      b.hours += e.hours || 0;
      b.byClient.set(e.clientId, (b.byClient.get(e.clientId) || 0) + (e.hours || 0));
    });
    const entry = entryFromBucket(contractor, b, clientById);
    const row = (closings || []).find((r) => r.status === "closed" && r.periodEnd === w.iso && String(r.contractorId) === String(contractor.id));
    const list = new Map();
    list.set(contractor.id, row
      ? { hours: row.hours || 0, value: row.receivable == null ? null : Number(row.receivable), staffCost: Number(row.staffCost) || 0, pricedStaffCost: Number(row.staffCost) || 0, missingPrice: 0, byClient: new Map((row.byClient || []).map((x) => [x.clientId, x.hours])), frozen: true, closing: row }
      : entry);
    const e0 = list.get(contractor.id);
    return {
      key: w.iso, iso: w.iso, label: w.start.getMonth() === w.end.getMonth() ? monthAbbr(lang, w.end.getMonth()) : `${monthAbbr(lang, w.start.getMonth())}–${monthAbbr(lang, w.end.getMonth())}`, rangeLabel: formatPeriodLabel({ start: w.start, end: w.end }, lang),
      start: w.start, end: w.end, isCurrent: w.end >= today, cycle: true, pay: 0, contractors: list, totalHours: e0.hours, totalValue: e0.value,
    };
  });
}

// O ciclo que está "em faturação" do contratante: o que contém hoje; mas se o anterior já acabou e ainda não foi
// fechado/faturado, é esse. Devolve a janela { start, end, iso } ou null (sem ciclo próprio).
export function activeCycleWindow(contractor, closings, today) {
  const wins = cycleWindows(contractor, today, 3);
  if (wins.length === 0) return null;
  const cur = wins[wins.length - 1];
  const prev = wins[wins.length - 2];
  if (prev) {
    const done = (closings || []).some((r) => r.status === "closed" && r.periodEnd === prev.iso && String(r.contractorId) === String(contractor.id));
    if (!done && today > prev.end && Math.round((today - prev.end) / 86400000) <= 62) return prev;
  }
  return cur;
}
