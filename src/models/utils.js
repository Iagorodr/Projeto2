// Funções puras de cálculo e regras de negócio. Camada "Model".
import { TODAY } from "./data.js";

function clientById(clients, id) { return clients.find((c) => c.id === id); }

function recomputeSharedHours(horasDataObj, clients, date, clientId) {
  const client = clientById(clients, clientId);
  if (!client) return horasDataObj;
  const baseDuration = client.duration / 60;
  const staffIdsInvolved = Object.keys(horasDataObj).filter((sid) =>
    (horasDataObj[sid].entries || []).some((e) => e.date === date && e.clientId === clientId && !e.voided)
  );
  const count = staffIdsInvolved.length || 1;
  const perPerson = baseDuration / count;
  const next = { ...horasDataObj };
  staffIdsInvolved.forEach((sid) => {
    next[sid] = {
      ...next[sid],
      entries: next[sid].entries.map((e) => {
        if (e.date === date && e.clientId === clientId && !e.voided) {
          const extraH = (e.extraMinutes || 0) / 60;
          return { ...e, hours: perPerson + extraH, sharedCount: count };
        }
        return e;
      }),
    };
  });
  return next;
}

function staffById(staff, id) { return staff.find((s) => s.id === id); }

function pad2(n) { return String(n).padStart(2, "0"); }

function fmtEuro(v) { return `€ ${v.toFixed(2).replace(".", ",")}`; }

function fmtHoursNum(h) { return h.toFixed(2).replace(".", ","); }

