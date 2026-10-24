// Relatório detalhado de um contratante num período: por cliente, quantas vezes foi feito
// (face ao previsto na agenda e nos dados do cliente), em que dias, quantas horas (com os
// extras pedidos à parte) e quem fez cada visita. Tudo CALCULADO na hora a partir das marcações
// de horas (período fechado: o arquivo do período; período aberto: as horas dos funcionários).
// Não inclui nada do que se paga aos funcionários.
import { clientsOfContractor } from "./contractors.js";
import { allMarks } from "./contractorStats.js";
import { clientAppliesOnDate, addDays, isoDateStr, visitDateOf } from "./utils.js";

function dowOf(date) { const d = date.getDay(); return d === 0 ? 7 : d; }

// period: { start: Date, end: Date, iso, isCurrent }. today: Date (as visitas previstas só contam até hoje).
export function buildContractorReport({ contractor, clients, staff, horasData, closedPeriods, assignments, period, today }) {
  const mine = clientsOfContractor(clients, contractor);
  const mineIds = new Set(mine.map((c) => c.id));
  const startIso = isoDateStr(period.start);
  const endIso = isoDateStr(period.end);
  const lastExpectedIso = today && isoDateStr(today) < endIso ? isoDateStr(today) : endIso;

  // Marcações do período (fechadas + em curso, pelo dia): { name, e }.
  const marks = allMarks({ closedPeriods, horasData, staff })
    .filter(({ e }) => e.date >= startIso && e.date <= endIso)
    .map(({ name, e }) => ({ name, e }));

  // Dias da semana (1=seg…7=dom) em que o cliente está na agenda de alguém.
  const agendaDows = new Map();
  Object.entries(assignments || {}).forEach(([key, ids]) => {
    const dow = Number(String(key).split("-").pop());
    (ids || []).forEach((id) => { if (mineIds.has(id)) { if (!agendaDows.has(id)) agendaDows.set(id, new Set()); agendaDows.get(id).add(dow); } });
  });

  const byClient = new Map();
  const bucket = (cl) => { if (!byClient.has(cl.id)) byClient.set(cl.id, { client: cl, expected: [], visits: new Map() }); return byClient.get(cl.id); };

  // Visitas previstas (agenda + dados do cliente: frequência e validade), só até hoje.
  const days = [];
  for (let d = new Date(period.start), i = 0; isoDateStr(d) <= lastExpectedIso && i < 400; d = addDays(d, 1), i += 1) days.push(d);
  mine.forEach((cl) => {
    const dows = agendaDows.get(cl.id);
    if (!dows) return;
    days.forEach((d) => { if (dows.has(dowOf(d)) && clientAppliesOnDate(cl, d)) bucket(cl).expected.push(isoDateStr(d)); });
  });

  // Visitas feitas (uma por dia de visita; várias pessoas na mesma visita juntam-se).
  marks.forEach(({ name, e }) => {
    if (e.voided || !e.clientId || !mineIds.has(e.clientId)) return;
    const cl = mine.find((c) => c.id === e.clientId);
    const b = bucket(cl);
    const date = visitDateOf(e);
    if (!b.visits.has(date)) b.visits.set(date, { date, hours: 0, extraMin: 0, lessMin: 0, staff: [] });
    const v = b.visits.get(date);
    v.hours += e.hours || 0;
    const m = e.extraMinutes || 0;
    if (m > 0) v.extraMin += m; else if (m < 0) v.lessMin += -m;
    if (name && !v.staff.includes(name)) v.staff.push(name);
  });

  const rows = [...byClient.values()].map((b) => {
    const visits = [...b.visits.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
    const doneSet = new Set(visits.map((v) => v.date));
    const expectedSet = new Set(b.expected);
    const missed = b.expected.filter((d) => !doneSet.has(d));
    const outside = visits.filter((v) => !expectedSet.has(v.date)).length;
    const staffNames = [...new Set(visits.flatMap((v) => v.staff))].sort((x, y) => x.localeCompare(y));
    return {
      id: b.client.id, name: b.client.name, expectedN: b.expected.length, doneN: visits.length, missed, outside, visits, staffNames,
      hours: visits.reduce((s, v) => s + v.hours, 0),
      extraMin: visits.reduce((s, v) => s + v.extraMin, 0),
      lessMin: visits.reduce((s, v) => s + v.lessMin, 0),
    };
  }).filter((r) => r.doneN > 0 || r.expectedN > 0).sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      hours: rows.reduce((s, r) => s + r.hours, 0), visits: rows.reduce((s, r) => s + r.doneN, 0), expected: rows.reduce((s, r) => s + r.expectedN, 0),
      extraMin: rows.reduce((s, r) => s + r.extraMin, 0), lessMin: rows.reduce((s, r) => s + r.lessMin, 0),
    },
  };
}
