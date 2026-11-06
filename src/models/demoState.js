// Demonstração "sempre fresca" (empresa de demonstração para clientes novos).
// Em vez de datas fixas que envelhecem, tudo é GERADO para o dia de hoje a partir
// dos clientes, da equipa e da agenda de exemplo (models/data.js), com as mesmas
// regras do app (agenda, frequência, divisão das horas):
//   • 6 períodos anteriores fechados e pagos (Histórico, gráficos, PDFs);
//   • período atual registado até ontem, semanas anteriores finalizadas;
//   • pendências realistas: 2 horas extra por aprovar, 1 pessoa com dias em
//     falta, pedidos e avisos recentes, uma cobertura de férias em curso, uma
//     visita avulsa e uma falta avisada.
// Nada disto é gravado: cada visita à demonstração começa limpa.
import {
  INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_MISSING, INITIAL_SENT, TODAY,
} from "./data.js";
import {
  addDays, isoDateStr, getCutoffPeriod, weekBlocksOfPayPeriod, dayScheduledClients, expectedShare,
  buildClosedPeriodSnapshot, isStaffActive, pad2, formatPeriodLabel,
} from "./utils.js";

const CUTOFF = 20;
const ANCHOR = new Date(2026, 9, 15); // dia em que as datas de exemplo foram escritas

// Número pseudo-aleatório estável (mesmo resultado para o mesmo dia/pessoa/cliente).
function rnd(...parts) {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
const dm = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

// Datas da ficha (contrato, validade) andam com o tempo, em semanas inteiras.
function shiftWeeks() { return Math.round((TODAY - ANCHOR) / (7 * 86400000)) * 7; }
function shiftDMY(str, days) {
  if (!str || !/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const [d, m, y] = str.split("/").map(Number);
  const n = addDays(new Date(y, m - 1, d), days);
  return `${pad2(n.getDate())}/${pad2(n.getMonth() + 1)}/${n.getFullYear()}`;
}
function shiftISO(str, days) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const [y, m, d] = str.split("-").map(Number);
  return isoDateStr(addDays(new Date(y, m - 1, d), days));
}

function entriesFor(clients, staff, assignments, covers, from, to, opts) {
  const ctx = { staff, assignments, covers, absences: [] };
  const byStaff = {};
  staff.forEach((s) => { byStaff[s.id] = []; });
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const iso = isoDateStr(d);
    staff.forEach((s) => {
      if (!isStaffActive(s, d)) return;
      dayScheduledClients(clients, assignments, s.id, d, covers).forEach((c) => {
        if (opts.skip && rnd("skip", s.id, iso, c.id) < 0.015) return; // visita que não aconteceu
        const { minutes, team } = expectedShare(ctx, c, iso, s.id);
        const extra = rnd("extra", s.id, iso, c.id) < 0.04 ? 30 : 0;
        byStaff[s.id].push({
          date: iso, clientId: c.id, hours: Math.round(((minutes + extra) / 60) * 100) / 100,
          extra: extra > 0, extraMinutes: extra, approved: extra > 0 ? opts.approve(iso) : false, voided: false, sharedCount: team,
        });
      });
    });
  }
  return byStaff;
}

