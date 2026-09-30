// Funções puras de cálculo e regras de negócio. Camada "Model".
import { TODAY, MONTHS_ABBR_PT } from "./data.js";
import { T } from "./i18n.js";

function monthAbbr(lang, monthIndex) {
  if (!lang || lang === "pt") return MONTHS_ABBR_PT[monthIndex];
  return T[lang].months[monthIndex].slice(0, 3);
}

function clientById(clients, id) { return clients.find((c) => c.id === id); }

function dayIsCovered(horasEntry, dateKey) {
  const hasEntry = (horasEntry.entries || []).some((e) => e.date === dateKey && !e.voided);
  const markedNoClient = (horasEntry.noClientDays || []).includes(dateKey);
  return hasEntry || markedNoClient;
}

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

// Versão compacta pro rótulo direto na barra do gráfico (o slot tem uns
// 40-50px, "€ 9914,50" não cabe sem colidir com o vizinho). O tooltip
// continua mostrando o valor completo via fmtEuro.
function compactEuro(v) {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `€${Math.round(v)}`;
}

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
    return { staffId: s.id, name: s.name, iban: s.iban, hours: staffTotalHours(h, period), euros: staffTotalPay(h, clients, period), paid: h.paid, entries: h.entries.filter((e) => !e.voided && dateStrInPeriod(e.date, period)) };
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
    clientCount: clients.length,
  };
}

function getCutoffPeriod(baseDate, cutoffDay, offset) {
  let year = baseDate.getFullYear(), month = baseDate.getMonth();
  if (baseDate.getDate() < cutoffDay) month -= 1;
  month += offset;
  return { start: new Date(year, month, cutoffDay), end: new Date(year, month + 1, cutoffDay - 1) };
}

function getOpenPeriod(closedPeriods, cutoffDay, today) {
  if (!closedPeriods || closedPeriods.length === 0) {
    return getCutoffPeriod(today, cutoffDay, 0);
  }
  const lastClosed = closedPeriods[0];
  const [y, m, d] = lastClosed.periodEnd.split("-").map(Number);
  const lastEnd = new Date(y, m - 1, d);
  const start = addDays(lastEnd, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cutoffDay - 1);
  return { start, end };
}

function formatPeriodLabel(period, lang) {
  return `${pad2(period.start.getDate())} ${monthAbbr(lang, period.start.getMonth())} - ${pad2(period.end.getDate())} ${monthAbbr(lang, period.end.getMonth())}`;
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

function weekLabelPT(weekStart, lang) {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) return `${pad2(weekStart.getDate())}-${pad2(end.getDate())} ${monthAbbr(lang, weekStart.getMonth())}`;
  return `${pad2(weekStart.getDate())} ${monthAbbr(lang, weekStart.getMonth())} - ${pad2(end.getDate())} ${monthAbbr(lang, end.getMonth())}`;
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

// --- Blocos do período, "opção B" (spec 6.1) --------------------------
function isOneDayChunk(chunk) { return isoDateStr(chunk.start) === isoDateStr(chunk.end); }

function mergeEdgeBlocks(chunks) {
  if (chunks.length < 2) return chunks;
  let merged = chunks;
  if (isOneDayChunk(merged[0])) {
    merged = [{ start: merged[0].start, end: merged[1].end }, ...merged.slice(2)];
  }
  if (merged.length >= 2 && isOneDayChunk(merged[merged.length - 1])) {
    const last = merged.length - 1;
    merged = [...merged.slice(0, last - 1), { start: merged[last - 1].start, end: merged[last].end }];
  }
  return merged;
}

function weekBlocksOfPayPeriod(payPeriod, cutoffDay) {
  return mergeEdgeBlocks(weekChunksOfPayPeriod(payPeriod, cutoffDay));
}

function migrateLockedWeeksToBlocks(lockedWeeks, payPeriod, cutoffDay) {
  const rawChunks = weekChunksOfPayPeriod(payPeriod, cutoffDay);
  const blocks = mergeEdgeBlocks(rawChunks);
  const result = {};
  blocks.forEach((block) => {
    const blockKey = isoDateStr(block.start);
    const subChunks = rawChunks.filter((c) => c.start >= block.start && c.end <= block.end);
    const allLocked = subChunks.length > 0 && subChunks.every((c) => !!(lockedWeeks && lockedWeeks[isoDateStr(c.start)]));
    if (allLocked) result[blockKey] = true;
  });
  return result;
}

function calPeriodDays(period) {
  const days = [];
  let cursor = period.start;
  while (cursor <= period.end) { days.push(cursor); cursor = addDays(cursor, 1); }
  return days;
}

function calPeriodLabel(period, lang) {
  if (period.start.getMonth() === period.end.getMonth()) return `${pad2(period.start.getDate())}-${pad2(period.end.getDate())} ${monthAbbr(lang, period.start.getMonth())}`;
  return `${pad2(period.start.getDate())} ${monthAbbr(lang, period.start.getMonth())} - ${pad2(period.end.getDate())} ${monthAbbr(lang, period.end.getMonth())}`;
}

function staffTotalHours(horasEntry, period) {
  return horasEntry.entries
    .filter((e) => !e.voided && (!period || dateStrInPeriod(e.date, period)))
    .reduce((s, e) => s + e.hours, 0);
}

function staffTotalPay(horasEntry, clients, period) {
  return horasEntry.entries
    .filter((e) => !e.voided && (!period || dateStrInPeriod(e.date, period)))
    .reduce((s, e) => {
      const c = clientById(clients, e.clientId);
      return s + e.hours * (c ? c.valueHour : 0);
    }, 0);
}

function shortMonthFromIso(isoStr, lang) {
  const [, m] = isoStr.split("-").map(Number);
  return monthAbbr(lang, m - 1);
}

function recentClosedPeriodsChronological(closedPeriods, count) {
  // closedPeriods vem sempre do mais recente pro mais antigo (novo período é
  // adicionado no início da lista); aqui devolvemos os últimos `count`, mas
  // em ordem cronológica (mais antigo -> mais recente), pronta pra um gráfico.
  return [...closedPeriods].slice(0, count).reverse();
}

function getAssignedClientIds(assignments, staffId) {
  const ids = new Set();
  Object.entries(assignments).forEach(([key, clientIds]) => {
    if (key.startsWith(`${staffId}-`)) clientIds.forEach((id) => ids.add(id));
  });
  return [...ids];
}

function notesForOwner(personalNotes, ownerId) {
  return (personalNotes || [])
    .filter((n) => n.ownerId === ownerId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function fmtNoteDate(isoStr) {
  const [, m, d] = isoStr.split("-");
  return `${d}/${m}`;
}

export { clientById, dayIsCovered, recomputeSharedHours, staffById, pad2, fmtEuro, compactEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod, buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr, weekDiff, REFERENCE_WEEK_START, clientAppliesThisWeek, weekLabelPT, getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk, buildWeekChunkSequence, weekChunksOfPayPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, staffTotalHours, staffTotalPay, getAssignedClientIds, recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner, fmtNoteDate };
