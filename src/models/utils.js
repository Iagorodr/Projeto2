// Funções puras de cálculo e regras de negócio. Camada "Model".
import { TODAY, MONTHS_ABBR_PT } from "./data.js";
import { T } from "./i18n.js";

function monthAbbr(lang, monthIndex) {
  if (!lang || lang === "pt") return MONTHS_ABBR_PT[monthIndex];
  return T[lang].months[monthIndex].slice(0, 3);
}

function clientById(clients, id) { return clients.find((c) => c.id === id); }
// Cliente "fora da lista": o funcionário escreveu o nome à mão (sem clientId)
// e a gerência corrige depois. Devolve o nome a mostrar para qualquer linha.
function entryClientName(clients, e) {
  const c = clientById(clients, e.clientId);
  if (c) return c.name;
  if (e.custom && e.custom.name) return e.custom.city ? `${e.custom.name} (${e.custom.city})` : e.custom.name;
  return "—";
}
function isPendingClientEntry(e) { return !e.voided && !e.clientId && !!(e.custom && e.custom.name); }

// Um dia conta como "coberto" (fechado, não em falta) se tiver pelo menos um
// lançamento válido OU se o funcionário tiver marcado "Hoje não tive
// clientes" (horasData[staffId].noClientDays, spec 6.3) OU se o cliente
// desse dia já tiver sido feito mais cedo, noutro dia da mesma semana
// ("adiantar" — ver `replacesDate` logo abaixo): nesse caso existe um
// lançamento datado de OUTRO dia com `replacesDate === dateKey`, não um
// lançamento datado deste dia. Sem este terceiro caso, o dia original
// ficava por sempre como "em falta" em todo o lado que usa esta função —
// Horas da gerência (`HorasScreen.jsx`), Monitoramento
// (`MonitoramentoScreen.jsx`), Histórico (`HistoricoScreen.jsx`,
// `EmployeeHistoricoScreen.jsx`) e o próprio ecrã de Horas do funcionário
// — mesmo já estando coberto (apontado pelo Toni ao rever a Etapa 4a).
// Corrigir aqui, na função partilhada, corrige todos esses ecrãs de uma
// vez, sem os tocar individualmente; como `replacesDate` só passou a
// existir com o ecrã novo de Horas, isto não muda nada em dados já
// existentes (nenhum lançamento antigo tem esse campo).
function dayIsCovered(horasEntry, dateKey) {
  const hasEntry = (horasEntry.entries || []).some((e) => e.date === dateKey && !e.voided);
  const markedNoClient = (horasEntry.noClientDays || []).includes(dateKey);
  const coveredByAdvance = (horasEntry.entries || []).some((e) => e.replacesDate === dateKey && !e.voided);
  return hasEntry || markedNoClient || coveredByAdvance;
}

// A VISITA a que um lançamento pertence: a data agendada que ele substitui
// (`replacesDate`, "Fiz o cliente de outro dia") ou, sem isso, a sua própria
// data. A divisão das horas agrupa por (visita, cliente) — assim a Talia
// (quinta) e o Iago (sexta, a substituir a quinta) contam como UMA visita
// partilhada, e não como duas visitas inteiras.
function visitDateOf(e) { return (e && (e.replacesDate || e.date)) || ""; }

// "Adiantar" (spec 6.3): uma entry pode ter `replacesDate` (ISO) — a data
// originalmente agendada que ela substitui, feita mais cedo. No dia
// original, o cliente deve aparecer como "já feito" (a UI que implementa
// isto lê `replacesDate` das entries do funcionário — Etapa 4a,
// `EmployeeHorasScreen.jsx`) e o dia original conta como coberto, não em
// falta (`dayIsCovered`, acima). Regra: nunca duas entries não-anuladas
// do mesmo cliente na mesma semana. `recomputeSharedHours` (abaixo) agrupa
// por (visita, cliente), onde a visita é `replacesDate` se existir (ver
// `visitDateOf`); a entry adiantada guarda a SUA PRÓPRIA data (o dia em que
// trabalhou) mas conta para a visita que substitui.

// Semana/mês "fechado" de um funcionário para uma data: período já fechado
// pela gerência, mês finalizado (dentro do período aberto) ou semana
// trancada pelo próprio funcionário. Fechado NÃO quer dizer definitivo: a
// gerência continua a poder corrigir (ver `recomputeSharedHours`, abaixo),
// só os outros funcionários é que não mexem em horas já fechadas.
function isHorasFrozenOn(h, dateKey, cutoffDay, closedPeriods, today) {
  if (!h) return false;
  const cps = closedPeriods || [];
  if (cps.some((cp) => cp.periodEnd && dateKey <= cp.periodEnd)) return true;
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const open = getOpenPeriod(cps, cutoffDay, today || TODAY);
  if (date < open.start) return true;
  if (date <= open.end) {
    if (h.status === "finalizado") return true;
    const block = weekBlocksOfPayPeriod(open, cutoffDay).find((b) => date >= b.start && date <= b.end);
    if (!block) return false;
    return !!migrateLockedWeeksToBlocks(h.lockedWeeks, open, cutoffDay)[isoDateStr(block.start)];
  }
  const chunk = getWeekChunkFor(date, cutoffDay);
  return !!(h.lockedWeeks && h.lockedWeeks[isoDateStr(chunk.start)]);
}

// Divide as horas de um cliente, numa VISITA (a data agendada — `date` aqui é
// `visitDateOf` das linhas: a data da linha, ou `replacesDate` se foi feita
// noutro dia), pelas pessoas que a fizeram.
//
// `opts.isFrozen(staffId, horasDoFuncionario, linha)` (opcional): quem a devolve
// true tem a semana/mês fechado — as horas dessa pessoa ficam EXATAMENTE
// como estão (um colega que lança depois não reescreve um fecho já feito),
// mas ela continua a contar como participante para a parte dos outros. Se,
// por causa disso, o fecho dela ficou desatualizado (nº de pessoas diferente
// do que ela viu), todas as linhas do dia/cliente ficam com `shareReview`
// para a gerência rever. As ações da gerência chamam SEM `isFrozen`: a
// semana fechada continua sujeita a correções dela — redivide tudo e limpa a
// marca.
function recomputeSharedHours(horasDataObj, clients, date, clientId, opts = {}) {
  const client = clientById(clients, clientId);
  if (!client) return horasDataObj;
  const isFrozen = typeof opts.isFrozen === "function" ? opts.isFrozen : null;
  // `date` = a data da VISITA (ver `visitDateOf`): agrupa quem a fez nesse dia e
  // quem a fez noutro dia a substituí-la.
  const inVisit = (e) => e.clientId === clientId && !e.voided && visitDateOf(e) === date;
  const baseDuration = clientDurationOn(client, date) / 60;
  // Cliente "individual": cada funcionário regista a duração completa, sem divisão.
  if (client.hoursMode === "individual") {
    const nextInd = { ...horasDataObj };
    Object.keys(horasDataObj).forEach((sid) => {
      const list = horasDataObj[sid].entries || [];
      const mine = list.find(inVisit);
      if (!mine) return;
      if (isFrozen && isFrozen(sid, horasDataObj[sid], mine)) return;
      nextInd[sid] = { ...horasDataObj[sid], entries: list.map((e) => {
        if (inVisit(e)) {
          const { splitAdjusted, splitHours, shareReview, conflict, ...rest } = e;
          return { ...rest, hours: baseDuration + (e.extraMinutes || 0) / 60, sharedCount: 1 };
        }
        return e;
      }) };
    });
    return nextInd;
  }
  const staffIdsInvolved = Object.keys(horasDataObj).filter((sid) =>
    (horasDataObj[sid].entries || []).some(inVisit)
  );
  const entryOf = (sid) => horasDataObj[sid].entries.find(inVisit);
  const frozenIds = new Set(isFrozen ? staffIdsInvolved.filter((sid) => isFrozen(sid, horasDataObj[sid], entryOf(sid))) : []);
  // "Trabalhei sozinho" (`solo`): vale logo (horas inteiras) quando mais
  // ninguém marcou esse cliente nesse dia. Se outro colega também marcou, é um
  // CONFLITO: ninguém ganha até a gerência rever (`soloCheck`), e entretanto
  // cada um fica com a parte dividida (o total nunca passa do que o cliente
  // tem). `soloCheck:"ok"` = a gerência confirmou que o `solo` vale.
  const markersCount = staffIdsInvolved.length;
  const conflict = markersCount > 1 && staffIdsInvolved.some((sid) => entryOf(sid).solo && !entryOf(sid).soloCheck);
  const honored = new Set(staffIdsInvolved.filter((sid) => entryOf(sid).solo && (markersCount === 1 || entryOf(sid).soloCheck === "ok")));
  const sharers = staffIdsInvolved.filter((sid) => !honored.has(sid));
  // Equipa ESPERADA (agenda): quem a agenda diz que faz este cliente neste dia
  // e ainda não marcou conta na divisão — assim a parte de cada um fica estável
  // mesmo que o colega se esqueça de marcar. A sobra só passa para quem marcou
  // quando a gerência confirma (`teamConfirmed`, ver `planLeftovers`).
  // Um lançamento adiantado conta para a visita que substitui (`date` já é essa).
  const expectedIds = opts.ctx && sharers.length > 0 ? expectedTeamIds(opts.ctx, client, date) : [];
  const sharerSet = new Set(sharers.map(String));
  const missing = expectedIds.filter((id) => !sharerSet.has(String(id)) && !honored.has(String(id)));
  const confirmedTeam = sharers.length > 0 && sharers.every((sid) => entryOf(sid).teamConfirmed);
  const count = Math.max(1, sharers.length + (confirmedTeam ? 0 : missing.length));
  // Divisão: igual por padrão. Quem ajustou a própria parte (`splitAdjusted`
  // + `splitHours`, base sem extra) fica com o valor escolhido; o restante do
  // total do cliente divide-se por igual entre os que não ajustaram. A soma
  // das partes ajustadas nunca passa do total do cliente.
  const adjustedBase = {};
  let adjustedSum = 0, adjustedCount = 0;
  sharers.forEach((sid) => {
    if (frozenIds.has(sid)) return;
    const e = entryOf(sid);
    if (count > 1 && e && e.splitAdjusted && typeof e.splitHours === "number") {
      const room = Math.max(0, baseDuration - adjustedSum);
      adjustedBase[sid] = Math.min(e.splitHours, room);
      adjustedSum += adjustedBase[sid]; adjustedCount += 1;
    }
  });
  const restCount = count - adjustedCount;
  const perPerson = restCount > 0 ? Math.max(0, baseDuration - adjustedSum) / restCount : baseDuration / count;
  // Fecho desatualizado: alguém com a semana fechada que foi gravado com outro
  // nº de pessoas (ex.: fechou sozinho com 4h e depois um colega marcou o mesmo).
  const needsReview = [...frozenIds].some((sid) => (entryOf(sid).sharedCount || 1) !== (honored.has(sid) ? 1 : count));
  const next = { ...horasDataObj };
  staffIdsInvolved.forEach((sid) => {
    next[sid] = {
      ...next[sid],
      entries: next[sid].entries.map((e) => {
        if (inVisit(e)) {
          const { shareReview, conflict: wasConflict, ...clean } = e;
          const flag = { ...(needsReview ? { shareReview: true } : {}), ...(conflict ? { conflict: true } : {}) };
          if (frozenIds.has(sid)) return { ...clean, ...flag };
          const extraH = (e.extraMinutes || 0) / 60;
          if (honored.has(sid)) {
            const { splitAdjusted, splitHours, ...full } = clean;
            return { ...full, ...flag, hours: baseDuration + extraH, sharedCount: 1 };
          }
          const base = adjustedBase[sid] !== undefined ? adjustedBase[sid] : perPerson;
          return { ...clean, ...flag, hours: base + extraH, sharedCount: count };
        }
        return e;
      }),
    };
  });
  return next;
}