function fmtMinutes(min) {
  if (!min || min <= 0) return "-";
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function parseDMY(str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function dateStrInPeriod(dateStr, period) {
  if (!dateStr) return false;
  let d;
  if (dateStr.includes("-")) { const [y, m, day] = dateStr.split("-").map(Number); d = new Date(y, m - 1, day); }
  else if (dateStr.includes("/")) { const [day, m] = dateStr.split("/").map(Number); d = new Date(TODAY.getFullYear(), m - 1, day); }
  else return false;
  return d >= period.start && d <= period.end;
}

function buildClosedPeriodSnapshot(period, clients, staff, horasData, sentItems, missingItems) {
  const staffSummaries = staff.map((s) => {
    const h = horasData[s.id] || { entries: [], paid: false, status: "pendente" };
    return { staffId: s.id, name: s.name, iban: s.iban, hours: staffTotalHours(h), euros: staffTotalPay(h, clients), paid: h.paid, entries: h.entries.filter((e) => !e.voided) };
  });
  const totalHours = staffSummaries.reduce((s, x) => s + x.hours, 0);
  const totalEuros = staffSummaries.reduce((s, x) => s + x.euros, 0);
  const reclamacoesItems = sentItems.filter((i) => i.type === "reclamacao" && dateStrInPeriod(i.date, period));
  const elogiosItems = sentItems.filter((i) => i.type === "elogio" && dateStrInPeriod(i.date, period));
  const avisosItems = sentItems.filter((i) => i.type === "aviso" && dateStrInPeriod(i.date, period));
  const solicitacoesItems = missingItems.filter((i) => dateStrInPeriod(i.date, period));
  return {
    id: Date.now(),
    periodLabel: formatPeriodLabel(period),
    periodStart: isoDateStr(period.start),
    periodEnd: isoDateStr(period.end),
    closedAt: isoDateStr(TODAY),
    staffSummaries, totalHours, totalEuros,
    reclamacoes: reclamacoesItems.length, elogios: elogiosItems.length, avisos: avisosItems.length,
    reclamacoesItems, elogiosItems, avisosItems,
    solicitacoes: solicitacoesItems.length, solicitacoesResolvidas: solicitacoesItems.filter((i) => i.resolved).length,
    solicitacoesItems,
  };
}

function getCutoffPeriod(baseDate, cutoffDay, offset) {
  let year = baseDate.getFullYear(), month = baseDate.getMonth();
  if (baseDate.getDate() < cutoffDay) month -= 1;
  month += offset;
  return { start: new Date(year, month, cutoffDay), end: new Date(year, month + 1, cutoffDay - 1) };
}

function formatPeriodLabel(period) {
  return `${pad2(period.start.getDate())} ${MONTHS_ABBR_PT[period.start.getMonth()]} - ${pad2(period.end.getDate())} ${MONTHS_ABBR_PT[period.end.getMonth()]}`;
}

function startOfISOWeek(date) {
  const d = new Date(date), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
}

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

function isoDateStr(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }

function weekDiff(weekStart, ref) { return Math.round((weekStart - ref) / (7 * 24 * 60 * 60 * 1000)); }

const REFERENCE_WEEK_START = startOfISOWeek(new Date(2026, 8, 1));

function clientAppliesThisWeek(client, weekStart) {
  const diff = weekDiff(weekStart, REFERENCE_WEEK_START);
  if (client.frequency === "weekly") return true;
  if (client.frequency === "biweekly") return ((diff % 2) + 2) % 2 === 0;
  if (client.frequency === "monthly") return ((diff % 4) + 4) % 4 === 0;
  return true;
}

function weekLabelPT(weekStart) {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) return `${pad2(weekStart.getDate())}-${pad2(end.getDate())} ${MONTHS_ABBR_PT[weekStart.getMonth()]}`;
  return `${pad2(weekStart.getDate())} ${MONTHS_ABBR_PT[weekStart.getMonth()]} - ${pad2(end.getDate())} ${MONTHS_ABBR_PT[end.getMonth()]}`;
}

function getWeekChunk(date, payPeriod) {
  const weekStart = startOfISOWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart < payPeriod.start ? payPeriod.start : weekStart;
  const end = weekEnd > payPeriod.end ? payPeriod.end : weekEnd;
  return { start, end };
}

function getPayPeriodFor(date, cutoffDay) { return getCutoffPeriod(date, cutoffDay, 0); }

function getWeekChunkFor(date, cutoffDay) { return getWeekChunk(date, getPayPeriodFor(date, cutoffDay)); }

function nextWeekChunk(chunk, cutoffDay) { return getWeekChunkFor(addDays(chunk.end, 1), cutoffDay); }

function prevWeekChunk(chunk, cutoffDay) { return getWeekChunkFor(addDays(chunk.start, -1), cutoffDay); }

function buildWeekChunkSequence(anchorDate, cutoffDay, countBefore, countAfter) {
  const anchor = getWeekChunkFor(anchorDate, cutoffDay);
  const list = [anchor];
  let cursor = anchor;
  for (let i = 0; i < countAfter; i++) { cursor = nextWeekChunk(cursor, cutoffDay); list.push(cursor); }
  const before = [];
  cursor = anchor;
  for (let i = 0; i < countBefore; i++) { cursor = prevWeekChunk(cursor, cutoffDay); before.unshift(cursor); }
  return { list: [...before, ...list], anchorIndex: before.length };
}

function weekChunksOfPayPeriod(payPeriod, cutoffDay) {
  const chunks = [];
  let cursor = payPeriod.start;
  while (cursor <= payPeriod.end) {
    const chunk = getWeekChunk(cursor, payPeriod);
    chunks.push(chunk);
    cursor = addDays(chunk.end, 1);
  }
  return chunks;
}

function calPeriodDays(period) {
  const days = [];
  let cursor = period.start;
  while (cursor <= period.end) { days.push(cursor); cursor = addDays(cursor, 1); }
  return days;
}

function calPeriodLabel(period) {
  if (period.start.getMonth() === period.end.getMonth()) return `${pad2(period.start.getDate())}-${pad2(period.end.getDate())} ${MONTHS_ABBR_PT[period.start.getMonth()]}`;
  return `${pad2(period.start.getDate())} ${MONTHS_ABBR_PT[period.start.getMonth()]} - ${pad2(period.end.getDate())} ${MONTHS_ABBR_PT[period.end.getMonth()]}`;
}

function staffTotalHours(horasEntry) {
  return horasEntry.entries.filter((e) => !e.voided).reduce((s, e) => s + e.hours, 0);
}

function staffTotalPay(horasEntry, clients) {
  return horasEntry.entries.filter((e) => !e.voided).reduce((s, e) => {
    const c = clientById(clients, e.clientId);
    return s + e.hours * (c ? c.valueHour : 0);
  }, 0);
}

function getAssignedClientIds(assignments, staffId) {
  const ids = new Set();
  Object.entries(assignments).forEach(([key, clientIds]) => {
    if (key.startsWith(`${staffId}-`)) clientIds.forEach((id) => ids.add(id));
  });
  return [...ids];
}

export { clientById, recomputeSharedHours, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod, buildClosedPeriodSnapshot, getCutoffPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr, weekDiff, REFERENCE_WEEK_START, clientAppliesThisWeek, weekLabelPT, getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk, buildWeekChunkSequence, weekChunksOfPayPeriod, calPeriodDays, calPeriodLabel, staffTotalHours, staffTotalPay, getAssignedClientIds };
