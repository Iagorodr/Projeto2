// Testes da agenda: visitas avulsas, coberturas e horas fixas quando a equipa prevista muda. Correr: npm test
import * as U from "../src/models/utils.js";
let ok=0, bad=0; const eq=(n,a,b)=>{ const r=JSON.stringify(a)===JSON.stringify(b); r?ok++:bad++; console.log(r?"ok ":"FAIL", n, r?"":JSON.stringify(a)+" vs "+JSON.stringify(b)); };
const c = { id: 900, name: "Replacement X", days: [], duration: 240, hoursMode: "dividida", frequency: "weekly", contractEnd: "2026-10-01" };
const staff = [{ id: 1, name: "Ana", status: "ativo", accountType: "fixo" }, { id: 2, name: "Bia", status: "ativo", accountType: "fixo" }, { id: 3, name: "Caio", status: "ativo", accountType: "fixo" }];
const assignments = { "3-2": [901] };
const covers = [
  { id: "v1", kind: "visit", groupId: "g", clientId: 900, fromStaffId: null, toStaffId: 1, from: "2026-11-10", to: "2026-11-10" },
  { id: "v2", kind: "visit", groupId: "g", clientId: 900, fromStaffId: null, toStaffId: 2, from: "2026-11-10", to: "2026-11-10" },
  { id: "c1", clientId: 901, fromStaffId: 3, toStaffId: 1, from: "2026-11-01", to: "2026-11-30" },
];
const ctx = { staff, assignments, covers, absences: [] };
eq("agenda Ana terça", U.agendaClientIdsOn(assignments, covers, 1, "2026-11-10").sort(), [900, 901]);
eq("agenda Ana quarta (sem visita)", U.agendaClientIdsOn(assignments, covers, 1, "2026-11-11"), []);
eq("agenda Caio terça (cobertura)", U.agendaClientIdsOn(assignments, covers, 3, "2026-11-10"), []);
eq("aplica fora da validade/dia", U.clientAppliesOnDate(c, new Date(2026,10,10), covers), true);
eq("sem visita: agenda vazia", U.dayScheduledClients([c], assignments, 1, new Date(2026,10,17), covers).length, 0);
eq("dayScheduled Ana", U.dayScheduledClients([c,{id:901,name:"Y",days:[2],duration:60}], assignments, 1, new Date(2026,10,10), covers).map(x=>x.id).sort(), [900,901]);
eq("equipa esperada", U.expectedTeamIds(ctx, c, "2026-11-10"), [1,2]);
eq("parte prevista", U.expectedShare(ctx, c, "2026-11-10", 1).minutes, 120);
eq("coveringOn Ana", U.coveringOn(assignments, covers, 1, "2026-11-10").map(x=>x.cover.id).sort(), ["c1","v1"]);
eq("coverOverlaps ignora visita", U.coverOverlaps(covers, 900, "2026-11-01", "2026-11-30"), []);
// Ana regista sozinha primeiro: divisão já conta Bia (esperada) → 2h
let h = { 1: { entries: [{ date: "2026-11-10", clientId: 900, hours: 4, extraMinutes: 0, voided: false }] } };
h = U.recomputeSharedHours(h, [c], "2026-11-10", 900, { ctx });
eq("Ana sozinha antes da Bia", h[1].entries[0].hours, 2);
// conferência: sem "visita extra"
const per = { start: new Date(2026,10,9), end: new Date(2026,10,15) };
h[2] = { entries: [{ date: "2026-11-10", clientId: 900, hours: 2, extraMinutes: 0, voided: false }] };
const rec = U.reconcileVisits(h, [c], per, ctx, "2026-11-20");
eq("revisões sem problemas", rec.issues.filter(i=>i.clientId===900).map(i=>i.kind), []);
const exp = U.clientExpectedHours(c, per, ctx, new Date(2026,10,20));
eq("horas previstas", exp.whole, 4);
{
  const cl = { id: 77, name: "Div", days: [3], duration: 240, hoursMode: "dividida", frequency: "weekly" };
  const st = [{ id: 1, name: "A", status: "ativo", accountType: "fixo" }, { id: 2, name: "B", status: "ativo", accountType: "fixo" }];
  const before = { staff: st, assignments: { "1-3": [77], "2-3": [77] }, covers: [], absences: [] };
  const after = { ...before, assignments: { "1-3": [77], "2-5": [77] } };
  const h = { 1: { entries: [{ date: "2026-11-04", clientId: 77, hours: 2, extraMinutes: 0 }, { date: "2026-10-28", clientId: 77, hours: 2, extraMinutes: 0 }] }, 2: { entries: [{ date: "2026-11-04", clientId: 77, hours: 2.5, extraMinutes: 30 }] } };
  const r = U.pinTeamChanges(h, [cl], before, after, "2026-11-01", "2026-11-05");
  eq("fixou 2 linhas no período", r.count, 2);
  eq("manualBase com extra", r.next[2].entries[0].manualBase, 2);
  eq("fora do período intacta", r.next[1].entries[1].manualBase, undefined);
  const r2 = U.pinTeamChanges(h, [cl], before, before, "2026-11-01", "2026-11-05");
  eq("sem mudança nada", r2.count, 0);
  const r3 = U.pinTeamChanges(r.next, [cl], before, after, "2026-11-01", "2026-11-05");
  eq("idempotente", r3.count, 0);
  console.log(ok, "ok", bad, "falhas");
}