// --- Equipa esperada, horas soltas e conflitos ------------------------------
function dateFromIso(iso) { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); }

// Quem a AGENDA diz que faz `client` na data ISO: tem o cliente na agenda
// efetiva do dia (semana-tipo + coberturas), está ativo e já começou, não
// avisou falta e o cliente tem visita nesse dia (frequência).
// `ctx` = { staff, assignments, covers, absences }.
function expectedTeamIds(ctx, client, isoDate) {
  if (!ctx || !client || !Array.isArray(ctx.staff)) return [];
  const d = dateFromIso(isoDate);
  if (!clientAppliesOnDate(client, d)) return [];
  return ctx.staff
    .filter((s) => isStaffActive(s, d) && staffStartedOn(s, d)
      && !absenceOn(ctx.absences, s.id, isoDate)
      && agendaClientIdsOn(ctx.assignments, ctx.covers, s.id, isoDate).includes(client.id))
    .map((s) => s.id);
}

// Parte PREVISTA de `staffId` num cliente/dia pela agenda: duração ÷ equipa
// esperada (cliente "individual" = duração inteira). { minutes, team }.
function expectedShare(ctx, client, isoDate, staffId) {
  const dur = clientDurationOn(client, isoDate);
  if (!client || client.hoursMode === "individual") return { minutes: dur, team: 1 };
  const ids = expectedTeamIds(ctx, client, isoDate).map(String);
  const team = Math.max(1, ids.includes(String(staffId)) ? ids.length : ids.length + 1);
  return { minutes: Math.round(dur / team), team };
}

// Pares (visita|cliente) com linhas não anuladas dentro do período (ou em todo o
// horasData). `date` é a data da VISITA (ver `visitDateOf`); o filtro do período
// usa o dia em que se trabalhou.
function entryPairs(horasData, period, only) {
  const pairs = new Map();
  Object.keys(horasData || {}).forEach((sid) => ((horasData[sid] && horasData[sid].entries) || []).forEach((e) => {
    if (e.voided || !e.clientId) return;
    if (period && !dateStrInPeriod(e.date, period)) return;
    if (only && !only.has(e.clientId)) return;
    const v = visitDateOf(e);
    pairs.set(`${v}|${e.clientId}`, { date: v, clientId: e.clientId });
  }));
  return [...pairs.values()];
}
function markersOf(horasData, date, clientId) {
  const out = [];
  Object.keys(horasData || {}).forEach((sid) => {
    const e = ((horasData[sid] && horasData[sid].entries) || []).find((x) => visitDateOf(x) === date && x.clientId === clientId && !x.voided);
    if (e) out.push({ staffId: sid, entry: e });
  });
  return out;
}
// Mesma semana ISO (segunda a domingo) para duas datas ISO.
function sameIsoWeek(a, b) { return isoDateStr(startOfISOWeek(dateFromIso(a))) === isoDateStr(startOfISOWeek(dateFromIso(b))); }

// HORAS SOLTAS: dias em que a agenda esperava mais gente do que a que marcou
// e por isso sobra parte da duração do cliente (o colega não marcou, provavelmente
// não foi). A gerência decide se essa sobra passa para quem marcou.
// Devolve [{ key, date, clientId, markerIds, missingIds, leftoverHours, otherDay }]; só
// dias já passados (≤ `today`, ISO), cliente "dividida", sem conflito/solo e
// sem ninguém já pago. Aplicar = `applyLeftovers`.
// `otherDay`: quem "não marcou" mas marcou ESTE cliente noutro dia da mesma
// semana ([{ staffId, date, hours }]) — pode ser a mesma visita feita noutro dia
// (a agenda mudou nessa semana): a gerência pode juntá-las (`joinVisit`) em vez
// de passar a sobra.
function planLeftovers(horasData, clients, period, ctx, today) {
  const todayIso = typeof today === "string" ? today : isoDateStr(today || new Date());
  const items = [];
  entryPairs(horasData, period).forEach(({ date, clientId }) => {
    if (date > todayIso) return;
    const client = clientById(clients, clientId);
    if (!client || client.hoursMode === "individual") return;
    const marks = markersOf(horasData, date, clientId);
    if (marks.length === 0) return;
    if (marks.some((m) => m.entry.solo || m.entry.conflict)) return;
    if (marks.every((m) => m.entry.teamConfirmed)) return;
    if (marks.some((m) => horasData[m.staffId] && horasData[m.staffId].paid)) return;
    const markerSet = new Set(marks.map((m) => String(m.staffId)));
    const missingIds = expectedTeamIds(ctx, client, date).filter((id) => !markerSet.has(String(id)));
    if (missingIds.length === 0) return;
    const total = clientDurationOn(client, date) / 60;
    const given = marks.reduce((sum, m) => sum + (m.entry.hours || 0) - (m.entry.extraMinutes || 0) / 60, 0);
    const leftoverHours = total - given;
    if (leftoverHours <= 1e-6) return;
    const otherDay = [];
    missingIds.forEach((mid) => {
      const he = horasData[mid];
      ((he && he.entries) || []).forEach((e) => {
        if (!e.voided && e.clientId === clientId && visitDateOf(e) !== date && sameIsoWeek(e.date, date)) otherDay.push({ staffId: mid, date: e.date, hours: e.hours || 0 });
      });
    });
    items.push({ key: `${date}|${clientId}`, date, clientId, markerIds: marks.map((m) => m.staffId), missingIds, leftoverHours, otherDay });
  });
  return items.sort((a, b) => a.date.localeCompare(b.date) || String(a.clientId).localeCompare(String(b.clientId)));
}
// Confirma que, nesses dias, a equipa foi só quem marcou: a sobra passa para eles.
function applyLeftovers(horasData, clients, items, ctx) {
  let next = horasData;
  items.forEach((it) => {
    const marked = { ...next };
    it.markerIds.forEach((sid) => {
      marked[sid] = { ...marked[sid], entries: (marked[sid].entries || []).map((e) => (
        visitDateOf(e) === it.date && e.clientId === it.clientId && !e.voided ? { ...e, teamConfirmed: true } : e
      )) };
    });
    next = recomputeSharedHours(marked, clients, it.date, it.clientId, { ctx });
  });
  return next;
}
// Junta à visita de `toDate` o lançamento que `staffId` fez do cliente noutro dia
// (`fromDate`): passa a contar como a mesma visita partilhada (a data em que
// trabalhou não muda; só fica a substituir `toDate`, como em "Fiz o cliente de
// outro dia"). Redivide as duas visitas afetadas.
function joinVisit(horasData, clients, staffId, fromDate, clientId, toDate, ctx, opts = {}) {
  const h = horasData[staffId];
  if (!h) return horasData;
  let oldVisit = null;
  const entries = (h.entries || []).map((e) => {
    if (oldVisit === null && !e.voided && e.clientId === clientId && e.date === fromDate && visitDateOf(e) !== toDate) {
      oldVisit = visitDateOf(e);
      const { shareReview, conflict, teamConfirmed, solo, soloCheck, splitAdjusted, splitHours, ...rest } = e;
      return { ...rest, replacesDate: toDate };
    }
    return e;
  });
  if (oldVisit === null) return horasData;
  let next = { ...horasData, [staffId]: { ...h, entries } };
  next = recomputeSharedHours(next, clients, oldVisit, clientId, { ctx, ...opts });
  return recomputeSharedHours(next, clients, toDate, clientId, { ctx, ...opts });
}