export function buildDemoState() {
  const shift = shiftWeeks();
  const clients = INITIAL_CLIENTS.map((c) => ({
    ...c,
    contractStart: shiftDMY(c.contractStart, shift),
    contractEnd: shiftDMY(c.contractEnd, shift),
    clientValidUntil: shiftDMY(c.clientValidUntil, shift),
  }));
  const staff = INITIAL_STAFF.map((s) => ({ ...s, validUntil: shiftISO(s.validUntil, shift) }));
  const assignments = INITIAL_ASSIGNMENTS;
    const open = getCutoffPeriod(TODAY, CUTOFF, 0);

  // Coberturas, visita avulsa e falta avisada à volta de hoje.
  const coverOwner = 5; const coverTo = 7;
  const ownerClients = [...new Set(Object.entries(assignments).filter(([k]) => k.startsWith(`${coverOwner}-`)).flatMap(([, v]) => v))];
  const covers = ownerClients.slice(0, 3).map((cid, i) => ({
    id: `demo-cv-${i}`, clientId: cid, fromStaffId: coverOwner, toStaffId: coverTo,
    from: isoDateStr(addDays(TODAY, -2)), to: isoDateStr(addDays(TODAY, 6)), createdAt: isoDateStr(addDays(TODAY, -5)),
  }));
  covers.push({ id: "demo-visit-1", kind: "visit", groupId: "demo-vg", clientId: 2, fromStaffId: null, toStaffId: 14, from: isoDateStr(addDays(TODAY, 1)), to: isoDateStr(addDays(TODAY, 1)), createdAt: isoDateStr(TODAY) });
  const absences = [{ id: "demo-abs-1", staffId: 9, date: isoDateStr(addDays(TODAY, 4)), note: "Consulta médica", createdAt: isoDateStr(addDays(TODAY, -1)), handled: false }];

  // Pedidos e avisos: os de exemplo, com datas recentes.
  const missingAgo = [6, 3, 22, 29];
  const missingItems = INITIAL_MISSING.map((m, i) => ({ ...m, date: dm(addDays(TODAY, -(missingAgo[i] ?? 5))) }));
  const sentAgo = [11, 26, 2, 33, 1, 24];
  const sentItems = INITIAL_SENT.map((m, i) => ({ ...m, date: dm(addDays(TODAY, -(sentAgo[i] ?? 3))) }));

  // Histórico: 6 períodos fechados e pagos (o mais recente primeiro).
  const closedPeriods = [];
  for (let k = 1; k <= 6; k += 1) {
    const p = getCutoffPeriod(TODAY, CUTOFF, -k);
    const by = entriesFor(clients, staff, assignments, [], p.start, p.end, { skip: true, approve: () => true });
    const paidAt = isoDateStr(addDays(p.end, 3));
    const hd = {};
    staff.forEach((s) => { hd[s.id] = { status: "finalizado", paid: true, paidAt, entries: by[s.id], lockedWeeks: {}, reopened: false }; });
    const snap = buildClosedPeriodSnapshot(p, clients, staff, hd, sentItems, missingItems);
    closedPeriods.push({ ...snap, id: 9000 + k, periodLabel: formatPeriodLabel(p), closedAt: isoDateStr(addDays(p.end, 2)) });
  }

  // Período atual: registado até ontem.
  const recent = isoDateStr(addDays(TODAY, -5));
  let pendingExtras = 0;
  const by = entriesFor(clients, staff, assignments, covers, open.start, TODAY, {
    skip: false,
    approve: (iso) => (iso < recent ? true : (pendingExtras += 1) > 2),
  });
  // Hoje: a maioria já registou; 3 pessoas ainda não (normal a meio do dia).
  const todayIso = isoDateStr(TODAY);
  const notYet = new Set(staff.filter((s) => s.id !== 4).sort((a, b) => rnd("today", a.id, todayIso) - rnd("today", b.id, todayIso)).slice(0, 3).map((s) => s.id));
  notYet.forEach((id) => { by[id] = (by[id] || []).filter((e) => e.date !== todayIso); });
  const blocks = weekBlocksOfPayPeriod(open, CUTOFF);
  const thisWeekStart = blocks.find((b) => b.start <= TODAY && TODAY <= b.end)?.start || TODAY;
  const gapStaff = 4; // Carlos: esqueceu-se de registar 2 dias da semana passada
  const lastWeek = blocks.filter((b) => b.end < thisWeekStart).slice(-1)[0];
  const horasData = {};
  staff.forEach((s) => {
    let entries = by[s.id] || [];
    const lockedWeeks = {};
    blocks.forEach((b) => { if (b.end < thisWeekStart) lockedWeeks[isoDateStr(b.start)] = true; });
    if (s.id === gapStaff && lastWeek) {
      const days = [...new Set(entries.filter((e) => e.date >= isoDateStr(lastWeek.start) && e.date <= isoDateStr(lastWeek.end)).map((e) => e.date))].slice(-2);
      entries = entries.filter((e) => !days.includes(e.date));
      delete lockedWeeks[isoDateStr(lastWeek.start)];
    }
    horasData[s.id] = { status: "pendente", paid: false, paidAt: null, entries, lockedWeeks, noClientDays: [], reopened: false };
  });

  return { clients, staff, assignments, horasData, closedPeriods, missingItems, sentItems, covers, absences };
}