{
  // Opção B (8/11): contrato de cliente FIXO terminado não corta as visitas previstas.
  const fixo = { id: 501, name: "Fixo", days: [1], duration: 120, hoursMode: "dividida", frequency: "weekly", contractEnd: "01/01/2026" };
  const st = [{ id: 1, name: "A", status: "ativo", accountType: "fixo" }];
  const ctx2 = { staff: st, assignments: { "1-1": [501] }, covers: [], absences: [] };
  const per2 = { start: new Date(2026, 10, 2), end: new Date(2026, 10, 8) };
  eq("fixo com contrato terminado continua previsto", U.clientExpectedHours(fixo, per2, ctx2, new Date(2026, 10, 9)).whole, 2);
  const repl = { ...fixo, id: 502, clientType: "replacement", contractStart: "01/10/2026", contractEnd: "31/10/2026" };
  eq("replacement fora da validade não é previsto", U.clientExpectedHours(repl, per2, { ...ctx2, assignments: { "1-1": [502] } }, new Date(2026, 10, 9)).whole, 0);
}
{
  // Feriado (10/11): a gerência decide cliente a cliente; "mudar de dia" = decisão + visita avulsa.
  const a = { id: 601, name: "Uma vez", days: [3], duration: 60, hoursMode: "dividida", frequency: "weekly" };
  const b = { id: 602, name: "Duas vezes", days: [3, 5], duration: 60, hoursMode: "dividida", frequency: "weekly" };
  const st = [{ id: 1, name: "A", status: "ativo", accountType: "fixo" }];
  const as = { "1-3": [601, 602], "1-5": [602] };
  const rows = U.holidayClientsOn([a, b], st, as, "2026-11-11");
  eq("feriado: clientes e visitas por semana", rows.map((r) => [r.client.id, r.perWeek]), [[602, 2], [601, 1]]);
  eq("feriado: tudo por decidir", U.pendingHolidayDecisions(["2026-11-11"], [a, b], st, as, [])[0].undecided, 2);
  const cv = [
    { id: "h1", kind: "holiday", holiday: "2026-11-11", clientId: 602, decision: "skip", moveTo: null, fromStaffId: 1, toStaffId: null, from: "2026-11-11", to: "2026-11-11" },
    { id: "h2", kind: "holiday", holiday: "2026-11-11", clientId: 601, decision: "skip", moveTo: "2026-11-12", visitGroup: "g", fromStaffId: 1, toStaffId: null, from: "2026-11-11", to: "2026-11-11" },
    { id: "v1", kind: "visit", groupId: "g", clientId: 601, fromStaffId: null, toStaffId: 1, from: "2026-11-12", to: "2026-11-12" },
  ];
  eq("feriado: agenda do dia fica vazia", U.agendaClientIdsOn(as, cv, 1, "2026-11-11"), []);
  eq("feriado: cliente mudado aparece no outro dia", U.agendaClientIdsOn(as, cv, 1, "2026-11-12"), [601]);
  eq("feriado: sexta não muda", U.agendaClientIdsOn(as, cv, 1, "2026-11-13"), [602]);
  eq("feriado: sem decisões por decidir", U.pendingHolidayDecisions(["2026-11-11"], [a, b], st, as, cv), []);
  const keep = [{ ...cv[0], decision: "keep" }];
  eq("feriado: 'faz-se' não altera a agenda", U.agendaClientIdsOn(as, keep, 1, "2026-11-11").sort(), [601, 602]);
  eq("feriado: nunca aparece como 'coberto por'", U.coveredAwayOn(as, cv, 1, "2026-11-11"), []);
  eq("feriado: não conta como sobreposição de cobertura", U.coverOverlaps(cv, 602, "2026-11-01", "2026-11-30"), []);
}
console.log(ok, "ok", bad, "falhas");
if (bad > 0) process.exitCode = 1;
{
  // Feriado + cliente quinzenal: passar o ciclo = mudar a semana de referência (frequencyAnchor).
  const q = { id: 700, name: "Quinzenal", days: [3], duration: 60, hoursMode: "dividida", frequency: "biweekly", frequencyAnchor: "2026-11-09" };
  eq("quinzenal faz-se a 11/11", U.clientAppliesOnDate(q, new Date(2026, 10, 11), []), true);
  eq("quinzenal não a 18/11", U.clientAppliesOnDate(q, new Date(2026, 10, 18), []), false);
  const q2 = { ...q, frequencyAnchor: "2026-11-18" };
  eq("ciclo passado: faz-se a 18/11", U.clientAppliesOnDate(q2, new Date(2026, 10, 18), []), true);
  eq("ciclo passado: 25/11 não", U.clientAppliesOnDate(q2, new Date(2026, 10, 25), []), false);
  eq("ciclo passado: 2/12 sim", U.clientAppliesOnDate(q2, new Date(2026, 11, 2), []), true);
}
console.log(ok, "ok", bad, "falhas");

