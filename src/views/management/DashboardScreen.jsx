import { useMemo, useState } from "react";
import { Users, Building2, Clock, Undo2, Bell, Calendar, CalendarX, Check } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { useBreakpoint, useControlSize } from "../../hooks/useBreakpoint.js";
import { TODAY, LANG_NAMES } from "../../models/data.js";
import {
  clientById, parseDMY, getOpenPeriod, unseenAvisosCount, formatPeriodLabel, staffTotalHours, staffTotalPay,
  recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner, fmtEuro, compactEuro, fmtHoursScreen,
  monthAbbr, isStaffActive, boardStaff, activeClientsCount, isoDateStr, dateStrInPeriod, fmtHM, countReviews, inReviewWindow, pendingExpenseList, staffExpensesApproved, uniqueSentCount, groupSentItems,
} from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { upcomingHolidays } from "../../models/holidays.js";
import ClientsByCityCard from "./ClientsByCityCard.jsx";
import { contractorPeriods, periodFinance } from "../../models/contractorStats.js";
import { FIN } from "../../models/i18nFin.js";
import { FinanceBlock } from "./finance/FinanceBlock.jsx";
import {
  PageHeader, Card, Avatar, ReclamacoesCard, PeriodBarChart, PeriodLineChart, ChevronCircle, SegmentedControl,
} from "../shared/ui/index.js";

// Pequeno "tile" de data (documento, 4.1 — cartão de Notas): 46×46, dia
// grande + mês em maiúsculas, clay-ink. Nenhum dos formatadores que já
// existiam (`fmtNoteDate`, que devolve "DD/MM" numa única linha) desenha
// isto — por isso um componente novo, só para este cartão.
function NoteDateTile({ iso, lang }) {
  const [, m, d] = iso.split("-");
  return (
    <div
      style={{
        width: 46, height: 46, borderRadius: RADIUS.chip, background: COLORS.clayTint,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 17, lineHeight: 1, color: COLORS.clayInk }}>
        {Number(d)}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.clayInk, marginTop: 3 }}>
        {monthAbbr(lang, Number(m) - 1)}
      </div>
    </div>
  );
}

// Linha de "Pendências" (documento, 4.1): bloco de ícone 38, texto,
// contagem em quadrado 34 — ou, quando a contagem é 0, a linha inteira
// esbatida com "✓ Em dia" no lugar do quadrado. A cor âmbar (documento:
// só a linha "Horas extra por aprovar") só aparece quando há mesmo
// alguma coisa pendente — com contagem 0 fica neutra como as outras,
// pela mesma regra de QA geral do documento ("nenhuma cor de alerta em
// elementos que não sejam erro ou falta").
function PendingRow({ icon: Icon, label, count, amber, onClick, okLabel, last }) {
  const isZero = count === 0;
  const useAmber = amber && !isZero;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "7px 2px",
        border: "none", borderBottom: last ? "none" : `1px solid ${COLORS.line}`, background: "transparent",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit", opacity: isZero ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: RADIUS.chip, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: useAmber ? COLORS.amberBg : COLORS.forest50,
          color: useAmber ? COLORS.amberInk : COLORS.forest600,
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, fontSize: 13.5, color: COLORS.ink }}>{label}</div>
      {isZero ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: COLORS.ok, flexShrink: 0 }}>
          <Check size={14} /> {okLabel}
        </div>
      ) : (
        <div
          style={{
            width: 30, height: 30, borderRadius: RADIUS.chip, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: useAmber ? COLORS.amberBg : COLORS.lineSoft,
            color: useAmber ? COLORS.amberInk : COLORS.ink,
            fontWeight: 700, fontSize: 14,
          }}
        >
          {count}
        </div>
      )}
      <ChevronCircle size={26} />
    </button>
  );
}

