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
import { findContractor } from "./contractors.js";

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
      // pricedStaffCost = o custo que corresponde ao valor a receber (para a margem comparar o mesmo com o mesmo).
      const pricedStaffCost = direct ? directStaff : staffCost;
      list.set(key, { hours: b.hours, value: v, staffCost, pricedStaffCost, missingPrice, byClient: b.byClient });
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