{
  // Adiamento para a semana seguinte (linhas de `absences` com kind "postpone").
  const cl = { id: 800, name: "Semanal", days: [3], duration: 60, hoursMode: "dividida", frequency: "weekly" };
  const cl2 = { id: 801, name: "Duas vezes", days: [2, 4], duration: 60, hoursMode: "dividida", frequency: "weekly" };
  const qz = { id: 802, name: "Quinzenal", days: [3], duration: 60, hoursMode: "dividida", frequency: "biweekly", frequencyAnchor: "2026-11-09" };
  const st = [{ id: 1, name: "Ana", status: "ativo", accountType: "fixo" }];
  const as = { "1-3": [800, 802], "1-2": [801], "1-4": [801] };
  eq("adiar: semanal não é elegível", U.postponeEligible(as, cl), false);
  eq("adiar: quinzenal é elegível", U.postponeEligible(as, qz), true);
  eq("adiar: mensal é elegível", U.postponeEligible(as, { ...qz, frequency: "monthly" }), true);
  const abs = [
    { id: "pp1", staffId: 1, date: "2026-11-11", kind: "postpone", clientIds: [800], owners: [1], status: "auto" },
    { id: "pp2", staffId: 1, date: "2026-11-11", kind: "postpone", clientIds: [802], owners: [1], status: "auto", cycleShift: true, newAnchor: "2026-11-18" },
  ];
  const d = U.derivePostpones(abs, [cl, cl2, qz]);
  d.clients = [cl, cl2, { ...qz, frequencyAnchor: "2026-11-09" }];
  eq("adiar: agenda do dia sem os adiados", U.agendaClientIdsOn(as, d.covers, 1, "2026-11-11"), []);
  eq("adiar: semana seguinte normal (semanal)", U.agendaClientIdsOn(as, d.covers, 1, "2026-11-18").includes(800), true);
  eq("adiar: não conta como falta", U.absenceOn(abs, 1, "2026-11-11"), null);
  eq("adiar: não é falta parcial", U.clientAbsentOn(abs, 1, 800, "2026-11-11"), false);
  eq("adiar: ciclo quinzenal passa a 18/11", U.clientAppliesOnDate(qz, new Date(2026, 10, 18), d.covers), true);
  eq("adiar: ciclo quinzenal não a 25/11", U.clientAppliesOnDate(qz, new Date(2026, 10, 25), d.covers), false);
  eq("adiar: nunca aparece como 'coberto por'", U.coveredAwayOn(as, d.covers, 1, "2026-11-11"), []);
  const pend = [{ id: "pp3", staffId: 1, date: "2026-11-11", kind: "postpone", clientIds: [800], owners: [1], status: "pending" }];
  const dp = U.derivePostpones(pend, [cl]);
  eq("adiar 2.ª vez: pendente não altera a agenda", U.agendaClientIdsOn(as, dp.covers, 1, "2026-11-11"), [800, 802]);
  eq("adiar 2.ª vez: pedidos por aprovar na caixa", U.postponeInbox(pend).length, 1);
  eq("adiar: aviso novo na caixa; visto sai", [U.postponeInbox(abs).length, U.postponeInbox(abs.map((a) => ({ ...a, seen: true }))).length], [2, 0]);
  eq("adiar: pedidos de folga não incluem adiamentos", U.pendingAbsenceRequests(pend, "2026-11-01").length, 0);
  eq("adiar: contagem no período", U.postponesInPeriod(d.covers, 800, { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) }), 1);
}

