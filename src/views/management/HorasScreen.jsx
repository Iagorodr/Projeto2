import { useMemo, useState } from "react";
import { Check, Pencil, X, RotateCcw, MoreHorizontal, FileDown } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { useControlSize, useBreakpoint } from "../../hooks/useBreakpoint.js";
import { TODAY } from "../../models/data.js";
import {
  clientById, clientDurationOn, entryClientName, isPendingClientEntry, recomputeSharedHours, visitDateOf, pad2, fmtEuro, fmtHoursScreen, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, formatPeriodLabel,
  startOfISOWeek, isoDateStr, weekLabelPT, staffTotalHours, staffTotalPay,
  weekBlocksOfPayPeriod, calPeriodLabel, boardStaff, countReviews,
  expensesOf, staffExpensesApproved, staffExpensesPending, pendingExpenseList, expectedShare, dayScheduledClients, addDays, absenceOn, isStaffActive, migrateLockedWeeksToBlocks,
} from "../../models/utils.js";
import { formatTodayLabel, T, DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import { exportStaffHorasPdf, exportPeriodSummaryPdf } from "../../models/pdfExport.js";
import {
  PageHeader, Card, SegmentedBar, FilterChip, SearchField, Button, Pill,
  Avatar, DataTable, Drawer, ConfirmDialog, Toast, SharedWithBadge, InfoTip,
} from "../shared/ui/index.js";
import { LANG_NAMES } from "../../models/data.js";
import { PeriodNav } from "../shared/ui/PeriodNav.jsx";
import HoursReviewDialog from "./HoursReviewDialog.jsx";
import { DateField } from "../shared/FormInputs.jsx";
import { ExpenseDecisionRow, ExpensesReviewDrawer } from "./ExpensesReview.jsx";

// "2026-09-20" -> Date local (meia-noite), igual ao resto do app faz com
// datas ISO vindas de `horasData`.
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Agrupa os lançamentos de um funcionário pelos blocos do período aberto
// (documento, 6.1 — "28 set – 4 out", etc.), mantendo o índice ORIGINAL de
// cada entrada em `_idx` (as funções de aprovar/editar/anular operam por
// índice no array `entries` tal como já estava). SÓ entram lançamentos deste
// período: num fecho atrasado (o período já acabou e outro já começou) os dias
// do período seguinte não aparecem aqui nem entram na soma — tratam-se quando
// esse período for fechado.
function groupEntriesByBlock(entries, payPeriodChunks, lang, period) {
  const blocks = payPeriodChunks.map((chunk) => ({ chunk, items: [] }));
  const leftovers = new Map();
  entries.forEach((entry, idx) => {
    if (period && !dateStrInPeriod(entry.date, period)) return;
    const d = parseISODate(entry.date);
    const block = blocks.find((b) => d >= b.chunk.start && d <= b.chunk.end);
    if (block) {
      block.items.push({ ...entry, _idx: idx });
    } else {
      const weekStart = startOfISOWeek(d);
      const key = isoDateStr(weekStart);
      if (!leftovers.has(key)) leftovers.set(key, { weekStart, items: [] });
      leftovers.get(key).items.push({ ...entry, _idx: idx });
    }
  });
  const groups = [
    ...blocks.filter((b) => b.items.length > 0).map((b) => ({ label: calPeriodLabel(b.chunk, lang), start: b.chunk.start, items: b.items })),
    ...Array.from(leftovers.values()).map((g) => ({ label: weekLabelPT(g.weekStart, lang), start: g.weekStart, items: g.items })),
  ];
  groups.forEach((g) => g.items.sort((a, b) => a.date.localeCompare(b.date)));
  groups.sort((a, b) => a.start - b.start);
  return groups;
}

// Horas (pagamentos) — documento de design, secção 4.4, "o ecrã mais
// importante da gerência". A lógica de negócio (status/paid derivados,
// fecho parcial, aprovação de extras) já vinha pronta da Etapa 0 — aqui só
// muda a apresentação: cartão herói com barra segmentada, chips de
// filtro, `DataTable`, gaveta de 640 (em vez do modal centrado) com os
// lançamentos agrupados por bloco do período, e confirmação escrita para
// "Reabrir" (que antes agia direto, sem perguntar nada).
function HorasScreen({ lang, setLang, company, clients, staff, horasData, setHorasData, cutoffDay, closedPeriods, setClosedPeriods, sentItems, missingItems, setSentItems, setMissingItems, assignments = {}, covers = [], absences = [], navIntent = null }) {
  const t = T[lang].horas;
  const c0 = T[lang].common;
  const pdfT = T[lang].pdf;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const [monthOffset, setMonthOffset] = useState(0);
  const [staffSearch, setStaffSearch] = useState("");
  const [activeChip, setActiveChip] = useState("todos");
  const [openStaffId, setOpenStaffId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [rowDraft, setRowDraft] = useState({ clientId: null, hours: "" });
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [closedToast, setClosedToast] = useState(false);
  const [recalcToast, setRecalcToast] = useState(null); // mensagem do aviso após recalcular
  const [reviewOpen, setReviewOpen] = useState(() => !!(navIntent && navIntent.openReviews)); // vindo do atalho "A repassar" do Dashboard
  const [payAsk, setPayAsk] = useState(null); // { staffId, date "dd/mm/aaaa" } — pop-up "já pagou?"
  const [unpayId, setUnpayId] = useState(null);
  const [expensesOpen, setExpensesOpen] = useState(() => !!(navIntent && navIntent.openExpenses)); // vindo de "Despesas por aprovar" do Dashboard
  // Lote 4, 4.4 (achado da Marta: "Como conferir" pede setas, Exportar PDF,
  // Fechar período, idioma e Pago com a MESMA altura e raio 12 a 1366px).
  // As setas do navegador de período eram círculos (raio "50%") de 40×40
  // fixo, e o botão "Pago" era 34×34 com `RADIUS.control` mas altura
  // própria — nenhum dos dois seguia `useControlSize` como o resto. Agora
  // os três (setas, Pago, e por herança os botões/idioma já ajustados) saem
  // da mesma fonte.
  const { height: ctrlHeight, radius: ctrlRadius } = useControlSize();

  // monthOffset=0 é "o período aberto agora" — derivado do histórico real de
  // fechamentos (getOpenPeriod), não de TODAY puro, pra não ficar errado
  // depois de um fecho tardio. Offsets != 0 (navegação pra outros períodos,
  // hoje sem UI que os acione) continuam por cálculo direto.
  const period = monthOffset === 0
    ? getOpenPeriod(closedPeriods, cutoffDay, TODAY)
    : getCutoffPeriod(TODAY, cutoffDay, monthOffset);
  const periodLabel = formatPeriodLabel(period, lang);
  const payPeriodChunks = weekBlocksOfPayPeriod(period, cutoffDay);
  // Fecho atrasado (documento, 4.4 + 6.2): o período aberto já devia ter
  // terminado e ainda não foi fechado — mostra a faixa de aviso.
  const isLateClosing = monthOffset === 0 && TODAY > period.end;

  const openStaff = staff.find((s) => s.id === openStaffId);
  const openHoras = openStaffId ? horasData[openStaffId] : null;

  // QA pós-auditoria (Lote 1, "Fechar período" e as contagens): `board` é
  // quem conta nos números desta tela (kpis, chip "Todos", "Faltam N
  // pagamentos") — ver `boardStaff` em utils.js (Etapa 4j, 4.9: uma conta
  // inativa só continua no quadro do período ABERTO se tiver pelo menos um
  // lançamento não anulado dentro desse período — "tem de ser paga pelo
  // que trabalhou"; sem lançamentos, sai do quadro — uma vez o período
  // fechado isto já não se aplica, o histórico é só da gerência ler, não
  // deste ecrã). Staff ativo continua a aparecer sempre. Antes, estes
  // números vinham de `staff` inteiro (18 contas, incluindo 2 inativas e 4
  // de teste com 0h), por isso "Faltam 14 pagamentos" nunca batia com as
  // 12 linhas realmente por pagar.
  const board = boardStaff(staff, horasData, period, TODAY);
  // Quem não tem horasData nenhum conta como pendente, igual ao que
  // CHIP_FILTERS.pendentes já faz com o objeto por omissão logo abaixo.
  const kpiCounts = board.reduce((acc, s) => {
    const h = horasData[s.id] || { status: "pendente", paid: false };
    if (h.status === "pendente") acc.pending += 1;
    if (h.paid) acc.paid += 1;
    if (h.status === "finalizado" && !h.paid) acc.unpaid += 1;
    return acc;
  }, { pending: 0, paid: 0, unpaid: 0 });
  const periodTotalHours = staff.reduce((s, st) => s + staffTotalHours(horasData[st.id] || { entries: [] }, period), 0);
  const periodTotalEuros = staff.reduce((s, st) => s + staffTotalPay(horasData[st.id] || { entries: [] }, clients, period), 0);
  // "Faltam N pagamentos": só quem está no quadro, tem horas lançadas no
  // período (staffTotalHours > 0) e ainda não foi marcado como pago — uma
  // conta de teste com 0h no período não trava mais o fecho.
  const unpaidForClose = board.filter((s) => staffTotalHours(horasData[s.id] || { entries: [] }, period) > 0 && !horasData[s.id]?.paid).length;
  // Despesas a reembolsar: só aparece (coluna, botão, linha) em empresas que usam
  // o privilégio — quem não o dá a ninguém vê o ecrã exatamente como antes.
  const expensesInUse = staff.some((s) => s.canExpenses) || Object.values(horasData).some((h) => h && (h.expenses || []).length > 0);
  const expensesApprovedTotal = Math.round(staff.reduce((sum, st) => sum + staffExpensesApproved(horasData[st.id], period), 0) * 100) / 100;
  // "A pagar" = horas + reembolsos aprovados (o que a gerência realmente transfere).
  const periodGrandTotal = periodTotalEuros + expensesApprovedTotal;
  const pendingExpenses = pendingExpenseList(horasData);
  const pendingExpensesInPeriod = pendingExpenseList(horasData, period).length;
  const canClosePeriod = board.length > 0 && unpaidForClose === 0 && pendingExpensesInPeriod === 0;
  // A divisão das horas conta também com quem a AGENDA diz que faz o cliente
  // (staff, agenda, coberturas, faltas) — ver `expectedTeamIds` em utils.js.
  const ctx = useMemo(() => ({ staff, assignments, covers, absences }), [staff, assignments, covers, absences]);
  // Revisões em aberto: o que não bate certo entre as visitas previstas pela
  // agenda e as registadas pela equipa (ver `reconcileVisits` em utils.js).
  // Só no período aberto. O botão "Revisões" fica sempre; o aviso no painel e
  // no menu só aparece na última semana do período (`inReviewWindow`).
  const reviews = useMemo(
    () => (monthOffset === 0 ? countReviews(horasData, clients, period, ctx, isoDateStr(TODAY)) : { total: 0 }),
    [monthOffset, horasData, clients, period, ctx],
  );
  const reviewCount = reviews.total;
  const isPhoneTier = useBreakpoint() === "mobile";
  const [paidStamp, setPaidStamp] = useState(null); // carimbo "✓ Pago" logo depois de marcar
  const [moreOpen, setMoreOpen] = useState(false);
  // Horas previstas pela agenda para cada pessoa no período (a sua parte de cada visita).
  const expectedByStaff = useMemo(() => {
    const out = {};
    const days = [];
    for (let d = new Date(period.start); d <= period.end; d = addDays(d, 1)) days.push(new Date(d));
    staff.forEach((s) => {
      let min = 0;
      days.forEach((d) => {
        if (!isStaffActive(s, d) || absenceOn(absences, s.id, isoDateStr(d))) return;
        dayScheduledClients(clients, assignments, s.id, d, covers).forEach((c) => { min += expectedShare(ctx, c, isoDateStr(d), s.id).minutes; });
      });
      out[s.id] = min / 60;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, clients, assignments, covers, absences, period.start.getTime(), period.end.getTime(), ctx]);
  const extrasPendingCount = board.reduce((n, s) => n + ((horasData[s.id] || { entries: [] }).entries || []).filter((e) => dateStrInPeriod(e.date, period) && e.extra && !e.approved && !e.voided).length, 0);

  const CHIP_FILTERS = {
    todos: () => true,
    pendentes: (h) => h.status === "pendente",
    porPagar: (h) => h.status === "finalizado" && !h.paid,
    pagos: (h) => h.paid,
  };
  const visibleStaff = board
    .filter((s) => s.name.toLowerCase().includes(staffSearch.toLowerCase()))
    .filter((s) => CHIP_FILTERS[activeChip](horasData[s.id] || { status: "pendente", paid: false }));

  function closePeriod() {
    const snapshot = buildClosedPeriodSnapshot(period, clients, staff, horasData, sentItems, missingItems);
    setClosedPeriods((prev) => [snapshot, ...prev]);
    setHorasData((prev) => {
      const next = {};
      staff.forEach((s) => {
        const current = prev[s.id] || { status: "pendente", paid: false, entries: [], lockedWeeks: {}, noClientDays: [], reopened: false };
        // Fecho PARCIAL: só arquiva o que é do período que está fechando (já
        // está no snapshot acima). Entries lançadas adiantado (já no período
        // seguinte), semanas já em curso e dias "sem clientes" já marcados
        // pro período seguinte continuam vivos — é o que evita perder o
        // trabalho de quem adiantou o mês antes de a gerência fechar com
        // atraso.
        const keptEntries = current.entries.filter((e) => !dateStrInPeriod(e.date, period));
        const keptLockedWeeks = {};
        Object.entries(current.lockedWeeks || {}).forEach(([weekKey, val]) => {
          if (!dateStrInPeriod(weekKey, period)) keptLockedWeeks[weekKey] = val;
        });
        const keptNoClientDays = (current.noClientDays || []).filter((d) => !dateStrInPeriod(d, period));
        const keptExpenses = (current.expenses || []).filter((x) => !dateStrInPeriod(x.date, period));
        next[s.id] = { ...current, status: "pendente", paid: false, entries: keptEntries, lockedWeeks: keptLockedWeeks, noClientDays: keptNoClientDays, reopened: false, paidAt: null, ...(current.expenses ? { expenses: keptExpenses } : {}) };
      });
      return next;
    });
    // Mesma lógica dos Horas: só arquiva avisos/reclamações/elogios/
    // solicitações do período que está fechando (já estão no snapshot acima).
    // O que já tiver sido lançado pro período seguinte continua na lista ao
    // vivo — antes isto zerava tudo, incluindo itens já do próximo período.
    setSentItems((prev) => prev.filter((i) => !dateStrInPeriod(i.date, period)));
    setMissingItems((prev) => prev.filter((i) => !dateStrInPeriod(i.date, period)));
    setCloseConfirmOpen(false);
    setClosedToast(true);
    setTimeout(() => setClosedToast(false), 5000);
  }
  function exportPeriodPdf() {
    const rows = staff.map((s) => {
      const h = horasData[s.id] || { status: "pendente", paid: false, entries: [] };
      return { name: s.name, paid: h.paid, status: h.status, hours: staffTotalHours(h, period), value: staffTotalPay(h, clients, period), expenses: staffExpensesApproved(h, period) };
    });
    exportPeriodSummaryPdf({
      companyName: company?.name,
      periodLabel,
      rows,
      totalHours: periodTotalHours,
      totalValue: periodTotalEuros,
      totalExpenses: expensesApprovedTotal,
      pdfT,
      statusLabels: { paid: c0.paid, finished: t.statusFinished, pending: c0.pending },
    });
  }
  function exportStaffPdf() {
    exportStaffHorasPdf({
      companyName: company?.name,
      staffName: openStaff.name,
      periodLabel,
      entries: openHoras.entries.filter((e) => dateStrInPeriod(e.date, period)),
      clients,
      totalHours: staffTotalHours(openHoras, period),
      totalValue: staffTotalPay(openHoras, clients, period),
      expenses: expensesOf(openHoras, period).filter((x) => x.status !== "rejected"),
      lang,
      pdfT,
    });
  }

  function updateHoras(staffId, updater) {
    setHorasData((prev) => ({ ...prev, [staffId]: updater(prev[staffId]) }));
  }
  // Marcar/desmarcar pago pede confirmação: marcar abre um pop-up com o valor e a
  // data do pagamento (hoje, editável); desmarcar pergunta antes e apaga a data.
  function openPayDialog(staffId) {
    const h = horasData[staffId];
    if (!h || h.status !== "finalizado" || h.paid) return;
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    setPayAsk({ staffId, date: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` });
  }
  const payIso = payAsk ? (/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(payAsk.date) ? payAsk.date.split("/").reverse().join("-") : "") : "";
  const payDateOk = !!payIso && !Number.isNaN(new Date(`${payIso}T12:00:00`).getTime()) && payIso <= isoDateStr(TODAY)
    && payAsk.date === `${pad2(new Date(`${payIso}T12:00:00`).getDate())}/${pad2(new Date(`${payIso}T12:00:00`).getMonth() + 1)}/${new Date(`${payIso}T12:00:00`).getFullYear()}`;
  function confirmPay() {
    if (!payAsk || !payDateOk) return;
    updateHoras(payAsk.staffId, (h) => (h.status === "finalizado" ? { ...h, paid: true, paidAt: payIso } : h));
    setPaidStamp(payAsk.staffId);
    setTimeout(() => setPaidStamp(null), 1600);
    setPayAsk(null);
  }
  function confirmUnpay() {
    if (unpayId == null) return;
    updateHoras(unpayId, (h) => ({ ...h, paid: false, paidAt: null }));
    setUnpayId(null);
  }
  function reopenForCorrection(staffId) {
    updateHoras(staffId, (h) => { const { finalizedBy: _fb, lockedBy: _lb, ...rest } = h; return { ...rest, status: "pendente", lockedWeeks: {}, reopened: true }; });
    setReopenConfirmOpen(false);
  }
  function approveEntry(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: true } : e)) }));
  }
  function revertApproval(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: false } : e)) }));
  }
  // Decisão da gerência sobre uma despesa (aprovar com valor, recusar com nota, voltar a decidir).
  function decideExpense(staffId, id, patch) {
    updateHoras(staffId, (h) => ({ ...h, expenses: (h.expenses || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  // Correções da gerência mexem na divisão de horas de quem partilha o mesmo
  // cliente no mesmo dia (anular/repor uma linha muda o nº de pessoas). Aqui
  // NÃO se usa `isFrozen`: semana fechada continua sujeita a correção da
  // gerência, só deixa de estar sujeita a mudanças vindas dos colegas.
  function toggleVoid(staffId, i) {
    setHorasData((prev) => {
      const h = prev[staffId];
      const target = h && h.entries[i];
      if (!target) return prev;
      const next = { ...prev, [staffId]: { ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, voided: !e.voided } : e)) } };
      return target.clientId ? recomputeSharedHours(next, clients, visitDateOf(target), target.clientId, { ctx }) : next;
    });
  }
  // Redividir à mão (linha marcada "rever divisão"): volta à divisão igual
  // entre todos os que fizeram esse cliente nesse dia e limpa a marca.
  function resplitEntry(entry) {
    if (!entry || !entry.clientId) return;
    setHorasData((prev) => recomputeSharedHours(prev, clients, visitDateOf(entry), entry.clientId, { ctx }));
  }
  function startEditRow(i, entry) { setEditingIndex(i); setRowDraft({ clientId: entry.clientId || "", hours: entry.hours }); }
  function cancelEditRow() { setEditingIndex(null); }
  // Ao confirmar o cliente de uma linha "fora da lista" (ou trocar o cliente),
  // cruza com quem fez o mesmo cliente nesse dia e divide as horas — só se
  // houver mais alguém; sozinho, ficam as horas escritas. Só corrigir as horas
  // de uma linha que já tinha cliente NÃO redivide (o valor da gerência fica).
  function saveEditRow(staffId, i) {
    setHorasData((prev) => {
      const h = prev[staffId];
      const old = h && h.entries[i];
      if (!old) return prev;
      const newClientId = rowDraft.clientId || old.clientId;
      const clientChanged = !!newClientId && newClientId !== old.clientId;
      let next = {
        ...prev,
        [staffId]: {
          ...h,
          entries: h.entries.map((e, idx) => {
            if (idx !== i) return e;
            const { splitAdjusted, splitHours, shareReview, sharedCount, teamConfirmed, outside, outsideHours, conflict, solo, soloCheck, ...base } = e;
            const kept = clientChanged ? base : e;
            return { ...kept, clientId: newClientId, custom: rowDraft.clientId ? undefined : e.custom, hours: Number(rowDraft.hours) || 0, approved: e.extra ? false : e.approved };
          }),
        },
      };
      if (clientChanged && !old.voided) {
        if (old.clientId) next = recomputeSharedHours(next, clients, visitDateOf(old), old.clientId, { ctx });
        const othersSameClient = Object.keys(next).some((sid) => String(sid) !== String(staffId)
          && (next[sid].entries || []).some((e) => visitDateOf(e) === visitDateOf(old) && e.clientId === newClientId && !e.voided));
        if (othersSameClient) next = recomputeSharedHours(next, clients, visitDateOf(old), newClientId, { ctx });
      }
      return next;
    });
    setEditingIndex(null);
  }

  // Quem mais fez o mesmo cliente no mesmo dia (para o selo "partilhado" das
  // linhas do detalhe). Devolve [] se só esta pessoa o fez; senão a lista de
  // todos (incluindo a pessoa aberta), com a parte de cada um.
  function peopleOnEntry(e) {
    if (!e.clientId || e.voided) return [];
    const list = [];
    staff.forEach((s) => {
      const other = ((horasData[s.id] && horasData[s.id].entries) || []).find((x) => visitDateOf(x) === visitDateOf(e) && x.clientId === e.clientId && !x.voided);
      if (other) {
        const em = other.extraMinutes || 0;
        list.push({ id: s.id, name: s.name, self: openStaff && s.id === openStaff.id, hours: other.hours, hoursLabel: fmtHoursScreen(other.hours) + (em ? ` (${em > 0 ? "+" : "−"}${Math.abs(em)}min)` : "") });
      }
    });
    return list.length > 1 ? list : [];
  }
  // Linha de conferência do selo: total do cliente nesse dia × soma do que cada um marcou.
  function sharedSummary(e, people) {
    const client = clientById(clients, e.clientId);
    if (!client || client.hoursMode === "individual") return undefined;
    const total = clientDurationOn(client, visitDateOf(e)) / 60;
    const sum = people.reduce((a, p) => a + (p.hours || 0), 0);
    const diff = Math.round((sum - total) * 60) / 60;
    const ok = Math.abs(diff) < 0.01;
    return {
      line: t.sharedTotalLine(fmtHoursScreen(total), fmtHoursScreen(sum)),
      verdict: ok ? t.sharedTotalOk : diff < 0 ? t.sharedTotalLess(fmtHoursScreen(-diff)) : t.sharedTotalMore(fmtHoursScreen(diff)),
      ok,
    };
  }

  const columns = [
    {
      key: "staff", label: t.colStaff, width: 2,
      render: (s) => {
        const h = horasData[s.id] || { status: "pendente", paid: false, reopened: false };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <Avatar name={s.name} size={32} />
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            {h.reopened && <Pill variant="reopened">{t.reopenedTag}</Pill>}
          </div>
        );
      },
    },
    {
      key: "status", label: t.colStatus, width: 1,
      render: (s) => {
        const h = horasData[s.id] || { status: "pendente", paid: false };
        if (h.paid) return <Pill variant="paid">{c0.paid}</Pill>;
        if (h.status === "finalizado") return <Pill variant="owed">{t.kpiUnpaid}</Pill>;
        return <Pill variant="pending">{c0.pending}</Pill>;
      },
    },
    {
      key: "hours", label: t.colTotalHours, width: 1.3,
      render: (s) => {
        const done = staffTotalHours(horasData[s.id] || { entries: [] }, period);
        const exp = expectedByStaff[s.id] || 0;
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{fmtHoursScreen(done)}{exp > 0 && <span style={{ color: COLORS.ink3, fontWeight: 500 }}> / {fmtHoursScreen(Math.round(exp * 2) / 2)}</span>}</div>
            {exp > 0 && (
              <div style={{ height: 6, borderRadius: 4, background: "#EEF1EC", marginTop: 5, overflow: "hidden", maxWidth: 140 }}>
                <div className="b1-grow-x-anim" style={{ height: "100%", width: `${Math.min(100, (done / exp) * 100)}%`, background: done > exp * 1.05 ? COLORS.clay : "var(--p1)", borderRadius: 4, transformOrigin: "left" }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "extras", label: t.miniExtrasLabel, width: 1,
      render: (s) => {
        const h = horasData[s.id] || { entries: [] };
        const n = h.entries.filter((e) => dateStrInPeriod(e.date, period) && ((e.extra && !e.approved && !e.voided) || isPendingClientEntry(e) || (e.shareReview && !e.voided))).length;
        return n > 0 ? <Pill variant="pending">{n}</Pill> : <span style={{ color: COLORS.ink3 }}>–</span>;
      },
    },
    { key: "pay", label: t.colTotalPay, width: 1, numeric: true, render: (s) => fmtEuro(staffTotalPay(horasData[s.id] || { entries: [] }, clients, period) + staffExpensesApproved(horasData[s.id], period)) },
    ...(expensesInUse ? [{
      key: "expenses", label: T[lang].expenses.colExpenses, width: 1, numeric: true,
      render: (s) => {
        const h = horasData[s.id];
        const approved = staffExpensesApproved(h, period);
        const pend = staffExpensesPending(h, period);
        if (!approved && !pend) return <span style={{ color: COLORS.ink3 }}>–</span>;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            {pend > 0 && <Pill variant="pending">{pend}</Pill>}
            {approved > 0 && fmtEuro(approved)}
          </span>
        );
      },
    }] : []),
    {
      key: "paid", label: t.colPaid, width: 1,
      render: (s) => {
        const h = horasData[s.id] || { status: "pendente", paid: false };
        const togglable = h.status === "finalizado";
        return (
          <button
            type="button"
            title={!togglable ? t.waitingFinalize(s.name) : h.paid ? t.unpayHint : t.markAsPaid}
            disabled={!togglable}
            onClick={(ev) => { if (!h.paid) { ev.stopPropagation(); openPayDialog(s.id); } }}
            style={{
              width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius,
              border: `1.5px solid ${h.paid ? COLORS.ok : COLORS.lineInput}`,
              background: h.paid ? COLORS.ok : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: togglable ? "pointer" : "not-allowed", opacity: togglable ? 1 : 0.45,
            }}
          >
            {h.paid && <Check size={16} color="#fff" strokeWidth={2.5} />}
          </button>
        );
      },
    },
  ];

  return (
    <div style={styles.content}>
      <PageHeader
        title={t.title} subtitle={formatTodayLabel(lang)}
        lang={lang} setLang={setLang} langNames={LANG_NAMES}
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <PeriodNav
              label={periodLabel} size={ctrlHeight - 6}
              onPrev={() => setMonthOffset((m) => m - 1)} onNext={() => setMonthOffset((m) => m + 1)}
              prevLabel={t.previousPeriod} nextLabel={t.nextPeriod}
              labelStyle={{ fontSize: 13 }}
            />
            <div style={{ position: "relative" }}>
              <Button variant="secondary" icon={MoreHorizontal} aria-label={T[lang].common.more} onClick={() => setMoreOpen((v) => !v)} />
              {moreOpen && (
                <>
                  <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                  <div role="menu" className="sx-pop" style={{ position: "absolute", right: 0, top: ctrlHeight + 6, zIndex: 31, minWidth: 220, background: COLORS.card, borderRadius: 14, boxShadow: "0 20px 40px -16px rgba(21,24,22,.35)", border: `1px solid ${COLORS.line}`, padding: 6 }}>
                    <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); exportPeriodPdf(); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "transparent", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: COLORS.ink, textAlign: "left" }}>
                      <FileDown size={17} /> {t.exportPdfGeneral}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <Button variant="primary" disabled={!canClosePeriod} onClick={() => setCloseConfirmOpen(true)}>{t.closePeriod}</Button>
              {!(board.length > 0 && unpaidForClose === 0) && <Pill variant="pending">{t.missingPaymentsHint(unpaidForClose)}</Pill>}
              {!canClosePeriod && pendingExpensesInPeriod > 0 && <Pill variant="pending">{T[lang].expenses.closeBlocked(pendingExpensesInPeriod)}</Pill>}
            </div>
          </div>
        )}
      />

      {isLateClosing && (
        <Card variant="alert" style={{ marginBottom: 16 }}>
          {t.lateClosingBanner(periodLabel)}
        </Card>
      )}

      <div className="b1-rise" style={{ background: "#151816", color: "#fff", borderRadius: 24, padding: "22px 24px", marginBottom: 20, display: "grid", gridTemplateColumns: isPhoneTier ? "minmax(0, 1fr)" : "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 24, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#C9CFCB", fontWeight: 600, marginBottom: 6 }}>{t.heroTitle}</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 40, lineHeight: 1, marginBottom: 6 }}>{fmtEuro(periodGrandTotal)}</div>
          <div style={{ fontSize: 13, color: "#A9B2AC", marginBottom: expensesApprovedTotal > 0 ? 4 : 14 }}>{fmtHoursScreen(periodTotalHours)} · {periodLabel}</div>
          {expensesApprovedTotal > 0 && <div style={{ fontSize: 13, color: "#A9B2AC", marginBottom: 14 }}>{T[lang].expenses.heroLine(fmtEuro(periodTotalEuros), fmtEuro(expensesApprovedTotal))}</div>}
          <SegmentedBar
            onHero
            segments={[
              { value: kpiCounts.paid, color: "var(--p1-60)" },
              { value: kpiCounts.unpaid, color: COLORS.clay },
              { value: kpiCounts.pending, color: "rgba(255,255,255,.22)" },
            ]}
          />
          <div style={{ fontSize: 12.5, color: "#C9CFCB", marginTop: 8 }}>{t.heroLegend(kpiCounts.paid, kpiCounts.unpaid, kpiCounts.pending)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: t.totalHoursLabel, value: fmtHoursScreen(periodTotalHours) },
            { label: t.miniExtrasLabel, value: extrasPendingCount, warn: extrasPendingCount > 0 },
            ...(expensesInUse ? [{ label: T[lang].expenses.pendingRow, value: pendingExpensesInPeriod, warn: pendingExpensesInPeriod > 0, onClick: () => setExpensesOpen(true) }] : []),
            ...(monthOffset === 0 ? [{ label: t.reviewTitle, value: reviewCount, warn: reviewCount > 0, onClick: () => setReviewOpen(true) }] : []),
          ].map((k) => (
            <button key={k.label} type="button" onClick={k.onClick} disabled={!k.onClick}
              style={{ textAlign: "left", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "12px 14px", color: "#fff", fontFamily: "inherit", cursor: k.onClick ? "pointer" : "default" }}>
              <div style={{ fontSize: 12, color: "#A9B2AC", fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: FONT.heading, fontSize: 24, marginTop: 2, color: k.warn ? "#F2C14E" : "#fff" }}>{k.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="chip-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0, maxWidth: "100%" }}>
          <FilterChip active={activeChip === "todos"} onClick={() => setActiveChip("todos")} count={board.length}>{t.filterAll}</FilterChip>
          <FilterChip active={activeChip === "pendentes"} onClick={() => setActiveChip("pendentes")} count={kpiCounts.pending}>{t.kpiPending}</FilterChip>
          <FilterChip active={activeChip === "porPagar"} onClick={() => setActiveChip("porPagar")} count={kpiCounts.unpaid}>{t.kpiUnpaid}</FilterChip>
          <FilterChip active={activeChip === "pagos"} onClick={() => setActiveChip("pagos")} count={kpiCounts.paid}>{t.kpiPaid}</FilterChip>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {monthOffset === 0 && <Button variant={reviewCount > 0 ? "primary" : "secondary"} onClick={() => setReviewOpen(true)}>{t.reviewButton(reviewCount)}</Button>}
          {expensesInUse && <Button variant={pendingExpenses.length > 0 ? "primary" : "secondary"} onClick={() => setExpensesOpen(true)}>{T[lang].expenses.reviewButton(pendingExpenses.length)}</Button>}
          <SearchField value={staffSearch} onChange={setStaffSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
        </div>
      </div>

      <DataTable columns={columns} rows={visibleStaff} onRowClick={(s) => setOpenStaffId(s.id)} />

      <Drawer
        open={!!(openStaff && openHoras)}
        onClose={() => { setOpenStaffId(null); setEditingIndex(null); }}
        width={640}
        avatar={openStaff && <Avatar name={openStaff.name} size={36} />}
        title={openStaff?.name}
        pill={openHoras && (openHoras.paid ? <Pill variant="paid">{c0.paid}</Pill> : openHoras.status === "finalizado" ? <Pill variant="owed">{t.kpiUnpaid}</Pill> : <Pill variant="pending">{c0.pending}</Pill>)}
        footer={openHoras && (
          <>
            <Button variant="secondary" onClick={exportStaffPdf}>{t.exportPdf}</Button>
            {openHoras.status === "finalizado" && !openHoras.paid && (
              <Button variant="secondary" onClick={() => setReopenConfirmOpen(true)}>{t.reopenForCorrection}</Button>
            )}
            <Button
              variant="primary" disabled={openHoras.status !== "finalizado"}
              disabledReason={openHoras.status !== "finalizado" ? t.waitingFinalize(openStaff.name) : undefined} disabledReasonBelow
              icon={openHoras.paid ? Check : undefined}
              onClick={() => (openHoras.paid ? setUnpayId(openStaff.id) : openPayDialog(openStaff.id))}
            >
              {openHoras.paid ? c0.paid : t.markAsPaid}
            </Button>
          </>
        )}
      >
        {openStaff && openHoras && (() => {
          const locked = openHoras.paid;
          const pendingExtras = openHoras.entries.filter((e) => e.extra && !e.approved && !e.voided && dateStrInPeriod(e.date, period)).length;
          const groups = groupEntriesByBlock(openHoras.entries, payPeriodChunks, lang, period);
          const lockedNow = migrateLockedWeeksToBlocks(openHoras.lockedWeeks || {}, period, cutoffDay);
          const weeksDone = openHoras.status === "finalizado" ? payPeriodChunks.length : payPeriodChunks.filter((ch) => lockedNow[isoDateStr(ch.start)]).length;
          const steps = [
            { label: t.cycleWeeks(weeksDone, payPeriodChunks.length), done: weeksDone >= payPeriodChunks.length || openHoras.status === "finalizado" },
            { label: t.cycleMonth, done: openHoras.status === "finalizado" },
            { label: c0.paid, done: !!openHoras.paid },
          ];
          const curStep = steps.findIndex((x) => !x.done);
          return (
            <>
              {paidStamp === openStaff.id && (
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
                  <div className="sx-stamp">✓ {c0.paid}</div>
                </div>
              )}
              <div role="list" aria-label={t.cycleAria} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {steps.map((st, i) => (
                  <div key={i} role="listitem" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span style={{ width: 18, height: 2, borderRadius: 2, background: st.done || steps[i - 1].done ? "var(--p1)" : COLORS.line }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                      background: st.done ? "var(--p1-12)" : i === curStep ? "#FBF0D9" : COLORS.lineSoft, color: st.done ? "var(--p2)" : i === curStep ? "#8A5A0B" : COLORS.ink3 }}>
                      {st.done ? <Check size={13} strokeWidth={3} /> : <span style={{ width: 14, height: 14, borderRadius: 7, border: "2px solid currentColor", display: "inline-block" }} />}
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniHoursLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtHoursScreen(staffTotalHours(openHoras, period))}</div>
                </Card>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniReceiveLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtEuro(staffTotalPay(openHoras, clients, period) + staffExpensesApproved(openHoras, period))}</div>
                </Card>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniExtrasLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{pendingExtras || "–"}</div>
                </Card>
              </div>

              {(() => {
                const list = expensesOf(openHoras, period);
                if (!openStaff.canExpenses && list.length === 0) return null;
                const tx = T[lang].expenses;
                return (
                  <div style={{ marginBottom: 18 }} data-testid="staff-expenses">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 8 }}>
                      <span>{tx.drawerTitle}</span>
                      <span>{tx.drawerTotal}: {fmtEuro(staffExpensesApproved(openHoras, period))}</span>
                    </div>
                    {list.length === 0 ? (
                      <div style={{ fontSize: 13, color: COLORS.ink3 }}>{tx.drawerEmpty}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x) => (
                          <ExpenseDecisionRow
                            key={x.id} lang={lang} expense={x} locked={!!openHoras.paid}
                            onApprove={(value) => decideExpense(openStaff.id, x.id, { status: "approved", approvedAmount: value, note: "" })}
                            onReject={(note) => decideExpense(openStaff.id, x.id, { status: "rejected", approvedAmount: null, note })}
                            onRevert={() => decideExpense(openStaff.id, x.id, { status: "pending", approvedAmount: null, note: "" })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {locked && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.lineSoft, color: COLORS.ink2, borderRadius: RADIUS.control, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
                  🔒 {t.lockedBanner}{openHoras.paidAt ? ` · ${t.paidOn(openHoras.paidAt.split("-").reverse().join("/"))}` : ""}
                </div>
              )}

              {groups.map((group) => {
                const subtotal = group.items.filter((e) => !e.voided).reduce((s, e) => s + e.hours, 0);
                return (
                  <div key={group.label} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 8 }}>
                      {group.label} · {fmtHoursScreen(subtotal)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {group.items.map((e) => {
                        const i = e._idx;
                        const isEditing = editingIndex === i;
                        const client = clientById(clients, e.clientId);
                        const pendingClient = isPendingClientEntry(e);
                        const valueHour = client ? client.valueHour : 0;
                        const d = parseISODate(e.date);
                        const dateLabel = `${dayAbbr[d.getDay()].toLowerCase()} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
                        return (
                          <div
                            key={i}
                            style={{
                              borderRadius: RADIUS.chip, border: `1px solid ${COLORS.line}`, padding: "10px 12px",
                              background: e.voided ? COLORS.lineSoft : ((e.extra && !e.approved) || pendingClient || e.shareReview || e.conflict) ? COLORS.amberBg
                                : (e.extra && e.approved) ? COLORS.okTint : (e.splitAdjusted && e.sharedCount > 1) ? COLORS.infoBg : COLORS.card,
                              opacity: e.voided ? 0.6 : 1,
                            }}
                          >
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <select value={rowDraft.clientId || ""} onChange={(ev) => setRowDraft((dft) => ({ ...dft, clientId: Number(ev.target.value) }))} style={{ flex: 1, minWidth: 140, height: 36, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 8px", fontFamily: "inherit" }}>
                                  <option value="" disabled>{t.clientPickPlaceholder}</option>
                                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input type="number" step="0.5" value={rowDraft.hours} onChange={(ev) => setRowDraft((dft) => ({ ...dft, hours: ev.target.value }))} style={{ width: 70, height: 36, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 8px", fontFamily: "inherit" }} />
                                <Button variant="secondary" onClick={cancelEditRow}>{c0.cancel}</Button>
                                <Button variant="primary" onClick={() => saveEditRow(openStaff.id, i)}>{c0.save}</Button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 13.5, color: COLORS.ink, textDecoration: e.voided ? "line-through" : "none" }}>
                                  {dateLabel} · {entryClientName(clients, e)} · {fmtHoursScreen(e.hours)} · {fmtEuro(valueHour)}/h · {fmtEuro(e.hours * valueHour)}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {e.voided ? (
                                    <>
                                      <Pill variant="missing">{t.voided}</Pill>
                                      {!locked && <Button variant="ghost" icon={RotateCcw} onClick={() => toggleVoid(openStaff.id, i)} />}
                                    </>
                                  ) : (
                                    <>
                                      {(() => {
                                        const people = peopleOnEntry(e);
                                        if (people.length === 0) return null;
                                        return (
                                          <SharedWithBadge
                                            people={people}
                                            title={t.sharedBadgeTitle(people.length)}
                                            heading={t.sharedBadgeHeading}
                                            note={client && client.hoursMode === "individual" ? t.sharedIndividualNote : undefined}
                                            summary={sharedSummary(e, people)}
                                          />
                                        );
                                      })()}
                                      {pendingClient && <Pill variant="pending">{t.clientPendingTag}</Pill>}
                                      {e.conflict && <Pill variant="pending">{t.conflictTag}</Pill>}
                                      {!e.voided && ((e.extra && !e.approved) || pendingClient || e.shareReview || e.conflict) && (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                          <Pill variant="pending">{t.attentionTag}</Pill>
                                          <InfoTip text={t.attentionInfo} label={c0.moreInfoLabel} />
                                        </span>
                                      )}
                                      {e.solo && !e.conflict && <Pill variant="paid">{t.soloRowTag}</Pill>}
                                      {e.shareReview && (
                                        <>
                                          <Pill variant="pending">{t.shareReviewTag}</Pill>
                                          {!locked && <Button variant="secondary" onClick={() => resplitEntry(e)}>{t.resplit}</Button>}
                                        </>
                                      )}
                                      {e.splitAdjusted && e.sharedCount > 1 && (
                                        <span style={{ background: COLORS.infoBg, color: COLORS.info, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "2px 9px" }}>{t.splitAdjustedTag}</span>
                                      )}
                                      {(e.extraMinutes || 0) < 0 && <Pill variant="neutral">{t.lessTag(Math.abs(e.extraMinutes))}</Pill>}
                                      {e.extra && (e.approved ? (
                                        <>
                                          <Pill variant="paid"><Check size={11} /> {t.approved}</Pill>
                                          {!locked && <Button variant="ghost" icon={RotateCcw} onClick={() => revertApproval(openStaff.id, i)} />}
                                        </>
                                      ) : (
                                        <>
                                          <Pill variant="pending">{t.extraPendingTag}</Pill>
                                          {!locked && <Button variant="secondary" onClick={() => approveEntry(openStaff.id, i)}>{t.approve}</Button>}
                                        </>
                                      ))}
                                      {!locked && <Button variant="ghost" icon={Pencil} onClick={() => startEditRow(i, e)} />}
                                      {!locked && <Button variant="ghost" icon={X} onClick={() => toggleVoid(openStaff.id, i)} />}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}
      </Drawer>

      <ConfirmDialog
        open={closeConfirmOpen}
        title={t.closeConfirmTitle}
        body={t.closeConfirmBody(periodLabel, fmtHoursScreen(periodTotalHours), fmtEuro(periodGrandTotal)) + (reviewCount > 0 ? ` ${t.reviewCloseWarn(reviewCount)}` : "")}
        cancelLabel={c0.cancel}
        confirmLabel={t.confirmClose}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={closePeriod}
      />

      {payAsk && (() => {
        const st = staff.find((x) => x.id === payAsk.staffId);
        const h = horasData[payAsk.staffId] || { entries: [] };
        const hoursValue = staffTotalPay(h, clients, period);
        const exp = staffExpensesApproved(h, period);
        return (
          <div
            role="dialog" aria-modal="true" aria-label={t.payConfirmTitle}
            onClick={() => setPayAsk(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: 440, maxWidth: "100%", borderRadius: RADIUS.card, padding: 24, boxSizing: "border-box" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>{t.payConfirmTitle}</div>
              <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 14 }}>{t.payConfirmBody(st ? st.name : "")}</div>
              <div style={{ background: COLORS.bg, borderRadius: RADIUS.control, padding: "12px 14px", marginBottom: 14, fontSize: 13.5, color: COLORS.ink }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t.payHoursLine(fmtHoursScreen(staffTotalHours(h, period)))}</span><span>{fmtEuro(hoursValue)}</span></div>
                {exp > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{T[lang].expenses.colExpenses}</span><span>{fmtEuro(exp)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.line}`, fontWeight: 700 }}><span>{t.payTotalLine}</span><span>{fmtEuro(hoursValue + exp)}</span></div>
                {st && st.iban && <div style={{ marginTop: 8, fontSize: 12.5, color: COLORS.ink2 }}>IBAN: {st.iban}</div>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink2, marginBottom: 4 }}>{t.payDateLabel}</div>
              <DateField value={payAsk.date} onChange={(v) => setPayAsk((a) => ({ ...a, date: v }))} openLabel={c0.edit} />
              {!payDateOk && <div style={{ fontSize: 12.5, color: COLORS.dangerInk, marginTop: 4 }}>{t.payDateInvalid}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                <Button variant="secondary" onClick={() => setPayAsk(null)}>{c0.cancel}</Button>
                <Button variant="primary" disabled={!payDateOk} onClick={confirmPay}>{t.payConfirmYes}</Button>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        open={unpayId != null} title={t.unpayTitle}
        body={t.unpayBody((staff.find((x) => x.id === unpayId) || {}).name || "")}
        cancelLabel={t.unpayKeep} confirmLabel={t.unpayYes} destructive
        onCancel={() => setUnpayId(null)} onConfirm={confirmUnpay}
      />

      <ConfirmDialog
        open={reopenConfirmOpen}
        title={t.reopenConfirmTitle}
        body={openStaff ? t.reopenConfirmBody(openStaff.name) : ""}
        cancelLabel={c0.cancel}
        confirmLabel={t.reopenConfirmConfirm}
        onCancel={() => setReopenConfirmOpen(false)}
        onConfirm={() => reopenForCorrection(openStaff.id)}
      />

      <HoursReviewDialog
        open={reviewOpen} initialTab={navIntent && navIntent.openReviews ? navIntent.tab || null : null}
        onClose={() => setReviewOpen(false)}
        onChange={(next, msg) => {
          setHorasData(next);
          setRecalcToast(msg);
          setTimeout(() => setRecalcToast(null), 5000);
        }}
        horasData={horasData} clients={clients} staff={staff} period={period} ctx={ctx} lang={lang} t={t}
      />
      <ExpensesReviewDrawer
        lang={lang} open={expensesOpen} onClose={() => setExpensesOpen(false)}
        items={pendingExpenses} staff={staff} decide={decideExpense}
      />
      {closedToast && <Toast message={t.closedToast} onDismiss={() => setClosedToast(false)} closeLabel={c0.close} />}
      {recalcToast && <Toast message={recalcToast} onDismiss={() => setRecalcToast(null)} closeLabel={c0.close} />}
    </div>
  );
}

export default HorasScreen;