// Dashboard (documento de design, secção 4.1) — "dizer em 5 segundos
// quanto há a pagar, o que precisa de atenção e como vai o mês". A lógica
// de negócio por trás de cada número já estava correta (Etapas 0/4b) —
// aqui só muda a apresentação: cartão herói + 3 KPIs na mesma linha,
// Pendências com o novo comportamento "contagem 0 = em dia", o
// componente de Reclamações (2.13) no lugar do velocímetro, um único
// cartão de Notas (o documento pede explicitamente que o duplicado
// desapareça) e os dois gráficos de 6 períodos (2.14) no lugar dos SVGs
// antigos.
function DashboardScreen({ lang, setLang, company, clients, staff, horasData, missingItems, sentItems, contractAlertDays, highlightsMonths = 3, highlightsRealtime = false, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount, cutoffDay, closedPeriods, personalNotes, absences, assignments, covers, contractors, closings, onNavigate }) {
  const t = T[lang].dashboard;
  const tAbs = T[lang].absences;
  const absencesPending = (absences || []).filter((a) => !a.handled && a.date >= isoDateStr(TODAY)).length;
  const tn = T[lang].notas;
  // Lote 4, 4.4 (achado da Marta, item "Ver todas →" 87×19): usado abaixo
  // no link "Ver todas" do cartão de Notas — mesma régua do resto.
  const { height: seeAllHeight } = useControlSize();
  // Lote 4, 4.7 (achado da Marta): a Linha 1 (herói + 3 KPIs) usava
  // `flex-wrap`, e a 922px o Replacement quebrava pra uma 2ª linha sozinho
  // e esticava (922×172 — 172 é o `minHeight` do próprio KpiCard). Grade
  // fixa por `tier` em vez disso: nunca quebra dentro de um nível.
  const tier = useBreakpoint();
  // Etapa 4j (4.9): usa o mesmo auxiliar isStaffActive de todo o app, em
  // vez de só `s.status === "ativo"` — uma conta Replacement cuja validade
  // já passou deixa de contar aqui também, coerente com a pílula "Inativo"
  // que já mostra em Funcionários e com o facto de já não aparecer em
  // Agendas/Monitoramento. Antes desta etapa não havia essa distinção.
  const activeStaff = staff.filter((s) => isStaffActive(s, TODAY));
  const currentPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const currentPeriodLabel = formatPeriodLabel(currentPeriod, lang);

  // Mesma fórmula do cartão herói de Horas (4.4) — os dois ecrãs mostram
  // literalmente os mesmos números (total a receber, horas, pagos/por
  // pagar/pendentes), por isso o cálculo tem de bater certo nos dois.
  const currentPeriodHours = staff.reduce((s, st) => s + staffTotalHours(horasData[st.id] || { entries: [] }, currentPeriod), 0);
  // Horas + reembolsos aprovados (o que realmente se paga no período).
  const currentExpensesApproved = staff.reduce((s, st) => s + staffExpensesApproved(horasData[st.id], currentPeriod), 0);
  const currentPeriodEuros = staff.reduce((s, st) => s + staffTotalPay(horasData[st.id] || { entries: [] }, clients, currentPeriod) + staffExpensesApproved(horasData[st.id], currentPeriod), 0);
  // QA pós-auditoria (Lote 1): mesmo `board` do cartão herói de Horas (ver
  // `boardStaff` em utils.js) — antes este cartão contava `staff` inteiro
  // (incluindo inativos e contas de teste), por isso pagos+por
  // pagar+pendentes não batia com "Funcionários ativos" nem com o mesmo
  // cartão em Horas.
  const board = boardStaff(staff, horasData, currentPeriod, TODAY);
  const kpiCounts = board.reduce((acc, s) => {
    const h = horasData[s.id] || { status: "pendente", paid: false };
    if (h.status === "pendente") acc.pending += 1;
    if (h.paid) acc.paid += 1;
    if (h.status === "finalizado" && !h.paid) acc.unpaid += 1;
    return acc;
  }, { pending: 0, paid: 0, unpaid: 0 });

  // Visitas por conferir (agenda × registos da equipa) — ver Horas > Revisões. O aviso só
  // aparece na última semana do período (a lista fica sempre aberta em Horas). Clientes
  // fora da lista já têm a sua própria linha, por isso não entram aqui.
  const hoursReviews = countReviews(horasData, clients, currentPeriod, { staff, assignments, covers, absences }, isoDateStr(TODAY));
  const visitReviewsPending = inReviewWindow(currentPeriod, TODAY) ? hoursReviews.attention : 0;
  const repassPending = hoursReviews.repass;
  const expensesPending = pendingExpenseList(horasData).length;
  let overtimePending = 0, reopenedCount = 0, customClientPending = 0, shareReviewPending = 0;
  // Só conta funcionários que existem: sobras de contas antigas (ids que já não estão
  // na equipa) deixavam "reabertos" fantasma que ninguém consegue abrir nem resolver.
  const staffIdSet = new Set(staff.map((s) => String(s.id)));
  Object.entries(horasData).forEach(([sid, data]) => {
    if (!data || !staffIdSet.has(String(sid))) return;
    if (data.reopened) reopenedCount += 1;
    data.entries.forEach((e) => { if (e.extra && !e.approved && !e.voided) overtimePending += 1; if (!e.voided && !e.clientId && e.custom) customClientPending += 1; if (!e.voided && e.shareReview) shareReviewPending += 1; });
  });
  // "Avisos e pedidos por ler" (documento, 4.1): só o que a gerência ainda
  // não abriu (`seenByManagement`, marcado ao abrir a tela de Avisos) — a
  // mesma contagem do selo do menu. Pedidos já vistos mas ainda por resolver
  // não contam aqui (continuam visíveis na própria tela de Avisos).
  const pendingRequests = unseenAvisosCount(missingItems, sentItems, getOpenPeriod(closedPeriods, cutoffDay, TODAY));

  const contractsNearExpiry = clients.filter((c) => {
    const end = parseDMY(c.contractEnd);
    const diffDays = (end - TODAY) / (24 * 60 * 60 * 1000);
    return diffDays >= 0 && diffDays <= contractAlertDays;
  }).length;
  // QA pós-auditoria (Lote 3, "Contratos a vencer"): a conta acima
  // (`diffDays >= 0`) sempre ignorou os contratos JÁ vencidos — por isso o
  // cartão de Pendências dizia "Em dia" mesmo havendo vencidos (hoje 4).
  // Conta nova, à parte (mesma regra de `kind: "expired"` de
  // `contractStatus`, ClientesScreen.jsx), com a sua própria linha —
  // somar às "a vencer" escondia de volta a urgência maior dos vencidos.
  const contractsExpired = clients.filter((c) => {
    const end = parseDMY(c.contractEnd);
    const diffDays = (end - TODAY) / (24 * 60 * 60 * 1000);
    return diffDays < 0;
  }).length;

  // Destaques: top 5 por horas. Dois modos (Definições):
  //  - tempo real: só o período aberto, atualizado a cada lançamento;
  //  - fechados (padrão): soma dos N últimos períodos já fechados (Histórico).
  const usedClosed = highlightsRealtime ? [] : (closedPeriods || []).slice(0, Math.max(1, highlightsMonths));
  const hoursByStaff = {};
  const feedbackItems = new Map();
  const addFeedback = (i) => feedbackItems.set(i.id ?? JSON.stringify(i), i);
  if (highlightsRealtime) {
    board.forEach((s) => { hoursByStaff[s.id] = staffTotalHours(horasData[s.id] || { entries: [] }, currentPeriod); });
    (sentItems || []).filter((i) => dateStrInPeriod(i.date, currentPeriod)).forEach(addFeedback);
  } else {
    usedClosed.forEach((cp) => {
      (cp.staffSummaries || []).forEach((ss) => { hoursByStaff[ss.staffId] = (hoursByStaff[ss.staffId] || 0) + (ss.hours || 0); });
      [...(cp.elogiosItems || []), ...(cp.reclamacoesItems || [])].forEach(addFeedback);
    });
  }
  const topStaff = board
    .map((s) => ({ staffId: s.id, name: s.name, hours: hoursByStaff[s.id] || 0 }))
    .filter((s) => s.hours > 0)
    .map((s) => {
      const mine = [...feedbackItems.values()].filter((i) => i.staffId === s.staffId);
      return { ...s, praises: mine.filter((i) => i.type === "elogio").length, complaints: mine.filter((i) => i.type === "reclamacao").length };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);
  const highlightsSubtitle = highlightsRealtime ? t.highlightsSubtitleRealtime : t.highlightsSubtitleClosed(usedClosed.length || highlightsMonths);
  const highlightsEmptyText = highlightsRealtime ? t.highlightsEmptyRealtime : t.highlightsEmptyClosed;

  const replacementClientsActive = clients.filter((c) => {
    if (c.clientType !== "replacement") return false;
    if (!c.clientValidUntil) return true;
    return new Date(c.clientValidUntil) >= TODAY;
  }).length;

  // Só as reclamações do período ABERTO agora — o cartão diz "este mês". Itens
  // antigos que ficaram em `sentItems` (de antes de um fecho, por exemplo) não
  // contam; os do período já fechado vivem no Histórico.
  const periodComplaints = (sentItems || []).filter((i) => i.type === "reclamacao" && dateStrInPeriod(i.date, currentPeriod));
  const complaintsCurrent = uniqueSentCount(periodComplaints); // um envio a várias pessoas conta 1
  // Limites escalam com o tamanho da carteira de clientes (configurado em
  // Definições como "reclamações a cada N clientes"), em vez de um valor fixo.
  const excelenteThreshold = Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));
  // `sentItems[].date` nem sempre é ISO: dados-exemplo antigos usam
  // "DD/MM", lançamentos novos (AvisosScreen.jsx) usam isoDateStr (ex.:
  // "2026-09-26") — o resto do app já mostra este campo em bruto, sem
  // formatar (AvisosWidgets.jsx, `{it.date}`); reaproveitado aqui do mesmo
  // jeito. (QA pós-auditoria: `fmtNoteDate` já entende os dois formatos —
  // deixou de ser o motivo de não o usar aqui; manter em bruto continua
  // sendo o comportamento certo, só não é mais por causa do bug antigo.)
  const recentComplaints = groupSentItems(periodComplaints)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map((i) => ({ client: clientById(clients, i.clientId)?.name || "—", date: i.date }));

  const myNotes = notesForOwner(personalNotes, "management");
  // Lembretes automáticos: feriados nos próximos 45 dias (só informativo, não mexe na agenda).
  const holidayReminders = upcomingHolidays(TODAY, 45, lang).slice(0, 3);

  // Gráficos de 6 períodos (documento, 2.14): os 5 períodos FECHADOS mais
  // recentes (ordem cronológica) + o período ABERTO agora como 6º/último
  // item — é esse último item que os componentes de gráfico tratam como
  // "o período atual" (destacado, gradiente/ponto). Com menos de 5
  // fechados, o gráfico simplesmente mostra menos barras/pontos — nunca
  // inventa períodos vazios.
  const recentClosed = recentClosedPeriodsChronological(closedPeriods, 5);
  const currentLabel = monthAbbr(lang, currentPeriod.end.getMonth());
  const valueChartData = [
    ...recentClosed.map((p) => ({ label: shortMonthFromIso(p.periodEnd, lang), value: p.totalEuros + (p.totalExpenses || 0), dateRangeLabel: p.periodLabel })),
    { label: currentLabel, value: currentPeriodEuros, dateRangeLabel: currentPeriodLabel },
  ];
  const hoursChartData = [
    ...recentClosed.map((p) => ({ label: shortMonthFromIso(p.periodEnd, lang), value: p.totalHours, dateRangeLabel: p.periodLabel })),
    { label: currentLabel, value: currentPeriodHours, dateRangeLabel: currentPeriodLabel },
  ];

  // Financeiro: só o período aberto (horas × valor do contratante, calculado na hora).
  const financePeriod = useMemo(
    () => contractorPeriods({ closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, today: TODAY, lang, count: 1 })[0],
    [closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, lang],
  );
  const finance = useMemo(() => periodFinance(financePeriod, contractors), [financePeriod, contractors]);
  // Meses por fechar (o período aberto já terminou) + meses reabertos; e o que falta receber de meses já fechados.
  const finEnded = isoDateStr(TODAY) > financePeriod.iso;
  const closingsToDo = finance.cards.filter((cd) => finEnded && !(cd.closing && cd.closing.status === "closed")).length
    + (closings || []).filter((r) => r.status === "reopened" && r.periodEnd !== financePeriod.iso).length;
  const outstanding = (closings || [])
    .filter((r) => r.status === "closed" && !r.receivedOn && r.periodEnd !== financePeriod.iso)
    .map((r) => { const ct = (contractors || []).find((x) => String(x.id) === String(r.contractorId)); return ct ? { key: r.id, name: ct.name, color: ct.color, label: r.periodLabel, value: r.receivable, invoiced: !!r.invoicedOn } : null; })
    .filter(Boolean);

  // Só o que realmente está pendente (contagem > 0) aparece no cartão.
  const pendingRows = [
    { key: "overtime", icon: Clock, label: t.pendingOvertime, count: overtimePending, amber: true, onClick: () => onNavigate("horas") },
    { key: "custom", icon: Clock, label: t.pendingCustomClient, count: customClientPending, amber: true, onClick: () => onNavigate("horas") },
    { key: "share", icon: Clock, label: t.pendingShareReview, count: shareReviewPending, amber: true, onClick: () => onNavigate("horas") },
    { key: "visits", icon: Clock, label: t.pendingVisitReviews, count: visitReviewsPending, amber: true, onClick: () => onNavigate("horas") },
    { key: "repass", icon: Clock, label: t.pendingRepass, count: repassPending, amber: true, onClick: () => onNavigate("horas", { openReviews: true, tab: "repass" }) },
    { key: "expenses", icon: Clock, label: t.pendingExpenses, count: expensesPending, amber: true, onClick: () => onNavigate("horas", { openExpenses: true }) },
    { key: "closings", icon: Clock, label: FIN[lang].pendingClosings(closingsToDo), count: closingsToDo, amber: true, onClick: () => onNavigate("contratantes") },
    { key: "reopened", icon: Undo2, label: t.pendingReopened, count: reopenedCount, onClick: () => onNavigate("horas") },
    { key: "unread", icon: Bell, label: t.pendingUnread, count: pendingRequests, onClick: () => onNavigate("avisos") },
    { key: "absence", icon: CalendarX, label: tAbs.pendency, count: absencesPending, amber: true, onClick: () => onNavigate("agendas") },
    { key: "contracts", icon: Calendar, label: t.pendingContracts, count: contractsNearExpiry, onClick: () => onNavigate("clientes") },
    { key: "expired", icon: Calendar, label: t.pendingContractsExpired, count: contractsExpired, amber: true, onClick: () => onNavigate("clientes") },
  ].filter((r) => r.count > 0);
  const f = FIN[lang];
  const [evoMetric, setEvoMetric] = useState("eur");
  const isPhone = tier === "mobile";
  const row = { display: "flex", flexWrap: "wrap", gap: isPhone ? 12 : 20, marginBottom: isPhone ? 12 : 20 };


  const statsRow = {
    display: "grid", gridTemplateColumns: tier === "desktop" ? "repeat(3, 1fr)" : "1fr 1fr",
    gap: isPhone ? 10 : 16, marginBottom: isPhone ? 12 : 20,
  };

  const renderNotesCard = (fill) => (
    <Card variant="warm" style={fill ? { flex: "1 1 auto" } : (myNotes.length === 0 ? { padding: "10px 16px" } : undefined)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: myNotes.length === 0 && holidayReminders.length === 0 && !fill ? 0 : 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{tn.widgetTitle}</div>
          {myNotes.length === 0 && holidayReminders.length === 0 && !fill && <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.notesEmpty}</div>}
        </div>
        <button
          type="button" onClick={() => onNavigate("notas")}
          style={{
            border: "none", background: "transparent", color: COLORS.vivo, fontSize: 12.5, fontWeight: 700, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 4,
            cursor: "pointer", fontFamily: "inherit", height: seeAllHeight, padding: "0 4px", display: "inline-flex", alignItems: "center", flexShrink: 0,
          }}
        >
          {tn.seeAll} →
        </button>
      </div>
      {myNotes.length === 0 && holidayReminders.length === 0 && fill && <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.notesEmpty}</div>}
      {(myNotes.length > 0 || holidayReminders.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myNotes.slice(0, 3).map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NoteDateTile iso={n.date} lang={lang} />
              <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.35 }}>{n.text}</div>
            </div>
          ))}
          {holidayReminders.map((h) => (
            <div key={h.iso} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NoteDateTile iso={h.iso} lang={lang} />
              <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.35 }}>
                {h.name} <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: COLORS.clayInk, background: COLORS.clayTint, borderRadius: 999, padding: "1px 8px" }}>{f.holidayTag}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
  const notesCard = renderNotesCard(false);

  // Cartões do Dashboard (a ordem muda no desktop: ver o bloco 3).
  const pendCard = (
    <Card style={{ flex: "0 0 auto" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{t.pendingTitle}</div>
      {pendingRows.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ok, fontWeight: 600, padding: "8px 0 2px" }}>
          <Check size={16} /> {t.pendingNone}
        </div>
      ) : (
        pendingRows.map((r, i) => (
          <PendingRow key={r.key} icon={r.icon} label={r.label} count={r.count} amber={r.amber} onClick={r.onClick} okLabel={t.pendingAllOk} last={i === pendingRows.length - 1} />
        ))
      )}
    </Card>
  );
  const highCard = (
    <Card style={{ flex: "0 0 auto" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{t.highlightsTitle}</div>
      <div style={{ fontSize: 12, color: COLORS.ink3, margin: "2px 0 10px" }}>{highlightsSubtitle}</div>
      {topStaff.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink2 }}>{highlightsEmptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topStaff.map((s, i) => (
            <div key={s.staffId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 16, fontSize: 12, fontWeight: 700, color: COLORS.ink3 }}>{i + 1}</span>
              <Avatar name={s.name} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: COLORS.ink3 }}>{fmtHM(Math.round(s.hours * 60))} h</div>
              </div>
              <span title={t.highlightsPraises} style={{ fontSize: 12, fontWeight: 700, color: COLORS.forest600 }}>★ {s.praises}</span>
              <span title={t.highlightsComplaints} style={{ fontSize: 12, fontWeight: 700, color: s.complaints ? COLORS.clayInk : COLORS.ink3 }}>⚠ {s.complaints}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
  const reclCard = (
    <ReclamacoesCard
      compact
      current={complaintsCurrent} excelenteThreshold={excelenteThreshold} razoavelThreshold={razoavelThreshold}
      recent={recentComplaints}
      title={t.complaintsTitle} subtitle={t.complaintsSubtitle}
      labels={{ excelente: t.gaugeExcelente, razoavel: t.gaugeRazoavel, critico: t.gaugeCritico }}
    />
  );
  const cityCard = (wide) => (
    <ClientsByCityCard
      clients={clients} t={t} mobile={tier === "mobile"}
      style={{ flex: "0 0 auto" }} wide={wide}
      onOpenCity={(city) => onNavigate("clientes", { city })}
      onOpenClients={() => onNavigate("clientes", { filter: "nocity" })}
    />
  );

  const evoData = evoMetric === "eur" ? valueChartData : hoursChartData;

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} subtitle={formatTodayLabel(lang)} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      {/* 1 — Financeiro do período (A receber − A pagar = Margem) */}
      <FinanceBlock
        lang={lang} period={financePeriod} finance={finance} today={TODAY} tier={tier}
        outstanding={outstanding} payTotal={currentPeriodEuros} expensesTotal={currentExpensesApproved} paidCount={kpiCounts.paid} boardCount={board.length}
        onSeeContractors={() => onNavigate("contratantes")}
        onDefine={(id) => onNavigate("contratantes", { contractorId: id, tab: "clients" })}
      />

      {/* 2 — três números pequenos (reclamações: medidor ao lado) */}
      <div style={statsRow}>
        <MiniStat icon={Users} label={f.statStaff} value={activeStaff.length} onClick={() => onNavigate("funcionarios")} />
        <MiniStat
          icon={Building2} label={f.statClients} value={activeClientsCount(clients, TODAY)}
          sub={f.replacementN(replacementClientsActive)} subWarn={replacementClientsActive > 0}
          onClick={() => onNavigate("clientes", replacementClientsActive > 0 ? { filter: "replacement" } : undefined)}
        />
        <MiniStat icon={Clock} label={f.statHours} value={fmtHoursScreen(currentPeriodHours)} sub={currentPeriodLabel} onClick={() => onNavigate("horas")} style={tier === "desktop" ? undefined : { gridColumn: "1 / -1" }} />
      </div>

      {/* 3 — Desktop: Pendências + Reclamações (esq.) | Destaques + Notas a encher o resto (dir.), e depois
          Clientes por cidade em faixa larga (mapa ao lado da lista). Telemóvel/tablet: colunas como antes. */}
      {tier === "desktop" ? (
        <>
          <div style={{ ...row, alignItems: "stretch" }}>
            <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {pendCard}
              {reclCard}
            </div>
            <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              {highCard}
              {renderNotesCard(true)}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>{cityCard(true)}</div>
        </>
      ) : (
        <div style={row}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {pendCard}
            {highCard}
            {notesCard}
          </div>
          <div style={{ flex: "1.4 1 440px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {reclCard}
            {cityCard(false)}
          </div>
        </div>
      )}

      {/* 4 — um só gráfico de evolução, com alternador € | Horas */}
      <Card style={{ marginBottom: isPhone ? 12 : 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{f.evolution}</div>
          <SegmentedControl
            options={[{ value: "eur", label: "€" }, { value: "hours", label: f.hours }]}
            value={evoMetric} onChange={setEvoMetric}
          />
        </div>
        <div style={{ maxWidth: 620 }}>
        {evoMetric === "eur" ? (
          <PeriodBarChart
            data={evoData} valueFormatter={compactEuro}
            currentValueLabel={fmtEuro(evoData[evoData.length - 1].value)}
            title={t.historyValueTitle} comparisonLabel={t.vsPreviousPeriod}
          />
        ) : (
          <PeriodLineChart
            data={evoData} valueFormatter={fmtHoursScreen}
            averageLabel={t.averageHoursLabel}
            title={t.historyHoursTitle} comparisonLabel={t.vsPreviousPeriod}
          />
        )}
        </div>
      </Card>
    </div>
  );
}

// Número pequeno do topo (substitui os cartões grandes): ícone, rótulo, valor e uma linha de apoio.
function MiniStat({ icon: Icon, label, value, sub, subWarn, onClick, style }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, padding: "12px 14px", minWidth: 0, ...style,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: RADIUS.chip, background: COLORS.forest50, color: COLORS.forest600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.25 }}>{label}</div>
        <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 21, color: COLORS.ink, lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: subWarn ? COLORS.clayInk : COLORS.ink3, fontWeight: subWarn ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
    </button>
  );
}

export default DashboardScreen;