{
  // O ciclo que passa para a semana seguinte (feriado) NÃO recalcula o passado.
  // Cliente quinzenal com visitas em 28/10 e 11/11; feriado 11/11 -> ciclo passa a 18/11 (referência 18/11).
  const qz = { id: 810, name: "Madame", days: [3], duration: 60, hoursMode: "dividida", frequency: "biweekly", frequencyAnchor: "2026-11-18" };
  const hol = [{ id: "hd-2026-11-11-810-1", kind: "holiday", holiday: "2026-11-11", clientId: 810, decision: "skip", cycleShift: true, prevAnchor: "2026-10-28", fromStaffId: 1, toStaffId: null, from: "2026-11-11", to: "2026-11-11" }];
  const on = (y, m, d, cv) => U.clientAppliesOnDate(qz, new Date(y, m - 1, d), cv);
  eq("ciclo: 21/10 não era visita (antes da mudança)", on(2026, 10, 21, hol), false);
  eq("ciclo: 28/10 era visita", on(2026, 10, 28, hol), true);
  eq("ciclo: 04/11 não era visita", on(2026, 11, 4, hol), false);
  eq("ciclo: 11/11 (feriado) já não conta", on(2026, 11, 11, hol), false);
  eq("ciclo: 18/11 passa a ser visita", on(2026, 11, 18, hol), true);
  eq("ciclo: 02/12 segue o novo ciclo", on(2026, 12, 2, hol), true);
  eq("ciclo: sem coberturas usa a referência atual", on(2026, 10, 21, []), true);
}

