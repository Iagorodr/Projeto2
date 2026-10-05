import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import {
  clientById, pad2, fmtHoursScreen, fmtMinutes, dateStrInPeriod, dayIsCovered,
  startOfISOWeek, addDays, isoDateStr, recomputeSharedHours, getOpenPeriod, getCutoffPeriod,
  weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks,
  calPeriodDays, calPeriodLabel, dayScheduledClients, isStaffActive,
} from "../../models/utils.js";
import { T, DAY_ABBR_SUN0_BY_LANG, WEEKDAY_FULL_BY_LANG, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { exportStaffHorasPdf } from "../../models/pdfExport.js";
import { ChevronLeftMini, ChevronRightMini, Minus2 } from "../shared/Icons.jsx";
import {
  MobileHeader, WeekStrip, DayPanel, ClientCheckCard, BottomActionBar, PeriodCalendar,
  Card, ConfirmDialog, Drawer, Button, Pill, SearchField, Toast, ProgressBar,
} from "../shared/ui/index.js";

function emptyHoras() {
  return { status: "pendente", paid: false, entries: [], lockedWeeks: {}, noClientDays: [] };
}

// Horas (registar) — documento de design, secção 5.2, "o ecrã mais
// importante". Partilhado entre funcionário e supervisor (a única
// diferença de papel é a sidebar/menu à volta, decidida em App.jsx; este
// componente é o mesmo dos dois lados, como o documento pede em 5 —
// "Regra de ouro: o funcionário e o supervisor usam os mesmos ecrãs").
//
// 5.2.10 (tablet/PC): em PC (≥1024, `useBreakpoint`) a vista editável do
// período aberto ganha duas colunas — à esquerda a navegação de semana,
// a tira e o painel do dia (igual ao resto), à direita os cartões novos
// "Resumo do dia" (substitui a BottomActionBar: total do dia, clientes
// marcados, Finalizar dia/semana) e "Fecho do período" (progresso do
// período inteiro, sempre visível, não só na última semana — diferente
// do cartão "Rever o período" de 5.2.7, que continua a aparecer só na
// última semana, agora dentro da coluna esquerda). Em tablet (640-1023)
// e telemóvel (<640) o ecrã continua de coluna única com a barra de ação
// fixa em baixo, tal como já estava. Os estados bloqueado/mês finalizado
// (5.2.8/5.2.9, fora do período ou já finalizado) continuam de coluna
// única em qualquer tamanho — o documento só descreve as duas colunas
// para a vista normal/editável.
function EmployeeHorasScreen({ lang, setLang, onHome, staffId, company, clients, staff, assignments, horasData, setHorasData, cutoffDay, closedPeriods, setMissingItems }) {
  const t = T[lang].employeeHoras;
  const pdfT = T[lang].pdf;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const weekdayFull = WEEKDAY_FULL_BY_LANG[lang];
  const dayLabels17 = DAY_LABELS_1_7_BY_LANG[lang];
  const me = staff.find((s) => s.id === staffId);
  const staffName = me?.name || "";
  // Etapa 4j (4.9) — um dia já fora da validade de uma conta Replacement
  // mostra-se sem agenda ("sem clientes"), mesmo que a atribuição em si
  // continue guardada (só deixa de se aplicar nesses dias).
  function scheduledIfActive(d) {
    return isStaffActive(me, d) ? dayScheduledClients(clients, assignments, staffId, d) : [];
  }
  const tier = useBreakpoint();
  const isDesktop = tier === "desktop";
  // No mobile "puro" (<640), a MobileBottomBar da casca (App.jsx) convive
  // com esta BottomActionBar (QA antiga, ver comentário em
  // MobileBottomBar.jsx) — passamos essa flag pra ela saber que precisa
  // flutuar ACIMA da barra de navegação, em vez de colar no fundo real da
  // janela, onde as duas (ambas `position:sticky,bottom:0`) disputavam o
  // mesmo lugar. No tablet (640-1023) a MobileBottomBar não existe (ver
  // App.jsx), então aqui continua colada no fundo normalmente.
  const isMobileTier = tier === "mobile";

  // Período aberto pelo histórico real de fechamentos (getOpenPeriod), em
  // blocos (opção B, 6.1) — igual ao que já estava antes do redesenho.
  const payPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const payPeriodChunks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);

  const [chunkIndex, setChunkIndex] = useState(null);
  // QA pós-auditoria (Lote 3, "período aberto em Horas do funcionário"):
  // antes a sequência navegável vinha de `buildWeekChunkSequence(TODAY,
  // cutoffDay, countBefore, 8)`, que re-deriva as semanas uma a uma (civil,
  // seg-dom) a partir de hoje, SEM a fusão de blocos de 1 dia da "opção B"
  // (6.1) — resultado: um bloco solto de 1 dia na borda do período aberto
  // (ex.: "20–20 Set") e a navegação entrando no período seguinte sem
  // terminar certo no fim do período aberto. Troca por uma sequência
  // montada a partir dos MESMOS blocos fundidos de `weekBlocksOfPayPeriod`
  // usados pelo Monitoramento: primeiro os do período aberto
  // (`payPeriodChunks`, já calculado acima), depois os dos períodos
  // seguintes (um `getCutoffPeriod` por mês), até ter pelo menos 8 blocos
  // de margem depois de hoje.
  const [chunks] = useState(() => {
    const list = [...payPeriodChunks];
    let periodOffset = 1;
    while (list.length - payPeriodChunks.length < 8) {
      const nextPeriod = getCutoffPeriod(payPeriod.start, cutoffDay, periodOffset);
      list.push(...weekBlocksOfPayPeriod(nextPeriod, cutoffDay));
      periodOffset += 1;
    }
    const todayIndex = list.findIndex((b) => TODAY >= b.start && TODAY <= b.end);
    return { list, anchorIndex: todayIndex >= 0 ? todayIndex : 0 };
  });
  const anchorIndex = chunks.anchorIndex;
  const idx = chunkIndex === null ? anchorIndex : chunkIndex;
  const chunk = chunks.list[idx];
  const days = calPeriodDays(chunk);
  const isBoundary = days.length < 7;

  const [selectedDateKey, setSelectedDateKey] = useState(() => isoDateStr(TODAY));
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientSearch, setAddClientSearch] = useState("");
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [extraTarget, setExtraTarget] = useState(null);
  const [extraDraft, setExtraDraft] = useState(0);
  const [noClientConfirmOpen, setNoClientConfirmOpen] = useState(false);
  const [finalizeDaySheetOpen, setFinalizeDaySheetOpen] = useState(false);
  const [confirmWeekOpen, setConfirmWeekOpen] = useState(false);
  const [finalizeMonthConfirmOpen, setFinalizeMonthConfirmOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 5000); }

  const myHoras = horasData[staffId] || emptyHoras();
  const chunkKey = isoDateStr(chunk.start);
  const weekLockedRaw = !!(myHoras.lockedWeeks && myHoras.lockedWeeks[chunkKey]);
  const monthFinalized = myHoras.status === "finalizado";

  // Zonas de edição (6.2.4/5.2.9, por bloco visto, face ao período aberto):
  // antes do início → só leitura (histórico já fechado pela gerência);
  // dentro → editável se a semana não estiver trancada e o mês não tiver
  // sido finalizado; depois do fim → editável se a semana não estiver
  // trancada, sem depender do mês (que é doutro período).
  const chunkZone = chunk.end < payPeriod.start ? "before" : chunk.start > payPeriod.end ? "after" : "within";
  const weekLockedFlag =
    chunkZone === "before" ? true :
    chunkZone === "within" ? (weekLockedRaw || monthFinalized) :
    weekLockedRaw;

  // 5.2.10: duas colunas só na vista normal/editável (nem "antes do
  // período" nem "mês finalizado" — ver comentário no topo do ficheiro).
  const showTwoColumn = isDesktop && chunkZone !== "before" && !monthFinalized;

  const migratedLocked = migrateLockedWeeksToBlocks(myHoras.lockedWeeks, payPeriod, cutoffDay);
  const allWeeksFinalized = payPeriodChunks.every((c) => !!migratedLocked[isoDateStr(c.start)]);
  const finalizedCount = payPeriodChunks.filter((c) => !!migratedLocked[isoDateStr(c.start)]).length;
  const canFinalizeMonth = allWeeksFinalized && !monthFinalized;
  const isLastPeriodChunk = chunkZone === "within" && payPeriodChunks.length > 0 &&
    isoDateStr(chunk.start) === isoDateStr(payPeriodChunks[payPeriodChunks.length - 1].start);
  // Estado de cada bloco do período, pro cartão "Fecho do período" (5.2.10,
  // só desktop): finalizado (selo verde) · "em curso" (contém hoje) ·
  // "por finalizar" (já terminou e ainda não foi finalizado) · futuro
  // (ainda não chegou — "–").
  function periodBlockStatus(c) {
    if (migratedLocked[isoDateStr(c.start)]) return "done";
    if (TODAY >= c.start && TODAY <= c.end) return "current";
    if (c.end < TODAY) return "overdue";
    return "future";
  }

  const selectedDate = days.find((d) => isoDateStr(d) === selectedDateKey) || days[0];
  const selectedKey = isoDateStr(selectedDate);
  const entriesForDay = myHoras.entries.filter((e) => e.date === selectedKey && !e.voided);
  const scheduledToday = scheduledIfActive(selectedDate);
  const hasAgendaToday = scheduledToday.length > 0;
  const markedNoClient = (myHoras.noClientDays || []).includes(selectedKey);
  const dmOf = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;

  function updateMyHoras(updater) {
    setHorasData((prev) => ({ ...prev, [staffId]: updater(prev[staffId] || emptyHoras()) }));
  }
  function dayTotalHours(dateKey) { return myHoras.entries.filter((e) => e.date === dateKey && !e.voided).reduce((s, e) => s + e.hours, 0); }
  function goChunk(delta) {
    const next = idx + delta;
    if (next < 0 || next >= chunks.list.length) return;
    setChunkIndex(next);
    setSelectedDateKey(isoDateStr(calPeriodDays(chunks.list[next])[0]));
  }

  function addClientEntry(clientId, replacesDate) {
    if (weekLockedFlag) return;
    const client = clientById(clients, clientId);
    if (!client) return;
    setHorasData((prev) => {
      const current = prev[staffId] || emptyHoras();
      const entry = { date: selectedKey, clientId, hours: (client.duration || 60) / 60, extra: false, extraMinutes: 0, approved: false, voided: false };
      if (replacesDate) entry.replacesDate = replacesDate;
      const withNew = { ...prev, [staffId]: { ...current, entries: [...current.entries, entry] } };
      return recomputeSharedHours(withNew, clients, selectedKey, clientId);
    });
  }
  function removeEntryObj(entry) {
    if (weekLockedFlag) return;
    setHorasData((prev) => {
      const current = prev[staffId];
      const withoutIt = { ...prev, [staffId]: { ...current, entries: current.entries.filter((e) => e !== entry) } };
      return recomputeSharedHours(withoutIt, clients, entry.date, entry.clientId);
    });
  }
  function toggleScheduledClient(clientId) {
    if (weekLockedFlag) return;
    const existing = entriesForDay.find((e) => e.clientId === clientId);
    if (existing) removeEntryObj(existing);
    else addClientEntry(clientId);
  }
  function openExtra(entry) { if (weekLockedFlag) return; setExtraDraft(entry.extraMinutes || 0); setExtraTarget(entry); }
  function saveExtra() {
    setHorasData((prev) => {
      const current = prev[staffId];
      const updated = {
        ...prev,
        [staffId]: {
          ...current,
          entries: current.entries.map((e) => {
            if (e !== extraTarget) return e;
            // Mesma regra já usada do lado da gerência: qualquer gravação
            // de um lançamento que fica com extra > 0 desfaz a aprovação.
            return { ...e, extra: extraDraft > 0, extraMinutes: extraDraft, approved: extraDraft > 0 ? false : e.approved };
          }),
        },
      };
      return recomputeSharedHours(updated, clients, extraTarget.date, extraTarget.clientId);
    });
    setExtraTarget(null);
  }

  function confirmNoClientDay() {
    updateMyHoras((h) => ({ ...h, noClientDays: [...(h.noClientDays || []), selectedKey] }));
    setNoClientConfirmOpen(false);
  }
  function undoNoClientDay() {
    updateMyHoras((h) => ({ ...h, noClientDays: (h.noClientDays || []).filter((k) => k !== selectedKey) }));
  }

  function confirmFinalizeDay() {
    setFinalizeDaySheetOpen(false);
    showToast(t.finalizeDaySuccess);
    const next = days.find((d) => d > selectedDate && d <= TODAY &&
      scheduledIfActive(d).length > 0 && !dayIsCovered(myHoras, isoDateStr(d)));
    if (next) setSelectedDateKey(isoDateStr(next));
  }
  function finalizeWeek() {
    updateMyHoras((h) => ({ ...h, lockedWeeks: { ...(h.lockedWeeks || {}), [chunkKey]: true } }));
    setConfirmWeekOpen(false);
  }
  function finalizeMonth() {
    updateMyHoras((h) => ({ ...h, status: "finalizado", reopened: false }));
    setFinalizeMonthConfirmOpen(false);
  }

  // WeekStrip (5.2.1/5.2.2): um mosaico por dia do bloco.
  const weekStripDays = days.map((d) => {
    const dateKey = isoDateStr(d);
    const hasAgenda = scheduledIfActive(d).length > 0;
    const covered = dayIsCovered(myHoras, dateKey);
    const isFuture = d > TODAY;
    let state;
    if (weekLockedFlag) state = "weekLocked";
    else if (!hasAgenda) state = "noClients";
    else if (covered) state = "registered";
    else if (isFuture) state = "future";
    else state = "missing";
    if (dateKey === selectedKey) state = "selected";
    return { key: dateKey, dayLabel: dayAbbr[d.getDay()], dayNumber: d.getDate(), state, isToday: dateKey === isoDateStr(TODAY) };
  });

  // Faixa "em falta" (5.2.3), só com dias do bloco atual.
  const missingDaysInChunk = weekLockedFlag ? [] : days.filter((d) =>
    d <= TODAY && scheduledIfActive(d).length > 0 && !dayIsCovered(myHoras, isoDateStr(d)));

  // Cartões do painel do dia (5.2.4): um por cliente da agenda — a não ser
  // que essa visita já tenha sido "adiantada" para outro dia desta semana
  // (replacesDate), caso em que aparece esbatida e só de leitura — mais um
  // cartão por lançamento manual (adicionado à parte ou adiantado PARA
  // este dia) que não faz parte da agenda do dia.
  const scheduledIds = new Set(scheduledToday.map((c) => c.id));
  const scheduledCards = scheduledToday.map((client) => {
    const advancedAway = myHoras.entries.find((e) => !e.voided && e.clientId === client.id && e.replacesDate === selectedKey);
    if (advancedAway) {
      // `new Date("YYYY-MM-DD")` interpreta a data como UTC e pode
      // mostrar o dia da semana errado consoante o fuso horário — por
      // isso construímos a data manualmente (ano, mês, dia em horário
      // local), tal como o resto do ecrã já faz (`isoDateStr` e afins).
      const originDate = days.find((d) => isoDateStr(d) === advancedAway.date) || (() => {
        const [oy, om, od] = advancedAway.date.split("-").map(Number);
        return new Date(oy, om - 1, od);
      })();
      const dow = originDate.getDay();
      return {
        id: `sched-${client.id}`, clientId: client.id, name: client.name,
        subtitle: fmtMinutes(client.duration), checked: true, dimmed: true,
        dimmedNote: t.advanceDoneNote(dow, weekdayFull[dow]), readOnly: true,
      };
    }
    const entry = entriesForDay.find((e) => e.clientId === client.id);
    return {
      id: `sched-${client.id}`, clientId: client.id, name: client.name,
      subtitle: entry ? subtitleFor(entry) : fmtMinutes(client.duration),
      checked: !!entry, entry,
      extraPill: entry && entry.extra ? t.extraPillLabel(entry.extraMinutes) : undefined,
    };
  });
  const adHocCards = entriesForDay.filter((e) => !scheduledIds.has(e.clientId)).map((entry) => {
    const c = clientById(clients, entry.clientId);
    return {
      id: `adhoc-${entry.clientId}-${entry.date}`, clientId: entry.clientId, name: c ? c.name : "—",
      subtitle: subtitleFor(entry), checked: true, entry,
      extraPill: entry.extra ? t.extraPillLabel(entry.extraMinutes) : undefined,
    };
  });
  const dayCards = [...scheduledCards, ...adHocCards];

  function subtitleFor(entry) {
    const baseHours = entry.hours - (entry.extraMinutes || 0) / 60;
    let s = fmtHoursScreen(baseHours);
    if (entry.sharedCount > 1) s += ` · ${t.sharedWith(entry.sharedCount - 1)}`;
    return s;
  }

  const myClients = clients.filter((c) => c.id && assignments && Object.entries(assignments).some(([k, ids]) => k.startsWith(`${staffId}-`) && ids.includes(c.id)));
  const addClientResults = addClientSearch.trim()
    ? myClients.filter((c) => c.name.toLowerCase().includes(addClientSearch.toLowerCase()) && !entriesForDay.some((e) => e.clientId === c.id))
    : myClients.filter((c) => !entriesForDay.some((e) => e.clientId === c.id));

  function upcomingClientsThisWeek() {
    const future = days.filter((d) => d > selectedDate);
    const results = [];
    future.forEach((d) => {
      const dKey = isoDateStr(d);
      scheduledIfActive(d).forEach((c) => {
        const alreadyDone = myHoras.entries.some((e) => !e.voided && e.clientId === c.id && (e.date === dKey || e.replacesDate === dKey));
        if (!alreadyDone) results.push({ client: c, date: d, dateKey: dKey });
      });
    });
    return results;
  }

  // Grelha do período (5.2.7): semanas civis (SEG-DOM) cobrindo o período
  // aberto inteiro, para "Rever o período".
  function buildPeriodWeeks() {
    const firstMonday = startOfISOWeek(payPeriod.start);
    const lastSunday = addDays(startOfISOWeek(payPeriod.end), 6);
    const weeks = [];
    let cursor = firstMonday;
    while (cursor <= lastSunday) {
      const week = [];
      for (let i = 0; i < 7; i++) week.push(buildCalDay(addDays(cursor, i)));
      weeks.push(week);
      cursor = addDays(cursor, 7);
    }
    return weeks;
  }
  function buildCalDay(d) {
    const key = isoDateStr(d);
    const isToday = key === isoDateStr(TODAY);
    if (d < payPeriod.start || d > payPeriod.end) return { key, dayNumber: d.getDate(), state: "outside", isToday: false };
    const hasDirectEntry = myHoras.entries.some((e) => e.date === key && !e.voided);
    // Um dia "adiantado" (o cliente foi feito mais cedo, noutro dia) não
    // tem lançamento com esta data — só um lançamento noutro dia com
    // `replacesDate === key` — mas conta como coberto na mesma (mesma
    // regra de `dayIsCovered`, em utils.js). Sem lançamento próprio não
    // há horas a somar aqui, por isso `hoursLabel` fica de fora nesse
    // caso (mostrar "0h" seria enganoso). Isto fica separado da marcação
    // "noClientDays" logo abaixo, que é um estado visual diferente
    // ("sem atendimento", cinzento) mesmo contando como coberto também.
    const coveredByAdvance = myHoras.entries.some((e) => e.replacesDate === key && !e.voided);
    if (hasDirectEntry || coveredByAdvance) {
      return { key, dayNumber: d.getDate(), state: "registered", hoursLabel: hasDirectEntry ? fmtHoursScreen(dayTotalHours(key)) : undefined, isToday };
    }
    if ((myHoras.noClientDays || []).includes(key)) return { key, dayNumber: d.getDate(), state: "noAttendance", isToday };
    if (d > TODAY) return { key, dayNumber: d.getDate(), state: "noSchedule", isToday };
    const hasAgenda = scheduledIfActive(d).length > 0;
    return { key, dayNumber: d.getDate(), state: hasAgenda ? "missing" : "noSchedule", isToday };
  }
  function jumpToDate(dateKey) {
    const target = chunks.list.findIndex((c) => dateKey >= isoDateStr(c.start) && dateKey <= isoDateStr(c.end));
    if (target >= 0) setChunkIndex(target);
    setSelectedDateKey(dateKey);
  }

  const periodEntries = myHoras.entries.filter((e) => !e.voided && dateStrInPeriod(e.date, payPeriod));
  const periodHours = periodEntries.reduce((s, e) => s + e.hours, 0);
  const periodPendingExtraMinutes = periodEntries.filter((e) => e.extra && !e.approved).reduce((s, e) => s + (e.extraMinutes || 0), 0);
  const periodMissingCount = payPeriodChunks.reduce((sum, c) => sum + calPeriodDays(c).filter((d) =>
    d <= TODAY && scheduledIfActive(d).length > 0 && !dayIsCovered(myHoras, isoDateStr(d))).length, 0);

  function downloadPdf(provisional) {
    exportStaffHorasPdf({
      companyName: company?.name, staffName, periodLabel: calPeriodLabel(payPeriod, lang),
      entries: periodEntries, clients, totalHours: periodHours,
      totalValue: periodEntries.reduce((s, e) => { const c = clientById(clients, e.clientId); return s + e.hours * (c ? c.valueHour : 0); }, 0),
      lang, pdfT, provisional,
    });
  }

  function sendCorrectionRequest() {
    setMissingItems((prev) => [
      { id: Date.now(), staffId, clientId: null, kind: "correcao", text: `Correção nas horas de ${calPeriodLabel(payPeriod, lang)}: ${correctionText.trim()}`, date: isoDateStr(TODAY), resolved: false, response: "" },
      ...prev,
    ]);
    setCorrectionOpen(false);
    setCorrectionText("");
    showToast(t.correctionSent);
  }

  const weekEligible = !weekLockedFlag && days.every((d) =>
    scheduledIfActive(d).length === 0 || dayIsCovered(myHoras, isoDateStr(d)));
  const dayMarkedCount = dayCards.filter((c) => c.checked).length;
  const containerMaxWidth = isDesktop ? 1040 : 560;

  // QA (achado do Iago, 3ª volta — "menu mobile pagina de horas ele
  // espande.. deixe todas as telas expandido igual com a mesma
  // dimensao"): este ecrã era o ÚNICO dos ecrãs do funcionário com
  // `minHeight:"100vh"` no próprio div raiz — todos os outros
  // (Início/Agenda/Clientes/Avisos/Histórico/Notas) deixam a altura só
  // para a casca em App.jsx (`minHeight:"100dvh"` na coluna flex, ver
  // App.jsx). Essa 2ª altura extra empilhada SOBRE a da casca é o que
  // fazia a área "esticar" de forma diferente nesta tela — a barra
  // inferior (MobileBottomBar) e a BottomActionBar deste ecrã, ambas
  // `position:sticky,bottom:0` sem coordenação entre si, resolviam a
  // posição de formas visivelmente diferentes consoante essa altura
  // extra. Removido: sem risco de "costura" de cor, porque
  // `COLORS.page` e `COLORS.bg` (fundo da casca) são o mesmo tom.
  return (
    <div style={{ background: COLORS.page, paddingBottom: (!isDesktop && chunkZone !== "before" && !monthFinalized) ? 132 : 32 }}>
      <div style={{ padding: "16px 16px 0", maxWidth: containerMaxWidth, margin: "0 auto" }}>
        {/* QA (achado do Iago, 3ª volta): título "Horas" removido daqui —
            o item ativo do menu de baixo já diz em que tela se está, e
            sem o título a fileira de troca de semana sobe, ficando mais
            perto do cabeçalho (voltar + idioma). Mesmo tratamento da
            Agenda, pro par de telas ficar igual. */}
        <MobileHeader onBack={onHome} backLabel={t.backLabel} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

        {!monthFinalized && myHoras.reopened && (
          <div style={{ marginBottom: 10 }}><Pill variant="reopened">{t.reopenedPill}</Pill></div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6, marginTop: -4 }}>
          <button type="button" onClick={() => goChunk(-1)} aria-label="anterior" style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronLeftMini />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{calPeriodLabel(chunk, lang)}</span>
          <button type="button" onClick={() => goChunk(1)} aria-label="seguinte" style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ChevronRightMini />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          {/* QA pós-auditoria (Lote 2, "mês finalizado cinza"): este selo
              verde ("paid") era o item colorido que sobrava na vista — ele
              aparece sempre que a semana vista é a atual, o que é o caso
              mais comum logo depois de finalizar o próprio mês (a semana
              atual cai dentro do período que acabou de ser finalizado). O
              selo "neutral" de bloco parcial já é cinza, por isso não
              precisa do mesmo tratamento. */}
          {idx === anchorIndex && !monthFinalized && <Pill variant="paid">{t.currentWeekBadge}</Pill>}
          {isBoundary && <Pill variant="neutral">{t.boundaryBadge}</Pill>}
        </div>
        {!monthFinalized && chunkZone !== "before" && (
          <div style={{ textAlign: "center", fontSize: 11.5, color: COLORS.ink3, marginBottom: 14 }}>
            {t.weeksProgress(finalizedCount, payPeriodChunks.length)}
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px", maxWidth: containerMaxWidth, margin: "0 auto", display: "flex", flexDirection: showTwoColumn ? "row" : "column", alignItems: showTwoColumn ? "flex-start" : "stretch", gap: showTwoColumn ? 24 : 16 }}>
        {chunkZone === "before" ? (
          <div style={{ width: "100%", maxWidth: 640, margin: "0 auto" }}>
            <Card variant="default">
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.ink2 }}>
                <Lock size={16} strokeWidth={1.8} />
                <span style={{ fontSize: 13.5 }}>{t.periodLockedNote}</span>
              </div>
            </Card>
          </div>
        ) : monthFinalized ? (
          <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <Card variant="default" style={{ background: COLORS.lineSoft, border: `1px solid ${COLORS.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Lock size={18} strokeWidth={1.8} color={COLORS.ink2} />
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{t.monthFinalizedBanner}</div>
              </div>
              <div style={{ fontSize: 13, color: COLORS.ink2 }}>{t.monthDoneNote}</div>
            </Card>
            {/* QA pós-auditoria (Lote 2, "mês finalizado cinza"): cartão
                esbatido (fundo lineSoft + contorno line, igual ao banner
                acima) em vez do branco puro do `Card variant="default"` —
                o "Como conferir" do briefing pede a tela toda em tons de
                cinza, não só o banner do topo. */}
            <Card variant="default" style={{ background: COLORS.lineSoft, border: `1px solid ${COLORS.line}` }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, background: COLORS.card, borderRadius: RADIUS.control, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: COLORS.ink3 }}>{t.periodTotal}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{fmtHoursScreen(periodHours)}</div>
                </div>
              </div>
              {/* `muted`: mesmas células do calendário normal, em tons de
                  cinza/ink em vez do verde `okTint` de "registado" — ver
                  comentário de `PeriodCalendar.jsx`. */}
              <PeriodCalendar weeks={buildPeriodWeeks()} dayHeaderLabels={[1, 2, 3, 4, 5, 6, 7].map((d) => dayLabels17[d])} muted />
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {/* Texto/contorno recolorido de verde (`forest700`/`#9FB8AE`,
                    estilo normal de `variantStyle("secondary")`) para tons de
                    cinza — mesma razão do cartão acima. Só estes dois botões
                    "ambiente" do bloco finalizado; o mini-formulário de
                    "Pedir correção" abaixo (quando aberto) fica com as cores
                    normais dos botões — é uma ação em curso, não parte do
                    pano de fundo cinza que o briefing descreve. */}
                <Button variant="secondary" onClick={() => downloadPdf(false)} style={{ color: COLORS.ink2, border: `1.5px solid ${COLORS.line}` }}>{t.downloadPdf}</Button>
                {!correctionOpen && <Button variant="ghost" onClick={() => setCorrectionOpen(true)} style={{ color: COLORS.ink2 }}>{t.requestCorrection}</Button>}
              </div>
              {correctionOpen && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} rows={3}
                    placeholder={t.correctionPlaceholder}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: 10, fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button variant="secondary" onClick={() => { setCorrectionOpen(false); setCorrectionText(""); }}>{t.cancel}</Button>
                    <Button
                      variant="primary" onClick={sendCorrectionRequest} disabled={!correctionText.trim()}
                      disabledReason={!correctionText.trim() ? T[lang].common.requiredField : undefined}
                    >
                      {t.sendCorrection}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <>
          <div style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: showTwoColumn ? 620 : undefined, display: "flex", flexDirection: "column", gap: 16 }}>
            <WeekStrip days={weekStripDays} onSelectDay={setSelectedDateKey} legend={t.weekStripLegend} />

            {missingDaysInChunk.length === 1 && (
              <Card variant="alert">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  {t.missingOneTitle(weekdayFull[missingDaysInChunk[0].getDay()], dmOf(missingDaysInChunk[0]))}
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                  {t.missingOneSubtitle(scheduledIfActive(missingDaysInChunk[0]).length)}
                </div>
                <Button variant="secondary" onClick={() => setSelectedDateKey(isoDateStr(missingDaysInChunk[0]))}>{t.registerNowAction}</Button>
              </Card>
            )}
            {missingDaysInChunk.length > 1 && (
              <Card variant="alert">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{t.missingManyTitle(missingDaysInChunk.length)}</div>
                <Button variant="secondary" onClick={() => setSelectedDateKey(isoDateStr(missingDaysInChunk[0]))}>{t.missingManyAction}</Button>
              </Card>
            )}

            <DayPanel
              title={`${weekdayFull[selectedDate.getDay()]}, ${dmOf(selectedDate)}`}
              forecastLabel={hasAgendaToday && !weekLockedFlag ? t.forecast(fmtHoursScreen(scheduledToday.reduce((s, c) => s + c.duration / 60, 0))) : undefined}
              lockBadge={weekLockedFlag ? `🔒 ${t.weekDoneTag}` : undefined}
              emptyState={
                markedNoClient ? (
                  <div>
                    <div style={{ marginBottom: weekLockedFlag ? 0 : 8 }}>{t.noAttendanceTitle}</div>
                    {!weekLockedFlag && <Button variant="ghost" onClick={undoNoClientDay}>{t.noAttendanceUndo}</Button>}
                  </div>
                ) : !hasAgendaToday ? (
                  <div>
                    <div style={{ marginBottom: weekLockedFlag ? 0 : 8 }}>{t.noAgendaTitle}</div>
                    {!weekLockedFlag && <Button variant="ghost" onClick={() => setAddClientOpen(true)}>{t.noAgendaGhost}</Button>}
                  </div>
                ) : undefined
              }
              onAddClient={!weekLockedFlag && !markedNoClient && hasAgendaToday ? () => setAddClientOpen(true) : undefined}
              addClientLabel={t.addClientButton}
            >
              {dayCards.map((card) => (
                <ClientCheckCard
                  key={card.id}
                  name={card.name}
                  subtitle={card.subtitle}
                  checked={card.checked}
                  dimmed={card.dimmed}
                  dimmedNote={card.dimmedNote}
                  readOnly={weekLockedFlag || card.readOnly}
                  extraPill={card.extraPill}
                  onToggle={() => toggleScheduledClient(card.clientId)}
                  onExtraTime={card.checked && card.entry ? () => openExtra(card.entry) : undefined}
                  extraTimeLabel={t.extraTimeButton}
                />
              ))}
            </DayPanel>

            {/* QA (achado do Iago): "passam despercebido" — eram
                `variant="ghost"` (sem fundo nem contorno, 2.5/4.4: pensado
                pra ações menores tipo "Redefinir"), mas estas duas são
                ações do dia tão importantes quanto o resto do painel, não
                um link secundário. `variant="secondary"` dá contorno +
                fundo, igual a qualquer outro botão de ação do app.
                QA (2ª rodada, achado do Iago com print): com
                `flexWrap:"wrap"` e texto `nowrap` (padrão do `Button`),
                num telemóvel estreito os dois não cabiam lado a lado e
                quebravam pra linhas separadas (um em cima do outro) em
                vez de ficarem lado a lado. Agora cada botão usa
                `flex:1` (dividem a largura em partes iguais, sempre na
                mesma linha) e o texto pode quebrar em 2 linhas dentro do
                próprio botão (`whiteSpace:"normal"`, altura automática)
                em vez de estourar a largura. */}
            {!weekLockedFlag && !markedNoClient && hasAgendaToday && (
              <div style={{ display: "flex", flexWrap: "nowrap", gap: 10, marginTop: -6, alignItems: "stretch" }}>
                {entriesForDay.length === 0 && selectedDate <= TODAY && (
                  <Button
                    variant="secondary"
                    onClick={() => setNoClientConfirmOpen(true)}
                    style={{ flex: 1, minWidth: 0, height: "auto", minHeight: 48, whiteSpace: "normal", textAlign: "center", lineHeight: 1.2, padding: "10px 10px" }}
                  >
                    {t.noClientDayButton}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setAdvanceOpen(true)}
                  style={{ flex: 1, minWidth: 0, height: "auto", minHeight: 48, whiteSpace: "normal", textAlign: "center", lineHeight: 1.2, padding: "10px 10px" }}
                >
                  {t.advanceButton}
                </Button>
              </div>
            )}

            {isLastPeriodChunk && (
              <Card variant="default">
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, marginBottom: 12 }}>{t.weekReviewCardTitle}</div>
                <PeriodCalendar weeks={buildPeriodWeeks()} dayHeaderLabels={[1, 2, 3, 4, 5, 6, 7].map((d) => dayLabels17[d])} onSelectDay={jumpToDate} />
                <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
                  <div style={{ flex: 1, background: COLORS.bg, borderRadius: RADIUS.control, padding: "10px 12px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{t.periodHoursLabel(fmtHoursScreen(periodHours))}</div>
                  </div>
                  {periodPendingExtraMinutes > 0 && (
                    <div style={{ flexShrink: 0 }}><Pill variant="pending">{t.pendingExtraPill(fmtHoursScreen(periodPendingExtraMinutes / 60))}</Pill></div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button
                    variant="primary" disabled={!canFinalizeMonth}
                    disabledReason={!canFinalizeMonth && periodMissingCount > 0 ? t.finalizeMonthDisabledReason(periodMissingCount) : undefined}
                    disabledReasonBelow
                    onClick={() => setFinalizeMonthConfirmOpen(true)}
                  >
                    {t.finalizeMonth}
                  </Button>
                  <Button variant="secondary" onClick={() => downloadPdf(true)}>{t.downloadPdfProvisional}</Button>
                </div>
              </Card>
            )}
          </div>

          {showTwoColumn && (
            <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
              {/* "Resumo do dia" (5.2.10) — a mesma informação/ações da
                  BottomActionBar (5.2.6), só que fixas na coluna direita em
                  vez de uma barra fixa em baixo (que só existe em
                  tablet/telemóvel). */}
              <Card variant="default">
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>{t.daySummaryTitle}</div>
                <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, color: COLORS.ink, marginBottom: dayCards.length > 0 ? 12 : 16 }}>
                  {fmtHoursScreen(dayTotalHours(selectedKey))}
                </div>
                {dayCards.length > 0 && (
                  <ProgressBar value={dayMarkedCount} max={dayCards.length} label={t.clientsMarkedLabel(dayMarkedCount, dayCards.length)} style={{ marginBottom: 16 }} />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {weekEligible && (
                    <Button variant="secondary" style={{ width: "100%" }} onClick={() => setConfirmWeekOpen(true)}>{t.finalizeWeek}</Button>
                  )}
                  <Button
                    variant="primary" style={{ width: "100%" }}
                    onClick={() => setFinalizeDaySheetOpen(true)}
                    disabled={weekLockedFlag || entriesForDay.length === 0}
                    disabledReason={!weekLockedFlag && entriesForDay.length === 0 ? t.noClientsDisabledReason : undefined}
                    disabledReasonBelow
                  >
                    {t.finalizeDay}
                  </Button>
                </div>
              </Card>

              {/* "Fecho do período" (5.2.10) — visão persistente do
                  progresso do período inteiro, independente de qual semana
                  se está a ver (diferente do cartão "Rever o período" acima,
                  que só aparece na última semana). */}
              <Card variant="default">
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>{t.periodClosureTitle}</div>
                <ProgressBar value={finalizedCount} max={payPeriodChunks.length} label={t.weeksFinalizedLabel(finalizedCount, payPeriodChunks.length)} style={{ marginBottom: 14 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {payPeriodChunks.map((c) => {
                    const status = periodBlockStatus(c);
                    return (
                      <div key={isoDateStr(c.start)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: COLORS.ink2 }}>{calPeriodLabel(c, lang)}</span>
                        {status === "done" ? (
                          <Pill variant="paid">{t.periodBlockDone}</Pill>
                        ) : status === "current" ? (
                          <Pill variant="pending">{t.periodBlockCurrent}</Pill>
                        ) : status === "overdue" ? (
                          <Pill variant="missing">{t.periodBlockOverdue}</Pill>
                        ) : (
                          <span style={{ color: COLORS.ink3 }}>{t.periodBlockFuture}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
          </>
        )}
      </div>

      {chunkZone !== "before" && !monthFinalized && !isDesktop && (
        // QA (achado do Iago, 2ª rodada, com print): quando não havia
        // nenhuma marcação no dia, o botão principal mostrava "Marque um
        // cliente" só no TEXTO, mas continuava com
        // `primaryDisabled = entriesForDay.length === 0` — ou seja,
        // sempre desativado exatamente na única situação em que o texto
        // convida a tocar nele (o print mostrava o botão esverdeado
        // claro/"apagado", que é a aparência de `disabled`). Agora,
        // enquanto não há cliente marcado, o botão fica ATIVO e abre a
        // mesma folha de "adicionar cliente" do painel do dia; só volta a
        // chamar a confirmação de "Finalizar dia" depois de já existir
        // pelo menos uma marcação.
        <BottomActionBar
          totalLabel={`${t.dayTotalLabel} · ${fmtHoursScreen(dayTotalHours(selectedKey))}`}
          primaryLabel={entriesForDay.length === 0 ? t.markClientButton : t.finalizeDay}
          onPrimary={() => (entriesForDay.length === 0 ? setAddClientOpen(true) : setFinalizeDaySheetOpen(true))}
          primaryDisabled={weekLockedFlag}
          secondaryLabel={weekEligible ? t.finalizeWeek : undefined}
          onSecondary={weekEligible ? () => setConfirmWeekOpen(true) : undefined}
          floatAboveMobileBar={isMobileTier}
        />
      )}

      {/* Folha: adicionar cliente fora da agenda do dia */}
      <Drawer open={addClientOpen} onClose={() => { setAddClientOpen(false); setAddClientSearch(""); }} title={t.addClientSheetTitle} width={420}>
        <SearchField value={addClientSearch} onChange={setAddClientSearch} placeholder={t.search} mobile />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {addClientResults.map((c) => (
            <button
              key={c.id} type="button"
              onClick={() => { addClientEntry(c.id); setAddClientOpen(false); setAddClientSearch(""); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", borderRadius: RADIUS.control, border: `1px solid ${COLORS.line}`, background: COLORS.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{c.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{fmtMinutes(c.duration)}</span>
                <Plus size={16} color={COLORS.forest600} />
              </span>
            </button>
          ))}
        </div>
      </Drawer>

      {/* Folha: "Fiz o cliente de outro dia" (adiantar) */}
      <Drawer open={advanceOpen} onClose={() => setAdvanceOpen(false)} title={t.advanceSheetTitle} width={420}>
        {upcomingClientsThisWeek().length === 0 ? (
          <div style={{ fontSize: 13.5, color: COLORS.ink2, padding: "12px 0" }}>{t.advanceSheetEmpty}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingClientsThisWeek().map(({ client, date, dateKey }) => (
              <button
                key={`${client.id}-${dateKey}`} type="button"
                onClick={() => { addClientEntry(client.id, dateKey); setAdvanceOpen(false); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", borderRadius: RADIUS.control, border: `1px solid ${COLORS.line}`, background: COLORS.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{client.name}</span>
                <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{weekdayFull[date.getDay()]} · {fmtMinutes(client.duration)}</span>
              </button>
            ))}
          </div>
        )}
      </Drawer>

      {/* Folha: horas extra ("Fiz mais tempo") */}
      <Drawer
        open={!!extraTarget} onClose={() => setExtraTarget(null)} title={t.extraTitle} width={380}
        footer={<><Button variant="secondary" onClick={() => setExtraTarget(null)}>{t.cancel}</Button><Button variant="primary" onClick={saveExtra}>{t.save}</Button></>}
      >
        <div style={{ fontSize: 13.5, color: COLORS.ink2, marginBottom: 16 }}>{t.extraQuestion}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 14 }}>
          <button type="button" onClick={() => setExtraDraft((v) => Math.max(0, v - 30))} style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${COLORS.lineInput}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Minus2 /></button>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, minWidth: 80, textAlign: "center" }}>{extraDraft} {t.minutesUnit}</div>
          <button type="button" onClick={() => setExtraDraft((v) => Math.min(240, v + 30))} style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${COLORS.lineInput}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Plus size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.extraHint}</div>
      </Drawer>

      {/* Folha: confirmação de "Finalizar dia" com resumo */}
      <Drawer
        open={finalizeDaySheetOpen} onClose={() => setFinalizeDaySheetOpen(false)}
        title={t.finalizeDaySheetTitle(weekdayFull[selectedDate.getDay()], dmOf(selectedDate))} width={380}
        footer={<><Button variant="secondary" onClick={() => setFinalizeDaySheetOpen(false)}>{t.finalizeDayBack}</Button><Button variant="primary" onClick={confirmFinalizeDay}>{t.finalizeDayConfirm}</Button></>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {entriesForDay.map((e, i) => {
            const c = clientById(clients, e.clientId);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: COLORS.ink }}>{c ? c.name : "—"}</span>
                <span style={{ color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }}>{fmtHoursScreen(e.hours)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
          <span>{t.dayTotalLabel}</span>
          <span>{fmtHoursScreen(entriesForDay.reduce((s, e) => s + e.hours, 0))}</span>
        </div>
      </Drawer>

      <ConfirmDialog
        open={noClientConfirmOpen} title={t.noClientConfirmTitle}
        body={t.noClientConfirmBody(weekdayFull[selectedDate.getDay()], dmOf(selectedDate))}
        cancelLabel={t.sureNo} confirmLabel={t.sureYes}
        onCancel={() => setNoClientConfirmOpen(false)} onConfirm={confirmNoClientDay}
      />
      <ConfirmDialog
        open={confirmWeekOpen} title={t.confirmWeekTitle} body={t.confirmWeekBody}
        cancelLabel={t.confirmNo} confirmLabel={t.confirmYes} destructive
        onCancel={() => setConfirmWeekOpen(false)} onConfirm={finalizeWeek}
      />
      <ConfirmDialog
        open={finalizeMonthConfirmOpen} title={t.finalizeMonthConfirmTitle} body={t.finalizeMonthConfirmBody}
        cancelLabel={t.confirmNo} confirmLabel={t.confirmYes} destructive
        onCancel={() => setFinalizeMonthConfirmOpen(false)} onConfirm={finalizeMonth}
      />

      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} closeLabel={t.close} />}
    </div>
  );
}

export default EmployeeHorasScreen;