// CONFLITOS: alguém marcou "trabalhei sozinho" e outro colega também marcou o
// mesmo cliente no mesmo dia. [{ key, date, clientId, marks:[{staffId, solo, hours}] }].
function listConflicts(horasData) {
  const out = [];
  entryPairs(horasData).forEach(({ date, clientId }) => {
    const marks = markersOf(horasData, date, clientId);
    if (marks.length > 1 && marks.some((m) => m.entry.conflict)) {
      out.push({ key: `${date}|${clientId}`, date, clientId, marks: marks.map((m) => ({ staffId: m.staffId, solo: !!m.entry.solo, hours: m.entry.hours || 0 })) });
    }
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Decisão da gerência sobre um conflito:
//   action "only"  (+ winnerId) — só essa pessoa fez: as outras linhas ficam anuladas;
//   action "split" — dividiram: o "sozinho" cai e fica a divisão normal;
//   action "both"  — todos fizeram a duração completa.
function resolveConflict(horasData, clients, date, clientId, action, winnerId, ctx) {
  const marks = markersOf(horasData, date, clientId);
  const next = { ...horasData };
  marks.forEach(({ staffId, entry }) => {
    const win = String(staffId) === String(winnerId);
    next[staffId] = { ...next[staffId], entries: next[staffId].entries.map((e) => {
      if (e !== entry) return e;
      const { conflict, ...rest } = e;
      if (action === "only") return win ? { ...rest, solo: true, soloCheck: "ok" } : { ...rest, solo: false, voided: true };
      if (action === "both") return { ...rest, solo: true, soloCheck: "ok" };
      return { ...rest, solo: false, soloCheck: "split" };
    }) };
  });
  return recomputeSharedHours(next, clients, date, clientId, { ctx });
}
// ===========================================================================
// CONFERÊNCIA DE VISITAS (previstas × registadas), por cliente e semana
// ===========================================================================
// Para cada cliente e semana ISO (segunda a domingo) do período compara as
// visitas que a AGENDA previa (`expectedTeamIds`) com as que a equipa REGISTOU,
// agrupadas por visita (`visitDateOf`). Assim, uma visita que passou de quinta
// para sexta continua a contar na mesma semana, e somar o que cada um registou
// tem de dar as visitas previstas ("o Bolinha tem 5 visitas este mês: 5
// registadas, tudo certo").
//
// O que não bate certo vira um PROBLEMA com as provas (quem registou, em que
// dia, quantas horas, o que a agenda previa) e uma sugestão. NADA muda sozinho:
// a gerência aplica (ou não) cada sugestão.
//
// Tipos (`kind`):
//   conflict — "trabalhei sozinho" contra um colega que também foi
//   join     — registo num dia sem visita prevista que parece a MESMA visita
//              feita noutro dia (a Talia na quinta, o Iago na sexta): juntar
//   extra    — registo num dia sem visita prevista e sem visita a que juntar
//   missing  — visita prevista, semana já terminada, e ninguém registou
//   leftover — a agenda esperava mais gente do que a que registou (sobra)
//   pending  — cliente escrito à mão (fora da lista) por confirmar
// Limite: a agenda usada é a de HOJE (se mudou a meio do mês, o "previsto" das
// semanas antigas segue a agenda atual).
function daysBetweenIso(a, b) { return Math.round((dateFromIso(a) - dateFromIso(b)) / 86400000); }

// Semanas ISO que tocam o período, com os dias cortados ao período. Uma semana
// está `complete` quando o último dia dela dentro do período já passou.
function weeksOfPeriod(period, todayIso) {
  if (!period || !period.start || !period.end) return [];
  const startIso = isoDateStr(period.start), endIso = isoDateStr(period.end);
  const weeks = [];
  let cursor = startOfISOWeek(dateFromIso(startIso));
  while (isoDateStr(cursor) <= endIso) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const iso = isoDateStr(addDays(cursor, i));
      if (iso >= startIso && iso <= endIso) days.push(iso);
    }
    if (days.length > 0) weeks.push({ start: isoDateStr(cursor), days, complete: days[days.length - 1] < todayIso });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

// Último mês/período: o aviso só aparece na última semana do período (ou depois
// dela, no fecho atrasado). A lista de Revisões abre sempre.
function inReviewWindow(period, today) {
  if (!period || !period.end) return false;
  const todayIso = typeof today === "string" ? today : isoDateStr(today || new Date());
  return todayIso >= isoDateStr(addDays(period.end, -6));
}

// Analisa UMA semana de UM cliente. `days` = datas ISO (já cortadas ao período).
// Devolve { expected, visits, issues } com issues join/extra/missing (os
// conflitos e as sobras vêm de `listConflicts`/`planLeftovers`).
function analyseClientWeek(horasData, client, days, ctx, opts = {}) {
  const cid = client.id;
  const expected = [];
  days.forEach((d) => { const ids = expectedTeamIds(ctx, client, d); if (ids.length > 0) expected.push({ date: d, teamIds: ids }); });
  const edMap = new Map(expected.map((x) => [x.date, x]));
  const daySet = new Set(days);
  const groups = new Map();
  Object.keys(horasData || {}).forEach((sid) => {
    ((horasData[sid] && horasData[sid].entries) || []).forEach((e, idx) => {
      if (e.voided || e.clientId !== cid || !daySet.has(e.date)) return;
      const v = visitDateOf(e);
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push({ staffId: sid, idx, workDate: e.date, hours: e.hours || 0, entry: e });
    });
  });
  const isResolved = (marks) => marks.every((m) => m.entry.reviewOk);
  const saidNo = (marks) => marks.some((m) => m.entry.sameAnswer === "no");
  const issues = [];
  const usedE = new Set();
  const matchedDates = [...groups.keys()].filter((d) => edMap.has(d)).sort();
  const strayDates = [...groups.keys()].filter((d) => !edMap.has(d)).sort();
  strayDates.forEach((g) => {
    const marks = groups.get(g);
    if (isResolved(marks)) return;
    const staffSet = new Set(marks.map((m) => String(m.staffId)));
    let join = null;
    if (!saidNo(marks)) {
      // (1) visita prevista em que NINGUÉM registou e em que alguém deste grupo era esperado
      let best = null;
      expected.forEach((x) => {
        if (groups.has(x.date) || usedE.has(x.date)) return;
        const overlap = x.teamIds.filter((id) => staffSet.has(String(id))).length;
        if (overlap === 0) return;
        const dist = Math.abs(daysBetweenIso(x.date, g));
        if (!best || overlap > best.overlap || (overlap === best.overlap && dist < best.dist)) best = { x, overlap, dist };
      });
      if (best) {
        usedE.add(best.x.date);
        join = { target: best.x.date, reason: "moved", marks, teamIds: best.x.teamIds, targetMarks: [] };
      }
      // (2) visita já registada em que alguém deste grupo era esperado e não registou
      if (!join) {
        for (const v of matchedDates) {
          const ed = edMap.get(v);
          const vMarks = groups.get(v);
          const vStaff = new Set(vMarks.map((m) => String(m.staffId)));
          const team = ed.teamIds.map(String);
          const qualify = marks.filter((m) => team.includes(String(m.staffId)) && !vStaff.has(String(m.staffId)));
          if (qualify.length > 0) { join = { target: v, reason: "partner", marks: qualify, teamIds: ed.teamIds, targetMarks: vMarks }; break; }
        }
      }
    }
    if (join) {
      issues.push({ kind: "join", key: `join|${cid}|${g}|${join.target}`, clientId: cid, date: join.target, fromDate: g, reason: join.reason, marks: join.marks, targetMarks: join.targetMarks, teamIds: join.teamIds });
      const rest = marks.filter((m) => !join.marks.includes(m));
      if (rest.length > 0) issues.push({ kind: "extra", key: `extra|${cid}|${g}|rest`, clientId: cid, date: g, marks: rest, answered: false });
    } else {
      issues.push({ kind: "extra", key: `extra|${cid}|${g}`, clientId: cid, date: g, marks, answered: saidNo(marks) });
    }
  });
  const noneDates = new Set();
  expected.forEach((x) => {
    if (groups.has(x.date) || usedE.has(x.date)) return;
    const ackKey = `${x.date}|${cid}`;
    const acked = x.teamIds.some((id) => horasData[id] && horasData[id].visitChecks && horasData[id].visitChecks[ackKey] === "none");
    const allNoClient = x.teamIds.every((id) => horasData[id] && (horasData[id].noClientDays || []).includes(x.date));
    if (acked || allNoClient) { noneDates.add(x.date); return; }
    if (opts.reportMissing) issues.push({ kind: "missing", key: `missing|${cid}|${x.date}`, clientId: cid, date: x.date, teamIds: x.teamIds, marks: [] });
  });
  const visits = [
    ...expected.map((x) => ({ date: x.date, expected: true, teamIds: x.teamIds, marks: groups.get(x.date) || [] })),
    ...strayDates.map((g) => ({ date: g, expected: false, teamIds: [], marks: groups.get(g) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { expected, visits, issues, noneDates };
}

// Nomes parecidos (cliente escrito à mão ↔ cliente da lista): palavras iguais.
function normName(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function nameCandidates(name, clients, limit = 3) {
  const n = normName(name);
  if (!n) return [];
  const toks = new Set(n.split(" ").filter(Boolean));
  return (clients || []).map((c) => {
    const ct = new Set(normName(c.name).split(" ").filter(Boolean));
    if (ct.size === 0) return { id: c.id, score: 0 };
    let inter = 0;
    toks.forEach((t) => { if (ct.has(t)) inter += 1; });
    let score = inter / new Set([...toks, ...ct]).size;
    const subset = (a, b) => [...a].every((t) => b.has(t));
    if (subset(toks, ct) || subset(ct, toks)) score = Math.max(score, 0.8);
    return { id: c.id, score };
  }).filter((x) => x.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.id);
}

// Conferência completa do período. Devolve
//   { issues, clients, totals, byKind }
//   issues  — problemas abertos (ordenados por cliente e data)
//   clients — [{ clientId, name, expected, checked, weeks:[{ start, complete, visits:[{ date, expected, teamIds, marks, state }] }] }]
//             (`expected`/`checked` só contam semanas já terminadas)
//   totals  — { expected, checked, clientsOk, clientsTotal, checkedUntil }
function reconcileVisits(horasData, clients, period, ctx, today) {
  const todayIso = typeof today === "string" ? today : isoDateStr(today || new Date());
  const weeks = weeksOfPeriod(period, todayIso);
  const issues = [];
  const rows = [];
  const joinTargets = new Set();
  const missingByClient = new Map();
  // Primeiro registo de cada cliente no período (ajuda a perceber "este cliente só começou a 12/10").
  const firstRecord = new Map();
  Object.keys(horasData || {}).forEach((sid) => ((horasData[sid] && horasData[sid].entries) || []).forEach((e) => {
    if (e.voided || !e.clientId || (period && !dateStrInPeriod(e.date, period))) return;
    const d = visitDateOf(e) < e.date ? visitDateOf(e) : e.date;
    if (!firstRecord.has(e.clientId) || d < firstRecord.get(e.clientId)) firstRecord.set(e.clientId, d);
  }));
  (clients || []).forEach((client) => {
    const row = { clientId: client.id, name: client.name, expected: 0, checked: 0, weeks: [] };
    weeks.forEach((week) => {
      const a = analyseClientWeek(horasData, client, week.days, ctx, { reportMissing: week.complete });
      a.issues.forEach((i) => {
        i.weekStart = week.start;
        if (i.kind === "missing") {
          if (!missingByClient.has(i.clientId)) missingByClient.set(i.clientId, []);
          missingByClient.get(i.clientId).push({ date: i.date, teamIds: i.teamIds, weekStart: week.start });
          return;
        }
        issues.push(i);
        if (i.kind === "join") joinTargets.add(`${i.date}|${i.clientId}`);
      });
      row.weeks.push({ start: week.start, complete: week.complete, visits: a.visits, noneDates: a.noneDates });
    });
    rows.push(row);
  });
  // "Sem registo": um cartão por cliente com todas as datas (a agenda usada é a de
  // hoje, por isso um cliente novo aparece com as semanas em que ainda não existia).
  missingByClient.forEach((list, cid) => {
    list.sort((x, y) => x.date.localeCompare(y.date));
    issues.push({
      kind: "missing", key: `missing|${cid}`, clientId: cid, date: list[0].date, weekStart: list[0].weekStart, dates: list, marks: [],
      teamIds: [...new Set(list.flatMap((x) => x.teamIds.map(String)))].map((id) => (list.flatMap((x) => x.teamIds).find((t) => String(t) === id))),
      firstRecord: firstRecord.get(cid) || null,
    });
  });
  // Sobras: as que esperam por um "juntar" ficam de fora (depois de juntar, recalculam-se).
  planLeftovers(horasData, clients, period, ctx, todayIso).forEach((it) => {
    if (joinTargets.has(it.key)) return;
    issues.push({
      kind: "leftover", key: `leftover|${it.key}`, clientId: it.clientId, date: it.date, weekStart: isoDateStr(startOfISOWeek(dateFromIso(it.date))),
      markerIds: it.markerIds, missingIds: it.missingIds, leftoverHours: it.leftoverHours,
      marks: markersOf(horasData, it.date, it.clientId).map((m) => ({ staffId: m.staffId, workDate: m.entry.date, hours: m.entry.hours || 0 })),
    });
  });
  listConflicts(horasData).filter((c) => !period || dateStrInPeriod(c.date, period)).forEach((c) => {
    issues.push({
      kind: "conflict", key: `conflict|${c.key}`, clientId: c.clientId, date: c.date, weekStart: isoDateStr(startOfISOWeek(dateFromIso(c.date))),
      marks: c.marks.map((m) => ({ ...m, workDate: c.date })),
    });
  });
  Object.keys(horasData || {}).forEach((sid) => {
    ((horasData[sid] && horasData[sid].entries) || []).forEach((e, idx) => {
      if (!isPendingClientEntry(e) || (period && !dateStrInPeriod(e.date, period))) return;
      issues.push({
        kind: "pending", key: `pending|${sid}|${e.date}|${e.custom.name}`, clientId: null, staffId: sid, idx, date: e.date,
        weekStart: isoDateStr(startOfISOWeek(dateFromIso(e.date))),
        name: e.custom.name, city: e.custom.city || "", hours: e.hours || 0, candidates: nameCandidates(e.custom.name, clients),
        marks: [{ staffId: sid, workDate: e.date, hours: e.hours || 0 }],
      });
    });
  });
  // Pago: não se mexe nas horas de quem já recebeu.
  issues.forEach((i) => {
    const staffIds = [...(i.marks || []), ...(i.targetMarks || [])].map((m) => m.staffId);
    i.paid = staffIds.some((sid) => horasData[sid] && horasData[sid].paid);
  });
  // Estado de cada visita + contagens.
  const touched = new Map();
  issues.forEach((i) => {
    if (i.clientId == null || i.kind === "pending") return;
    if (!touched.has(i.clientId)) touched.set(i.clientId, new Set());
    const set = touched.get(i.clientId);
    if (i.kind === "missing") i.dates.forEach((x) => set.add(x.date)); else set.add(i.date);
  });
  // Cliente que não está na agenda de ninguém neste período: os registos dele são "extra" por definição.
  const hasExpected = new Set(rows.filter((r) => r.weeks.some((w) => w.visits.some((v) => v.expected))).map((r) => r.clientId));
  issues.forEach((i) => { if (i.kind === "extra") i.notInAgenda = !hasExpected.has(i.clientId); });
  let expectedTotal = 0, checkedTotal = 0, clientsOk = 0, clientsTotal = 0;
  const outRows = [];
  rows.forEach((row) => {
    const t = touched.get(row.clientId) || new Set();
    let any = false;
    row.weeks.forEach((w) => {
      w.visits.forEach((v) => {
        any = true;
        if (t.has(v.date)) v.state = "issue";
        else if (!v.expected) v.state = "ok";
        else if (v.marks.length > 0) v.state = "ok";
        else if (w.noneDates.has(v.date)) v.state = "none";
        else v.state = w.complete ? "issue" : "open";
        if (v.expected && w.complete) {
          row.expected += 1;
          if (v.state === "ok" || v.state === "none") row.checked += 1;
        }
      });
    });
    if (any) {
      outRows.push(row);
      if (row.expected > 0) { clientsTotal += 1; if (row.checked === row.expected && !t.size) clientsOk += 1; }
      expectedTotal += row.expected; checkedTotal += row.checked;
    }
  });
  const lastComplete = [...weeks].reverse().find((w) => w.complete);
  const nameOf = (id) => { const c = clientById(clients, id); return c ? c.name : ""; };
  issues.sort((a, b) => (nameOf(a.clientId) || a.name || "").localeCompare(nameOf(b.clientId) || b.name || "") || a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  outRows.sort((a, b) => a.name.localeCompare(b.name));
  const byKind = {};
  issues.forEach((i) => { byKind[i.kind] = (byKind[i.kind] || 0) + 1; });
  return {
    issues, clients: outRows, byKind,
    totals: { expected: expectedTotal, checked: checkedTotal, clientsOk, clientsTotal, checkedUntil: lastComplete ? lastComplete.days[lastComplete.days.length - 1] : null },
  };
}

// Números para os avisos (selo do menu, cartão do Dashboard, botão "Revisões").
// `total` inclui tudo o que está na lista; `attention` exclui os clientes fora da
// lista (o Dashboard já tem uma linha só para esses).
function countReviews(horasData, clients, period, ctx, today) {
  const r = reconcileVisits(horasData, clients, period, ctx, today);
  const k = r.byKind;
  const total = r.issues.length;
  return {
    conflicts: k.conflict || 0, leftovers: k.leftover || 0, joins: k.join || 0, extras: k.extra || 0, missing: k.missing || 0, pending: k.pending || 0,
    total, attention: total - (k.pending || 0),
  };
}

// Efeito de uma alteração em horas e euros por pessoa (para mostrar na lista).
function hoursImpact(before, after, clients, period) {
  const out = [];
  Object.keys(after || {}).forEach((sid) => {
    const b = (before && before[sid]) || { entries: [] };
    const a = after[sid] || { entries: [] };
    const dh = staffTotalHours(a, period) - staffTotalHours(b, period);
    const de = staffTotalPay(a, clients, period) - staffTotalPay(b, clients, period);
    if (Math.abs(dh) > 1e-9 || Math.abs(de) > 1e-9) out.push({ staffId: sid, hours: dh, euros: de });
  });
  return out;
}

const matchesMark = (e, m, clientId) => !e.voided && e.clientId === clientId && e.date === m.workDate;

// Junta as marcas do problema `join` à visita prevista (`issue.date`). Com
// `opts.isFrozen`, as linhas de quem já fechou a semana ficam como estão (a
// gerência junta-as depois na lista).
function applyJoinIssue(horasData, clients, issue, ctx, opts = {}) {
  if (issue.paid && !opts.force) return horasData;
  let next = horasData;
  issue.marks.forEach((m) => {
    const h = next[m.staffId];
    if (opts.isFrozen && h) {
      const line = (h.entries || []).find((e) => matchesMark(e, m, issue.clientId));
      if (line && opts.isFrozen(m.staffId, h, line) && String(m.staffId) !== String(opts.selfId)) return;
    }
    next = joinVisit(next, clients, m.staffId, m.workDate, issue.clientId, issue.date, ctx, opts.isFrozen ? { isFrozen: opts.isFrozen } : {});
  });
  return next;
}
// "São visitas diferentes" / "Aceitar como visita extra": as linhas ficam como
// estão e deixam de aparecer na lista.
function acceptExtra(horasData, issue) {
  const next = { ...horasData };
  (issue.marks || []).forEach((m) => {
    const h = next[m.staffId];
    if (!h) return;
    next[m.staffId] = { ...h, entries: h.entries.map((e) => (matchesMark(e, m, issue.clientId) ? { ...e, reviewOk: true } : e)) };
  });
  return next;
}
// "São visitas diferentes" (em vez de juntar): o registo fica como visita
// separada e a visita prevista volta a contar com quem a agenda esperava (a
// sobra de quem não registou aparece, como sempre, para confirmar).
function keepSeparate(horasData, clients, issue, ctx) {
  const next = acceptExtra(horasData, issue);
  return issue.kind === "join" ? recomputeSharedHours(next, clients, issue.date, issue.clientId, { ctx }) : next;
}
// "Anular horas": reversível (a linha anulada repõe-se em Horas).
function voidExtra(horasData, clients, issue, ctx) {
  if (issue.paid) return horasData;
  let next = { ...horasData };
  (issue.marks || []).forEach((m) => {
    const h = next[m.staffId];
    if (!h) return;
    next[m.staffId] = { ...h, entries: h.entries.map((e) => (matchesMark(e, m, issue.clientId) ? { ...e, voided: true } : e)) };
  });
  return recomputeSharedHours(next, clients, issue.date, issue.clientId, { ctx });
}
// "Não houve visita": guarda em cada pessoa da equipa esperada que a gerência
// confirmou que essa visita não aconteceu.
function ackMissing(horasData, issue) {
  const next = { ...horasData };
  const dates = issue.dates && issue.dates.length ? issue.dates : [{ date: issue.date, teamIds: issue.teamIds || [] }];
  dates.forEach((x) => {
    (x.teamIds || []).forEach((id) => {
      const h = next[id] || { status: "pendente", paid: false, entries: [], lockedWeeks: {}, noClientDays: [], reopened: false };
      next[id] = { ...h, visitChecks: { ...(h.visitChecks || {}), [`${x.date}|${issue.clientId}`]: "none" } };
    });
  });
  return next;
}
// Cliente escrito à mão → cliente da lista (mesma regra do botão de editar a
// linha em Horas: só redivide se houver mais alguém nessa visita).
function assignPendingEntry(horasData, clients, issue, clientId, ctx) {
  if (issue.paid) return horasData;
  const staffId = issue.staffId;
  const h = horasData[staffId];
  if (!h) return horasData;
  const idx = h.entries.findIndex((e) => isPendingClientEntry(e) && e.date === issue.date && e.custom.name === issue.name);
  if (idx < 0) return horasData;
  const old = h.entries[idx];
  const { splitAdjusted, splitHours, shareReview, sharedCount, teamConfirmed, conflict, solo, soloCheck, custom, ...base } = old;
  let next = { ...horasData, [staffId]: { ...h, entries: h.entries.map((e, i) => (i === idx ? { ...base, clientId } : e)) } };
  const v = visitDateOf(old);
  const others = Object.keys(next).some((sid) => String(sid) !== String(staffId)
    && (next[sid].entries || []).some((e) => visitDateOf(e) === v && e.clientId === clientId && !e.voided));
  if (others) next = recomputeSharedHours(next, clients, v, clientId, { ctx });
  return next;
}

// Aplica a SUGESTÃO de um problema (a ação que vem pré-escolhida na lista).
//   join → juntar · extra → aceitar · missing → "não houve visita" · leftover → passar a sobra
// Conflitos e clientes fora da lista pedem uma escolha própria (não têm sugestão).
function applySuggestion(horasData, clients, issue, ctx) {
  if (issue.kind === "join") return applyJoinIssue(horasData, clients, issue, ctx);
  if (issue.kind === "extra") return acceptExtra(horasData, issue);
  if (issue.kind === "missing") return ackMissing(horasData, issue);
  if (issue.kind === "leftover") return applyLeftovers(horasData, clients, [{ date: issue.date, clientId: issue.clientId, markerIds: issue.markerIds }], ctx);
  return horasData;
}

// --- Desencontro na hora de marcar (app do funcionário) --------------------
// Ao marcar `clientId` em `workDate`, há um colega que marcou o mesmo cliente
// noutro dia da mesma semana e o sistema acha que é a MESMA visita? Devolve
// { issue, colleagueIds, dates } ou null. Só para clientes "dividida", e só
// quando há marcação de um colega envolvida (sem colega não há desencontro).
function findSameVisit(state, client, ctx, staffId, workDate) {
  const week = startOfISOWeek(dateFromIso(workDate));
  const days = [];
  for (let i = 0; i < 7; i++) days.push(isoDateStr(addDays(week, i)));
  const a = analyseClientWeek(state, client, days, ctx, {});
  const sid = String(staffId);
  const mine = (m) => String(m.staffId) === sid && m.workDate === workDate;
  const j = a.issues.find((i) => i.kind === "join" && (i.marks.some(mine) || i.targetMarks.some(mine)));
  if (!j) return null;
  const colleagues = [...j.marks, ...j.targetMarks].filter((m) => String(m.staffId) !== sid);
  if (colleagues.length === 0) return null;
  const colleagueIds = [...new Set(colleagues.map((m) => String(m.staffId)))];
  const dates = [...new Set(colleagues.map((m) => m.workDate))].sort();
  return { issue: j, colleagueIds, dates, target: j.date };
}
function addHypotheticalEntry(horasData, staffId, entry) {
  const own = horasData[staffId] || { status: "pendente", paid: false, entries: [], lockedWeeks: {}, noClientDays: [], reopened: false };
  return { ...horasData, [staffId]: { ...own, entries: [...(own.entries || []), entry] } };
}
function suggestSameVisit(horasData, clients, ctx, staffId, clientId, workDate, replacesDate) {
  const client = clientById(clients, clientId);
  if (!client || client.hoursMode === "individual" || replacesDate) return null;
  const state = addHypotheticalEntry(horasData, staffId, { date: workDate, clientId, hours: 0, voided: false });
  return findSameVisit(state, client, ctx, staffId, workDate);
}
// "Sim, é a mesma visita": liga as marcas à visita prevista (as linhas de colegas
// com a semana fechada não se mexem; a gerência junta-as depois).
function linkSameVisit(horasData, clients, ctx, staffId, clientId, workDate, opts = {}) {
  const client = clientById(clients, clientId);
  if (!client) return horasData;
  const sug = findSameVisit(horasData, client, ctx, staffId, workDate);
  if (!sug) return horasData;
  return applyJoinIssue(horasData, clients, { ...sug.issue, paid: false }, ctx, { ...opts, selfId: staffId });
}

// Recalcula as horas JÁ LANÇADAS de um período com a duração ATUAL dos clientes
// (quando a gerência corrige a duração/modo de um cliente depois de a equipa já
// ter registado: as linhas guardam as horas do momento do registo, por isso o
// valor a pagar não mexia). Pura: devolve `next` (horasData novo) e `changes`
// (uma por linha cujas horas mudam). Usa `recomputeSharedHours` por (dia,
// cliente), logo respeita a divisão entre colegas, as partes ajustadas à mão
// (`splitAdjusted`) e os minutos extra. Linhas anuladas e as sem cliente
// (`clientId` vazio) ficam como estão.
//   opts.skipStaffIds — funcionários cujas linhas NÃO se mexem (ex.: já pagos);
//                       continuam a contar como participantes para a parte dos outros.
//   opts.clientIds    — se dado, só estes clientes.
//   opts.ctx          — { staff, assignments, covers, absences }: a divisão conta também com quem a agenda esperava (ver `expectedTeamIds`).
function planHoursRecalc(horasData, clients, period, opts = {}) {
  const skip = new Set((opts.skipStaffIds || []).map(String));
  const only = opts.clientIds ? new Set(opts.clientIds) : null;
  let next = horasData;
  entryPairs(horasData, period, only).forEach(({ date, clientId }) => {
    next = recomputeSharedHours(next, clients, date, clientId, opts.ctx ? { ctx: opts.ctx } : {});
  });
  // Quem está em `skipStaffIds` volta exatamente ao que era (sem marcas de
  // "rever divisão"); os colegas ficam com a parte já calculada com ele a contar.
  if (skip.size > 0) {
    next = { ...next };
    Object.keys(horasData || {}).forEach((sid) => { if (skip.has(String(sid))) next[sid] = horasData[sid]; });
  }
  const changes = [];
  Object.keys(horasData || {}).forEach((sid) => {
    const before = horasData[sid].entries || [];
    const after = (next[sid] && next[sid].entries) || [];
    before.forEach((e, idx) => {
      const a = after[idx];
      if (a && !e.voided && Math.abs((a.hours || 0) - (e.hours || 0)) > 1e-9) {
        changes.push({ staffId: sid, idx, date: e.date, clientId: e.clientId, oldHours: e.hours || 0, newHours: a.hours || 0 });
      }
    });
  });
  return { next, changes };
}

function staffById(staff, id) { return staff.find((s) => s.id === id); }

// Dupla (casal/parceiros habituais): definida pela gerência em Funcionários,
// sempre mútua. `partnerOf` devolve o parceiro só se a ligação é recíproca e
// ele está ativo — senão null (sem dupla, nada é preenchido por ele).
function partnerOf(staffList, staffId, date) {
  const me = staffList.find((s) => s.id === staffId);
  if (!me || !me.partnerId) return null;
  const p = staffList.find((s) => s.id === me.partnerId);
  if (!p || p.partnerId !== me.id) return null;
  return isStaffActive(p, date || new Date()) ? p : null;
}
// Liga `staffId` a `partnerId` (ou desliga com null), mantendo a ligação
// mútua e limpando qualquer parceiro antigo de qualquer um dos dois.
function linkPartners(staffList, staffId, partnerId) {
  return staffList.map((s) => {
    if (s.id === staffId) return { ...s, partnerId: partnerId || null };
    if (partnerId && s.id === partnerId) return { ...s, partnerId: staffId };
    if (s.partnerId === staffId || (partnerId && s.partnerId === partnerId)) return { ...s, partnerId: null };
    return s;
  });
}

// Etapa 4j (documento, 4.9) — único auxiliar que decide se um funcionário
// está "ativo" em todo o app: `estado Ativo && !(tipo Replacement &&
// validade < data)`. A validade é INCLUSIVA (no próprio dia da validade
// ainda está ativo — por isso a comparação é "<", nunca "<="). Calculado
// na hora, nunca gravado: se a gerência prolongar a validade, a pessoa
// volta a estar ativa imediatamente, sem precisar de nenhuma tarefa
// agendada. `date` aceita qualquer data de referência (não só "hoje") —
// chamado com um dia específico, responde "estaria ativo nesse dia?",
// o que é exatamente o que a agenda do funcionário (4.9, "Aplicação do
// funcionário: os dias a seguir à validade ficam sem clientes") precisa.
// `validUntil` vem como "YYYY-MM-DD" (input type="date") — compara-se com
// a mesma convenção de data local usada em todo o resto do projeto (nunca
// `Date.parse` direto numa string ISO, que é UTC e pode desviar um dia).
function isStaffActive(staff, date) {
  if (!staff) return false;
  if (staff.status !== "ativo") return false;
  if (staff.accountType === "replacement" && staff.validUntil) {
    const [y, m, d] = staff.validUntil.split("-").map(Number);
    const validUntilDate = new Date(y, m - 1, d);
    if (validUntilDate < date) return false;
  }
  return true;
}

// QA pós-auditoria (Lote 1, "Fechar período" e as contagens): staff que
// conta nos números de pagamento de Horas e do Dashboard — ativo HOJE OU
// com pelo menos um lançamento não anulado no período aberto (ex.: alguém
// desativado a meio do período que ainda tem horas por pagar). Sem busca
// nem chip — isso é só do `visibleStaff` da tabela de Horas, que filtra
// esta lista por cima. Partilhado entre HorasScreen e DashboardScreen para
// os dois nunca divergirem (antes cada tela fazia a sua própria conta:
// HorasScreen com este mesmo filtro, Dashboard com `staff` inteiro — os
// números não batiam).
function boardStaff(staffList, horasData, period, today) {
  function hasEntriesInOpenPeriod(s) {
    const h = horasData[s.id];
    return !!h && (h.entries || []).some((e) => !e.voided && dateStrInPeriod(e.date, period));
  }
  return staffList.filter((s) => isStaffActive(s, today) || hasEntriesInOpenPeriod(s));
}

// QA pós-auditoria (Lote 3, item 4 do briefing — "'Ativo' com uma
// definição só"): o Dashboard mostrava `clients.length` puro (41) e
// ClientesScreen.jsx excluía quem já tinha contrato vencido (37) — os
// dois números não batiam. Uma versão anterior deste helper tinha optado
// por excluir os vencidos (37); o Iago reconfirmou em 04/10 que quer os
// 41 — todo cliente cadastrado conta como "ativo", um contrato vencido
// vira só uma pendência à parte (cartão de Pendências), não tira o
// cliente da contagem.
function activeClientsCount(clients, today) {
  return clients.length;
}

function pad2(n) { return String(n).padStart(2, "0"); }

// Formatador único de dinheiro pra app inteira (documento de design, 1.5):
// símbolo à frente, espaço, milhar separado, vírgula decimal — "€ 9 266,00".
// O separador de milhar usa espaço-sem-quebra (NBSP,  ) em vez do
// "espaço fino" tipográfico ( ) sugerido no documento: os PDFs
// (pdfExport.js) usam as fontes padrão do jsPDF, que só cobrem
// WinAnsiEncoding —   não existe nesse conjunto e sairia como um
// caractere em branco/errado no PDF, enquanto   faz parte do
// Windows-1252 e sai corretamente tanto no ecrã como no PDF. Visualmente o
// resultado é o mesmo (um espaço que não quebra linha no meio do número).
function fmtEuro(v) {
  const neg = v < 0;
  const [intPart, decPart] = Math.abs(v).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `€ ${neg ? "-" : ""}${grouped},${decPart}`;
}

// Versão compacta pro rótulo direto na barra do gráfico (o slot tem uns
// 40-50px, "€ 9914,50" não cabe sem colidir com o vizinho). O tooltip
// continua mostrando o valor completo via fmtEuro.
function compactEuro(v) {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `€${Math.round(v)}`;
}

function fmtHoursNum(h) { return h.toFixed(2).replace(".", ","); }

// Formatador de horas PARA O ECRÃ (documento de design, 1.5): "2h30",
// "1h", "41h", "38h30", "45min" — nunca decimais como "2,50" ou "41,00h"
// (isso é só pra PDF/exportações, que continuam usando fmtHoursNum).
// Recebe horas em decimal (ex.: 38.5) pra bater com o resto do app, que
// guarda totais de horas assim. Reaproveita a mesma lógica de fmtMinutes.
// Introduzido na Etapa 1 (fundação/formatadores); já ligado a todos os
// ecrãs redesenhados na Etapa 4 (gerência e funcionário/supervisor) —
// comentário antigo (dizia "ainda não ligado a nenhum ecrã") corrigido
// aqui, varredura de QA pós-Etapa 4, sem mudança de comportamento.
function fmtHoursScreen(hoursDecimal) {
  if (!hoursDecimal || hoursDecimal <= 0) return "0h";
  return fmtMinutes(Math.round(hoursDecimal * 60));
}

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
    // Nº de clientes NO MOMENTO do fecho — sem isto, a faixa histórica de
    // Reclamações (Histórico) recalculava contra a lista de clientes de
    // HOJE, e um período fechado há meses ia "andando" toda vez que um
    // cliente era criado/removido depois. Fica congelado aqui.
    clientCount: clients.length,
  };
}

// Lote 4, 4.8 (achado da Marta, confirmado pelo Iago): o período vai até o
// dia exato do corte, incluindo-o — com corte 20, "21 Set a 20 Out", não
// "20 Set a 19 Out" (como era antes: o dia do corte abria o período
// seguinte, nunca fechava o atual). Por isso o limiar de mês também sobe de
// `<` pra `<=` (o próprio dia do corte já pertence ao período que está a
// fechar, não ao que começa) e `start`/`end` passam a `cutoffDay + 1` /
// `cutoffDay`, não `cutoffDay` / `cutoffDay - 1`.
function getCutoffPeriod(baseDate, cutoffDay, offset) {
  let year = baseDate.getFullYear(), month = baseDate.getMonth();
  if (baseDate.getDate() <= cutoffDay) month -= 1;
  month += offset;
  return { start: new Date(year, month, cutoffDay + 1), end: new Date(year, month + 1, cutoffDay) };
}

// O período "aberto" (o próximo a fechar) devia ser sempre "o dia seguinte ao
// fim do último período fechado", NÃO "onde TODAY cai" por matemática pura —
// senão um fecho tardio (gerência fecha com atraso) faz a UI já mostrar
// "hoje" dentro do período seguinte enquanto o período anterior ainda nem foi
// fechado, e horasData ainda contém a mistura das duas fases. Deriva do
// HISTÓRICO real (closedPeriods, sempre com o mais recente em [0] — ver
// recentClosedPeriodsChronological) em vez de TODAY. Sem histórico nenhum
// (empresa nova, ainda não fechou nada), cai de volta ao cálculo por TODAY.
function getOpenPeriod(closedPeriods, cutoffDay, today) {
  if (!closedPeriods || closedPeriods.length === 0) {
    return getCutoffPeriod(today, cutoffDay, 0);
  }
  const lastClosed = closedPeriods[0];
  const [y, m, d] = lastClosed.periodEnd.split("-").map(Number);
  const lastEnd = new Date(y, m - 1, d);
  const start = addDays(lastEnd, 1);
  // Lote 4, 4.8: idem `getCutoffPeriod` (fecha NO dia do corte, não no dia
  // antes) — mas `start` fica como já estava, derivado do histórico real
  // (dia seguinte ao fim do último período fechado), não recalculado por
  // `cutoffDay`. É exatamente isso que faz a virada ser "de uma vez só": no
  // primeiro período aberto depois da mudança, `start` ainda reflete a
  // convenção antiga de quem fechou por último (dia 20) e só `end` já usa a
  // nova (dia do corte, não dia-1) — o período fica um dia mais longo essa
  // única vez (ex.: 20 Ago a 20 Set), e dali em diante os dois lados já
  // nascem na convenção nova (21 a 20).
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cutoffDay);
  return { start, end };
}

// Prazo obrigatório de fecho do mês: o período aberto já terminou (`ended`) e a
// gerência/funcionário têm `days` dias para finalizar/fechar; passado isso
// (`overdue`) os lançamentos e o Dashboard ficam bloqueados até fechar.
function closeDeadlineInfo(period, today, days) {
  const deadline = addDays(period.end, Math.max(1, days || 7));
  const ended = today > period.end;
  const overdue = today > deadline;
  const daysLeft = Math.max(0, Math.round((deadline - today) / 86400000));
  return { ended, overdue, deadline, daysLeft };
}

// Início de atividade do funcionário: campo explícito ou, para contas criadas
// no app (id = Date.now()), a data de criação. Antes disso não há "dias em falta".
function staffStartedOn(staffMember, d) {
  if (!staffMember) return true;
  let t = staffMember.startDate ? new Date(staffMember.startDate + "T00:00:00") : (Number(staffMember.id) > 1e12 ? new Date(Number(staffMember.id)) : null);
  if (!t || isNaN(t)) return true;
  t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return d >= t;
}

// QA (achado do Iago, Avisos — "esses pedidos são de um mês já fechado"):
// um Pedido (missingItems) não tem ligação nenhuma com o período de
// pagamento — só uma `date` solta (string). Quando essa `date` é ISO
// (`"YYYY-MM-DD"`, como todo Pedido criado em tempo real já grava — ver
// `sendCorrectionRequest` em EmployeeHorasScreen.jsx) e cai ANTES do
// início do período aberto (`openPeriod.start`, de `getOpenPeriod`), o
// pedido é de um período que já fechou. Dados de demonstração antigos
// (data.js) guardam `date` como "DD/MM" sem ano (ver comentário em
// `fmtNoteDate`) — sem ano não dá pra comparar com segurança, por isso
// esses sempre devolvem `false` aqui (nunca marcados como "fechado",
// nunca escondidos) em vez de arriscar um ano errado.
function isSolicitationStale(m, openPeriod) {
  if (!m.date || !m.date.includes("-")) return false;
  const [y, mo, d] = m.date.split("-").map(Number);
  const itemDate = new Date(y, mo - 1, d);
  return itemDate < openPeriod.start;
}

// Quantos itens de Avisos a gerência ainda NÃO viu: pedidos dos funcionários
// por tratar que ainda não abriu (`seenByManagement`) + reclamações/elogios/
// avisos que não foram enviados por ela e ainda não abriu. Serve ao selo do
// menu e à pendência "Avisos e pedidos por ler" do Dashboard. Antes o selo
// contava TODOS os pedidos por resolver, mesmo os já vistos, e nunca
// desaparecia enquanto o pedido não fosse resolvido. Pedidos de períodos já
// fechados ficam de fora (`isSolicitationStale`), tal como na tela.
function unseenAvisosCount(missingItems, sentItems, openPeriod) {
  const pedidos = (missingItems || []).filter((m) => !m.resolved && !m.seenByManagement && !isSolicitationStale(m, openPeriod)).length;
  const enviados = (sentItems || []).filter((i) => !i.seenByManagement).length;
  return pedidos + enviados;
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
  // Semana de referência própria do cliente (escolhida pela gerência no
  // cadastro, "YYYY-MM-DD"); sem ela vale a referência global de antes.
  let ref = REFERENCE_WEEK_START;
  if (client.frequencyAnchor && /^\d{4}-\d{2}-\d{2}$/.test(client.frequencyAnchor)) {
    const [y, m, d] = client.frequencyAnchor.split("-").map(Number);
    ref = startOfISOWeek(new Date(y, m - 1, d));
  }
  const diff = weekDiff(weekStart, ref);
  if (client.frequency === "weekly") return true;
  if (client.frequency === "biweekly") return ((diff % 2) + 2) % 2 === 0;
  if (client.frequency === "monthly") return ((diff % 4) + 4) % 4 === 0;
  // "dia sim, dia não" decide-se por DIA (ver clientAppliesOnDate); ao nível
  // da semana há sempre alguma visita.
  return true;
}

// Aplicação do cliente numa DATA concreta. Igual a clientAppliesThisWeek,
// exceto "dia sim, dia não" ("alternate"): visita de 2 em 2 dias a contar do
// dia de referência do cliente (frequencyAnchor) — ou, sem ele, da
// referência global. Como o molde semanal tem os mesmos dias em toda a
// semana, a paridade alterna de uma semana para a outra, como esperado.
function clientAppliesOnDate(client, date) {
  if (!clientAppliesThisWeek(client, startOfISOWeek(date))) return false;
  if (client.frequency !== "alternate") return true;
  let ref = REFERENCE_WEEK_START;
  if (client.frequencyAnchor && /^\d{4}-\d{2}-\d{2}$/.test(client.frequencyAnchor)) {
    const [y, m, d] = client.frequencyAnchor.split("-").map(Number);
    ref = new Date(y, m - 1, d);
  }
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return (((Math.round((a - b) / 86400000)) % 2) + 2) % 2 === 0;
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
// O período de pagamento vai de dia 21 a dia 20 (Lote 4, 4.8) e a semana
// civil é segunda-domingo; como o período raramente começa numa segunda ou
// acaba num domingo, `weekChunksOfPayPeriod` às vezes devolve um bloco de só
// 1 dia numa ponta (ex.: período 21 jun–20 jul 2026, em que 21 jun cai num
// domingo — só esse dia sobra da semana anterior — e 20 jul numa segunda —
// só esse dia sobra da semana seguinte). Um bloco de 1 dia sozinho não faz
// sentido pra navegação/finalização, então junta-se ao bloco vizinho.
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

// Devolve os blocos "visíveis" do período (o que a UI mostra: normalmente 4,
// dois deles com 8 dias quando há fusão nas pontas). A chave de cada bloco
// (pra `lockedWeeks`) é `isoDateStr(block.start)`.
function weekBlocksOfPayPeriod(payPeriod, cutoffDay) {
  return mergeEdgeBlocks(weekChunksOfPayPeriod(payPeriod, cutoffDay));
}

// Migração de `lockedWeeks`: dados antigos foram gravados com uma chave por
// semana civil "crua" (incluindo blocos de 1 dia nas pontas). Com os blocos
// fundidos, um bloco da ponta passa a responder por mais de uma chave antiga
// — a chave do bloco novo é a data de início do PRIMEIRO sub-bloco (a mesma
// de antes para o bloco da esquerda; nova para o da direita, que absorve o
// que era um bloco de 1 dia isolado) e o valor é o **E lógico** dos valores
// antigos (só fica trancado se TODOS os sub-blocos estavam). Migração feita
// À LEITURA — não apaga nem reescreve `lockedWeeks` guardado, só interpreta.
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

// `period` é opcional (compatível com todas as chamadas existentes, que
// continuam a somar TODAS as entries não anuladas). Quando passado (formato
// {start, end} em Date, igual ao que getCutoffPeriod/getWeekChunk devolvem),
// só soma entries cuja data cai dentro do período — é o que impede que horas
// lançadas já no período seguinte (antes de um fecho tardio) poluam o total
// do período que está a ser fechado/mostrado.
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

// Clientes da agenda (semana tipo) de `staffId` numa DATA concreta (spec
// 5.2.4: o painel do dia mostra um cartão por cliente da agenda, já
// marcável — antes só existia por dia-da-semana genérico, em
// `EmployeeAgendaScreen.getDayOccurrences`; esta função faz o mesmo cálculo
// mas para uma data específica, reutilizável em Horas e Agenda. `assignments`
// guarda `staffId-diaDaSemana(1-7)` -> ids de cliente; `clientAppliesThisWeek`
// filtra quinzenal/mensal pela semana da data dada.
// Duração (minutos) de um cliente num dia da semana ISO (1=seg … 7=dom):
// exceção por dia (`durationByDay`) ou a duração padrão.
function clientDurationOnDow(client, dow) {
  if (!client) return 0;
  const o = client.durationByDay && client.durationByDay[String(dow)];
  return Number(o) > 0 ? Number(o) : (client.duration || 0);
}
function dowOfIso(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 ? 7 : wd;
}
function clientDurationOn(client, date) {
  const dow = typeof date === "string" ? dowOfIso(date) : (date.getDay() === 0 ? 7 : date.getDay());
  return clientDurationOnDow(client, dow);
}
// Parte de um funcionário (minutos): total do dia ÷ equipa, ou o total
// inteiro quando o cliente é "individual".
function clientPartMinutes(client, dow, teamSize) {
  const dur = clientDurationOnDow(client, dow);
  return client && client.hoursMode === "individual" ? dur : Math.round(dur / (teamSize || 1));
}

// --- Coberturas de férias -------------------------------------------------
// Uma cobertura troca, por um período, QUEM faz um cliente: o cliente de A
// (da agenda semanal dele) passa a ser feito por B entre `from` e `to`
// (inclusive, "YYYY-MM-DD"). A agenda semanal NÃO é tocada — por isso, no dia
// a seguir a `to`, o cliente volta sozinho para A. B faz nos MESMOS dias da
// semana em que A fazia. Forma: { id, clientId, fromStaffId, toStaffId, from, to }.
function coverActiveOn(cv, iso) {
  return !!cv && !!cv.from && !!cv.to && cv.from <= iso && iso <= cv.to && String(cv.fromStaffId) !== String(cv.toStaffId);
}
function isoOfDate(date) { return typeof date === "string" ? String(date).slice(0, 10) : isoDateStr(date); }
// Ids de cliente que `staffId` faz numa data: semana-tipo, menos o que foi
// coberto por outra pessoa, mais o que ele cobre (só nos dias em que o dono
// original fazia esse cliente).
function agendaClientIdsOn(assignments, covers, staffId, date) {
  const iso = isoOfDate(date);
  const dow = dowOfIso(iso);
  const base = (assignments && assignments[`${staffId}-${dow}`]) || [];
  const active = (covers || []).filter((cv) => coverActiveOn(cv, iso));
  if (active.length === 0) return base;
  const away = new Set(active.filter((cv) => String(cv.fromStaffId) === String(staffId)).map((cv) => cv.clientId));
  const out = base.filter((id) => !away.has(id));
  active.forEach((cv) => {
    if (String(cv.toStaffId) !== String(staffId) || out.includes(cv.clientId)) return;
    if (((assignments && assignments[`${cv.fromStaffId}-${dow}`]) || []).includes(cv.clientId)) out.push(cv.clientId);
  });
  return out;
}
// Clientes de `staffId` nesta data que estão cobertos por outro (para mostrar
// "coberto por B" na agenda dele): [{ clientId, cover }].
function coveredAwayOn(assignments, covers, staffId, date) {
  const iso = isoOfDate(date);
  const base = (assignments && assignments[`${staffId}-${dowOfIso(iso)}`]) || [];
  return (covers || [])
    .filter((cv) => coverActiveOn(cv, iso) && String(cv.fromStaffId) === String(staffId) && base.includes(cv.clientId))
    .map((cv) => ({ clientId: cv.clientId, cover: cv }));
}
// Clientes que `staffId` faz nesta data SÓ por cobertura (não estão na
// agenda semanal dele): [{ clientId, cover }].
function coveringOn(assignments, covers, staffId, date) {
  const iso = isoOfDate(date);
  const dow = dowOfIso(iso);
  const base = (assignments && assignments[`${staffId}-${dow}`]) || [];
  const seen = new Set();
  return (covers || [])
    .filter((cv) => {
      if (!coverActiveOn(cv, iso) || String(cv.toStaffId) !== String(staffId)) return false;
      if (base.includes(cv.clientId) || seen.has(cv.clientId)) return false;
      if (!((assignments && assignments[`${cv.fromStaffId}-${dow}`]) || []).includes(cv.clientId)) return false;
      seen.add(cv.clientId);
      return true;
    })
    .map((cv) => ({ clientId: cv.clientId, cover: cv }));
}
// Coberturas que se sobrepõem no mesmo cliente e período (para avisar antes de gravar).
function coverOverlaps(covers, clientId, from, to, ignoreId) {
  return (covers || []).filter((cv) => cv.id !== ignoreId && cv.clientId === clientId && cv.from <= to && from <= cv.to);
}

function dayScheduledClients(clients, assignments, staffId, date, covers) {
  const clientIds = agendaClientIdsOn(assignments, covers, staffId, date);
  return clientIds
    .map((id) => clientById(clients, id))
    .filter((c) => c && clientAppliesOnDate(c, date))
    .map((c) => { const dur = clientDurationOn(c, date); return dur === c.duration ? c : { ...c, duration: dur }; });
}

// Etapa 4b (secção 5.1, "Esta semana") — resumo da semana CIVIL corrente
// (segunda a domingo que contém `today`), independente dos blocos do
// período de pagamento (que podem ter 8 dias nas pontas — "opção B"). Soma
// horas registadas (só no dia do próprio lançamento, nunca no dia de
// origem de um "adiantamento" — mesma regra de `hoursLabel` em
// `EmployeeHorasScreen.buildCalDay`, pra não contar a mesma hora duas
// vezes) e horas previstas pela agenda, dia a dia, mais o estado de cada
// um dos 7 pontos do cartão (verde registado · contorno alert em falta ·
// vazio futuro · tracejado sem clientes).
function thisWeekSummary(clients, assignments, staffId, horasEntry, today, staffMember, covers, ctx) {
  const weekStart = startOfISOWeek(today);
  const days = [];
  let registeredHours = 0;
  let scheduledHours = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dateKey = isoDateStr(d);
    // `staffMember` é opcional (Etapa 4j, 4.9) — quando passado, um dia já
    // para lá da validade de uma conta Replacement conta como "sem
    // clientes", mesmo que a agenda/atribuição ainda exista (as
    // atribuições não se apagam — só deixam de se aplicar nesses dias).
    const activeOnDay = !staffMember || (isStaffActive(staffMember, d) && staffStartedOn(staffMember, d));
    const scheduled = activeOnDay ? dayScheduledClients(clients, assignments, staffId, d, covers) : [];
    const hasAgenda = scheduled.length > 0;
    // Com `ctx` (agenda da equipa) conta a MINHA parte prevista, não a duração inteira do cliente.
    scheduledHours += scheduled.reduce((s, c) => s + (ctx ? expectedShare(ctx, c, dateKey, staffId).minutes : (c.duration || 0)) / 60, 0);
    const covered = dayIsCovered(horasEntry, dateKey);
    if (covered) {
      registeredHours += (horasEntry.entries || [])
        .filter((e) => e.date === dateKey && !e.voided)
        .reduce((s, e) => s + e.hours, 0);
    }
    let state;
    if (covered) state = "registered";
    else if (!hasAgenda) state = "noClients";
    else if (d > today) state = "future";
    else state = "missing";
    days.push({ dateKey, state, isToday: dateKey === isoDateStr(today) });
  }
  return { registeredHours, scheduledHours, days };
}

// Etapa 4b (5.1, "Precisa da sua atenção" — "Dias por registar") — dias em
// falta no período aberto INTEIRO (todos os blocos, não só o atual — mesma
// regra do `periodMissingCount` já calculado em `EmployeeHorasScreen.jsx`,
// só que devolvendo as datas em vez da contagem, pra dar pra mostrar a
// primeira em falta ("Segunda-feira, 28/09"). Ordenadas da mais antiga pra
// mais recente.
function periodMissingDays(clients, assignments, staffId, horasEntry, payPeriodChunks, today, staffMember, absences, covers) {
  const missing = [];
  payPeriodChunks.forEach((chunk) => {
    calPeriodDays(chunk).forEach((d) => {
      // `staffMember` opcional (Etapa 4j, 4.9): dia já fora da validade de
      // uma conta Replacement nunca conta como "em falta" (não há mais
      // agenda real nesse dia, só a atribuição antiga que fica guardada).
      const activeOnDay = !staffMember || (isStaffActive(staffMember, d) && staffStartedOn(staffMember, d));
      if (d <= today && activeOnDay && !absenceOn(absences, staffId, isoDateStr(d)) && dayScheduledClients(clients, assignments, staffId, d, covers).length > 0 && !dayIsCovered(horasEntry, isoDateStr(d))) {
        missing.push(d);
      }
    });
  });
  return missing.sort((a, b) => a - b);
}

// Etapa 4b (5.1, "Precisa da sua atenção" — "Dias em falta na equipa",
// só supervisor) — quantos funcionários (ativos, fixos) têm pelo menos um
// dia em falta no período aberto, E quantos DIAS em falta há no total.
// Mesma regra/filtros/classificação de dia-a-dia do `weeksInfoFor`/
// `monitored`/`totalGapsSum` de `MonitoramentoScreen.jsx` (semana trancada
// ou ainda não começada não conta como "em falta"), reescrita aqui como
// função independente pra não obrigar a montar a tela inteira de
// Monitoramento só pra ler este número — os dois continuam a bater porque
// partilham as mesmas peças do Model (`dayIsCovered`, `clientAppliesThisWeek`,
// `migrateLockedWeeksToBlocks`).
//
// QA pós-auditoria (Lote 2, "dias em falta na equipa" contando dias): antes
// devolvia só a contagem de FUNCIONÁRIOS (um booleano "tem algum furo" por
// pessoa), mas o cartão "Precisa da sua atenção" do Início mostra isto como
// número de DIAS — e o "Como conferir" do documento exige que esse total
// bata com o total do Monitoramento (soma de `totalGaps`, não a contagem de
// linhas). Devolve os dois números: quem só precisava do selo de
// funcionários (badge da folha "Mais", App.jsx) lê `.staffCount`; quem
// precisa do total de dias (Início) lê `.totalDays`.
function staffWithGapsCount(staff, horasData, clients, assignments, payPeriod, payPeriodChunks, cutoffDay, today, absences, covers) {
  function isoWeekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }
  function hasAgendaOnDay(staffId, d) {
    if (absenceOn(absences, staffId, isoDateStr(d))) return false;
    const clientIds = agendaClientIdsOn(assignments, covers, staffId, d);
    return clientIds.some((id) => { const c = clientById(clients, id); return c && clientAppliesOnDate(c, d); });
  }
  let staffCount = 0;
  let totalDays = 0;
  staff
    .filter((s) => isStaffActive(s, today) && s.accountType === "fixo")
    .forEach((s) => {
      const h = horasData[s.id] || { entries: [], lockedWeeks: {}, noClientDays: [] };
      const migratedLocked = migrateLockedWeeksToBlocks(h.lockedWeeks, payPeriod, cutoffDay);
      const gaps = payPeriodChunks.reduce((sum, chunk) => {
        const locked = !!migratedLocked[isoDateStr(chunk.start)];
        const notStarted = chunk.start > today;
        if (locked || notStarted) return sum;
        const missed = calPeriodDays(chunk).filter(
          (d) => d <= today && staffStartedOn(s, d) && hasAgendaOnDay(s.id, d) && !dayIsCovered(h, isoDateStr(d))
        ).length;
        return sum + missed;
      }, 0);
      if (gaps > 0) {
        staffCount += 1;
        totalDays += gaps;
      }
    });
  return { staffCount, totalDays };
}

// Bloco de notas/lembretes pessoais (dashboard do supervisor e, opcionalmente,
// da gerência). `ownerId` é o id do funcionário dono da nota, ou a string
// "management" para notas partilhadas por todos os logins de gerência.
function notesForOwner(personalNotes, ownerId) {
  return (personalNotes || [])
    .filter((n) => n.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Ausências (avisos de falta): uma linha por funcionário e dia.
function absenceOn(absences, staffId, isoDate) {
  return (absences || []).find((a) => a.staffId === staffId && a.date === isoDate) || null;
}
// Todos os dias de `from` a `to` (inclusive, "YYYY-MM-DD"), no máximo 62.
function isoDatesBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const out = [];
  const end = new Date(y2, m2 - 1, d2);
  for (let d = new Date(y1, m1 - 1, d1); d <= end && out.length < 62; d = addDays(d, 1)) out.push(isoDateStr(d));
  return out;
}

// "YYYY-MM-DD" (formato do <input type="date">) -> "DD/MM" pra exibição.
// QA pós-auditoria: alguns dados de demonstração antigos (INITIAL_MISSING,
// data.js) já guardam a data como "DD/MM" em vez de ISO — sem "-", o
// destructuring abaixo dava `undefined/undefined`. Devolve a própria
// string nesse caso; a migração desses dados-exemplo para ISO fica para
// depois (fora do risco aceitável desta leva).
function fmtNoteDate(dateStr) {
  if (!dateStr.includes("-")) return dateStr;
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// --- Etapa 4f (Clientes, documento 4.2/5.4) ---

// Soma as horas lançadas por TODOS os funcionários para UM cliente, num
// período (documento, 4.2: "Horas no período" = horas feitas ÷ meta mensal
// do cliente). Espelha `staffTotalHours`, só que soma por `horasData`
// inteiro (todos os donos de registo) filtrando por `e.clientId`, em vez de
// somar as entries de UM funcionário já escolhido.
function clientTotalHours(horasData, clientId, period) {
  return Object.values(horasData).reduce((sum, horasEntry) => {
    return sum + (horasEntry.entries || [])
      .filter((e) => !e.voided && e.clientId === clientId && (!period || dateStrInPeriod(e.date, period)))
      .reduce((s, e) => s + e.hours, 0);
  }, 0);
}

// Equipa atribuída a um cliente (documento, 4.2: "Equipa" = avatares de
// quem faz este cliente). `assignments` é a semana-tipo plana, chave
// "staffId-day" (ver `cellKey` em AgendasScreen.jsx) — percorre todas as
// células e junta os IDs de funcionário que têm este cliente em QUALQUER
// dia da semana-tipo, sem distinguir dias (mesmo modelo já usado em
// Agendas; ver nota em AgendasScreen.jsx sobre `assignments` não ter
// relação com `client.days`/`frequency`).
function clientTeamStaffIds(assignments, clientId) {
  const ids = new Set();
  Object.entries(assignments).forEach(([key, cids]) => {
    if (!/^\d+-\d+$/.test(key)) return; // ignora marcas auxiliares (ex.: "auto:5-3")
    if ((cids || []).includes(clientId)) {
      const staffId = Number(key.slice(0, key.lastIndexOf("-")));
      ids.add(staffId);
    }
  });
  return Array.from(ids);
}

// Sugestão de "Horas por mês (meta)" calculada a partir da própria agenda
// do cliente (documento, 4.2: "Pela agenda: 32h30 (2h30 × 3 dias × 4,33)")
// — duração da visita × nº de dias por semana × 4,33 (semanas médias por
// mês, mesma constante usada em calendários de RH). Devolve horas em
// decimal, pronta para `fmtHoursScreen`.
function agendaHoursSuggestion(client) {
  const weeklyHours = (client.days || []).reduce((sum, d) => sum + clientDurationOnDow(client, d) / 60, 0);
  // "dia sim, dia não": em média metade dos dias marcados cai em cada semana.
  return weeklyHours * 4.33 / (client.frequency === "alternate" ? 2 : 1);
}

// Lê uma duração escrita à mão e devolve MINUTOS (ou null se não perceber).
// Aceita: "1,5" / "1.5" (horas decimais), "1:30" / "0:30", "1h30", "1h",
// "45min" / "45m", e um número inteiro solto: até 12 conta como horas
// ("2" = 2h), acima disso como minutos ("45" = 45 min).
function parseHoursInput(raw) {
  const str = String(raw == null ? "" : raw).trim().toLowerCase().replace(/\s+/g, "");
  if (!str) return null;
  let m;
  if ((m = str.match(/^(\d{1,2}):(\d{1,2})$/))) { const mm = Number(m[2]); return mm < 60 ? Number(m[1]) * 60 + mm : null; }
  if ((m = str.match(/^(\d{1,2})h(\d{1,2})(?:m(?:in)?)?$/))) { const mm = Number(m[2]); return mm < 60 ? Number(m[1]) * 60 + mm : null; }
  if ((m = str.match(/^(\d+(?:[.,]\d+)?)h$/))) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  if ((m = str.match(/^(\d+)(?:m|min|mins|minutos)$/))) return Number(m[1]);
  if ((m = str.match(/^(\d+[.,]\d+)$/))) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  if ((m = str.match(/^(\d+)$/))) { const n = Number(m[1]); return n <= 12 ? n * 60 : n; }
  return null;
}

// Minutos -> "1:30" (para campos de duração).
function fmtHM(min) {
  const v = Math.max(0, Math.round(Number(min) || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

// --- Etapa 4g (Histórico, documento 4.6/5.5) ---

// Variação percentual entre dois valores (documento, 4.6: pílula "+6 %" na
// lista e nos KPIs do detalhe, sempre "face ao período anterior"). Devolve
// `null` quando não há período anterior ou ele é 0 (nada pra comparar —
// quem usa isto mostra "Sem período anterior" nesse caso, não "0%" nem
// Infinity). Pura função de número pra número, sem noção de cor/UI — a
// decisão de cor (nunca vermelho-alerta pra "desceu", só a regra de QA
// geral do documento, 1.5: "nenhuma cor de alerta em elementos que não
// sejam erro ou falta" — uma descida de horas/valor face ao mês passado
// não é um erro) fica no componente que desenha a pílula, em
// HistoricoScreen.jsx.
function pctChange(current, previous) {
  if (!previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// --- Nomes e logins únicos (clientes, funcionários, emails) ---

// Dois nomes são "o mesmo" se só diferem em maiúsculas, acentos ou espaços a mais
// ("Sabemafe", " SABEMAFE ", "sabemáfe").
function normalizeName(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
// Item da lista (cliente ou funcionário) que já usa este nome, ignorando `excludeId`
// (o próprio, ao editar). null se o nome está livre.
function findByName(list, name, excludeId) {
  const n = normalizeName(name);
  if (!n) return null;
  return (list || []).find((x) => x.id !== excludeId && normalizeName(x.name) === n) || null;
}
function normalizeEmail(e) { return String(e || "").trim().toLowerCase(); }
// Algum acesso (funcionário ou a conta principal da empresa) já usa este email de login?
function emailInUse(staffList, companyEmail, email, excludeId) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (normalizeEmail(companyEmail) === e) return true;
  return (staffList || []).some((s) => s.id !== excludeId && normalizeEmail(s.email) === e);
}

// Papéis com ecrã de supervisor: "supervisor" e "gerencia_supervisor" (este também pode alternar para a vista de gerência).
const isSupervisorRole = (role) => role === "supervisor" || role === "gerencia_supervisor";

export { normalizeName, findByName, normalizeEmail, emailInUse, isSupervisorRole, partnerOf, linkPartners, entryClientName, isPendingClientEntry, clientById, dayIsCovered, recomputeSharedHours, planHoursRecalc, isHorasFrozenOn, visitDateOf, joinVisit, expectedTeamIds, expectedShare, planLeftovers, applyLeftovers, listConflicts, resolveConflict, countReviews, reconcileVisits, weeksOfPeriod, inReviewWindow, hoursImpact, applyJoinIssue, acceptExtra, keepSeparate, voidExtra, ackMissing, assignPendingEntry, applySuggestion, suggestSameVisit, linkSameVisit, nameCandidates, staffById, isStaffActive, clientDurationOnDow, clientDurationOn, clientPartMinutes, staffStartedOn, closeDeadlineInfo, boardStaff, activeClientsCount, pad2, fmtEuro, compactEuro, fmtHoursNum, fmtHoursScreen, fmtMinutes, parseDMY, dateStrInPeriod, buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, isSolicitationStale, unseenAvisosCount, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr, weekDiff, REFERENCE_WEEK_START, clientAppliesThisWeek, clientAppliesOnDate, weekLabelPT, getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk, buildWeekChunkSequence, weekChunksOfPayPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, staffTotalHours, staffTotalPay, getAssignedClientIds, dayScheduledClients, coverActiveOn, agendaClientIdsOn, coveredAwayOn, coveringOn, coverOverlaps, recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner, absenceOn, isoDatesBetween, fmtNoteDate, thisWeekSummary, periodMissingDays, staffWithGapsCount, monthAbbr, clientTotalHours, clientTeamStaffIds, agendaHoursSuggestion, parseHoursInput, fmtHM, pctChange };
