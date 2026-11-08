// Testes das horas protegidas (caso ACTE 3): manualBase, recalcular explícito, valor/hora guardado, cliente apagado. Correr: npm test
const U = await import('../src/models/utils.js');
const { recomputeSharedHours, pinClientHours, unpinHours, planHoursRecalc, staffTotalPay, snapshotClientRate, unpinVisit } = U;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const cDiv = { id: 9, name: 'ACTE 3', duration: 480, days: [1,2,3,4,5,6,7], frequency: 'weekly', hoursMode: 'dividida', valueHour: 15 };
const cInd = { ...cDiv, hoursMode: 'individual' };
const E = (date, hours, extra = 0) => ({ date, clientId: 9, hours, extraMinutes: extra, voided: false, approved: false, sharedCount: 2 });
let hd = { 1: { entries: [E('2026-10-24', 4)] }, 2: { entries: [E('2026-10-24', 4)] }, 3: { entries: [E('2026-10-21', 2.5)] } };
const period = { start: new Date(2026, 9, 21), end: new Date(2026, 10, 20) };
// 1. Sem proteção (comportamento antigo): mudar para individual dava 8h a todos
const old = planHoursRecalc(hd, [cInd], period, {}).next;
assert(old[1].entries[0].hours === 8 && old[3].entries[0].hours === 8, 'antes: recalcular punha 8h (o bug)');
// 2. Com pin: nada muda, mesmo com recálculo automático
const { next: pinned, keys } = pinClientHours(hd, 9, period);
assert(keys.length === 3, 'fixou 3 linhas');
const auto = planHoursRecalc(pinned, [cInd], period, {});
assert(auto.changes.length === 0, 'recálculo automático não muda linhas fixas');
// 3. Colega marca o mesmo dia depois da mudança: fixas ficam, a nova ganha 8h
let withNew = { ...pinned, 4: { entries: [{ ...E('2026-10-24', 0), sharedCount: 1 }] } };
withNew = recomputeSharedHours(withNew, [cInd], '2026-10-24', 9, {});
assert(withNew[1].entries[0].hours === 4 && withNew[2].entries[0].hours === 4, 'colega a marcar não mexe nas fixas');
assert(withNew[4].entries[0].hours === 8, 'nova marcação usa a regra nova (8h individual)');
// 4. Ajuste da própria pessoa numa linha fixa continua a contar (−30 min)
let adj = { ...withNew, 1: { entries: [{ ...withNew[1].entries[0], extraMinutes: -30 }] } };
adj = recomputeSharedHours(adj, [cInd], '2026-10-24', 9, {});
assert(Math.abs(adj[1].entries[0].hours - 3.5) < 1e-9, 'ajuste −30min numa fixa: 4h → 3h30');
// 5. Recalcular explícito (soltar) aplica a regra nova
const rec = planHoursRecalc(unpinHours(pinned, keys), [cInd], period, {});
assert(rec.changes.length === 3 && rec.next[3].entries[0].hours === 8, 'recalcular explícito: 3 linhas → 8h');
// 6. Dividida: correção manual da gerência sobrevive a colegas
let man = { 1: { entries: [{ ...E('2026-10-24', 5), manualBase: 5 }] }, 2: { entries: [E('2026-10-24', 4)] } };
man = recomputeSharedHours({ ...man, 3: { entries: [E('2026-10-24', 0)] } }, [cDiv], '2026-10-24', 9, {});
assert(man[1].entries[0].hours === 5, 'dividida: correção manual (5h) fica');
assert(Math.abs(man[2].entries[0].hours - 8/3) < 1e-9, 'dividida: os outros dividem como antes');
// 7. Redividir (soltar visita) volta à regra
const un = recomputeSharedHours(unpinVisit(man, '2026-10-24', 9), [cDiv], '2026-10-24', 9, {});
assert(Math.abs(un[1].entries[0].hours - 8/3) < 1e-9, 'redividir solta a correção');
// 8. Valor/hora guardado na linha
const snap = snapshotClientRate({ 1: { entries: [E('2026-10-24', 4)] } }, 9, 15, { period, clientName: 'ACTE 3' });
assert(staffTotalPay(snap[1], [{ ...cDiv, valueHour: 20 }], period) === 60, 'valor antigo guardado: 4h × 15 € mesmo com cliente a 20 €');
assert(staffTotalPay(snap[1], [], period) === 60, 'cliente apagado: horas continuam a valer');
assert(U.entryClientName([], snap[1].entries[0]) === 'ACTE 3', 'cliente apagado: nome guardado');