console.log(ok, "ok", bad, "falhas");
// Divisão por acertar: cliente de 4h, um registou 1h (fixas) e o outro 2h → propõe 3h/1h
{
  const cl = { id: 88, name: "Sebamafe", days: [5], duration: 240, hoursMode: "dividida", frequency: "weekly" };
  const st = [{ id: 1, name: "Iago", status: "ativo", accountType: "fixo" }, { id: 2, name: "Jadson", status: "ativo", accountType: "fixo" }];
  const cx = { staff: st, assignments: { "1-5": [88], "2-5": [88] }, covers: [], absences: [] };
  const per2 = { start: new Date(2026, 10, 16), end: new Date(2026, 10, 22) };
  const hh = { 1: { entries: [{ date: "2026-11-20", clientId: 88, hours: 1, extraMinutes: 0, manualBase: 1 }] }, 2: { entries: [{ date: "2026-11-20", clientId: 88, hours: 2, extraMinutes: 0 }] } };
  const r = U.reconcileVisits(hh, [cl], per2, cx, "2026-11-21");
  const sp = r.issues.filter((i) => i.kind === "split");
  eq("divisão: aviso", sp.length, 1);
  eq("divisão: proposta", sp[0] && sp[0].proposal.map((x) => [x.staffId, x.hours]), [["2", 3]]);
  const ap = U.applySplit(hh, sp[0]);
  eq("divisão: aplicada", [ap[1].entries[0].hours, ap[2].entries[0].hours], [1, 3]);
  eq("divisão: depois já bate", U.reconcileVisits(ap, [cl], per2, cx, "2026-11-21").issues.filter((i) => i.kind === "split").length, 0);
  const ak = U.ackSplit(hh, sp[0]);
  eq("divisão: está certo", [U.reconcileVisits(ak, [cl], per2, cx, "2026-11-21").issues.filter((i) => i.kind === "split").length, ak[2].entries[0].hours], [0, 2]);
  eq("divisão: soma certa sem aviso", U.reconcileVisits({ 1: { entries: [{ date: "2026-11-20", clientId: 88, hours: 2, extraMinutes: 0 }] }, 2: hh[2] }, [cl], per2, cx, "2026-11-21").issues.filter((i) => i.kind === "split").length, 0);
  eq("melhor cliente exato", U.bestClientMatch("  sebamáfe ", [cl]), { id: 88, exact: true });
  eq("melhor cliente aproximado", U.bestClientMatch("Sebamafe Lda", [cl, { id: 5, name: "Outro" }]), { id: 88, exact: false });
}
// Ajuda fora da agenda (4/11 Sebamafe): Iago ajudou o Jadson, soma certa → só "confirmar", sem correções
{
  const cl = { id: 89, name: "Sebamafe", days: [3], duration: 240, hoursMode: "dividida", frequency: "weekly" };
  const st = [{ id: 1, name: "Iago", status: "ativo", accountType: "fixo" }, { id: 2, name: "Jadson", status: "ativo", accountType: "fixo" }, { id: 3, name: "Talia", status: "ativo", accountType: "fixo" }];
  const cx = { staff: st, assignments: { "2-3": [89], "3-3": [89] }, covers: [], absences: [] };
  const pr = { start: new Date(2026, 10, 2), end: new Date(2026, 10, 8) };
  const hh = { 1: { entries: [{ date: "2026-11-04", clientId: 89, hours: 2, extraMinutes: 0 }] }, 2: { entries: [{ date: "2026-11-04", clientId: 89, hours: 2, extraMinutes: 0 }] }, 3: { entries: [{ date: "2026-11-04", clientId: 89, hours: 0, extraMinutes: 0, voided: true }] } };
  const kinds = U.reconcileVisits(hh, [cl], pr, cx, "2026-11-21").issues.map((i) => i.kind).sort();
  eq("ajuda: só 'help'", kinds, ["help"]);
  const iss = U.reconcileVisits(hh, [cl], pr, cx, "2026-11-21").issues.find((i) => i.kind === "help");
  eq("ajuda: Iago é o de fora", iss.marks.filter((m) => m.helper).map((m) => m.staffId), ["1"]);
  const ak = U.ackHelp(hh, iss);
  eq("ajuda: confirmada some, horas iguais", [U.reconcileVisits(ak, [cl], pr, cx, "2026-11-21").issues.length, ak[1].entries[0].hours, ak[2].entries[0].hours], [0, 2, 2]);
}
console.log(ok, "ok", bad, "falhas");
if (bad > 0) process.exitCode = 1;
