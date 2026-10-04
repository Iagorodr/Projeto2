import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Pencil, X, RotateCcw } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { useControlSize } from "../../hooks/useBreakpoint.js";
import { TODAY } from "../../models/data.js";
import {
  clientById, pad2, fmtEuro, fmtHoursScreen, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, formatPeriodLabel,
  startOfISOWeek, isoDateStr, weekLabelPT, staffTotalHours, staffTotalPay,
  weekBlocksOfPayPeriod, calPeriodLabel, boardStaff,
} from "../../models/utils.js";
import { formatTodayLabel, T, DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import { exportStaffHorasPdf, exportPeriodSummaryPdf } from "../../models/pdfExport.js";
import {
  PageHeader, Card, SegmentedBar, FilterChip, SearchField, Button, Pill,
  Avatar, DataTable, Drawer, ConfirmDialog, Toast,
} from "../shared/ui/index.js";
import { LANG_NAMES } from "../../models/data.js";

// "2026-09-20" -> Date local (meia-noite), igual ao resto do app faz com
// datas ISO vindas de `horasData`.
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Agrupa os lançamentos de um funcionário pelos blocos do período aberto
// (documento, 6.1 — "28 set – 4 out", etc.), mantendo o índice ORIGINAL de
// cada entrada em `_idx` (as funções de aprovar/editar/anular operam por
// índice no array `entries` tal como já estava). Uma entrada que caia fora
// de todos os blocos do período (ex.: adiantada bem para a frente) cai num
// grupo à parte pela sua própria semana civil, para nunca desaparecer da
// gaveta.
function groupEntriesByBlock(entries, payPeriodChunks, lang) {
  const blocks = payPeriodChunks.map((chunk) => ({ chunk, items: [] }));
  const leftovers = new Map();
  entries.forEach((entry, idx) => {
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
function HorasScreen({ lang, setLang, company, clients, staff, horasData, setHorasData, cutoffDay, closedPeriods, setClosedPeriods, sentItems, missingItems, setSentItems, setMissingItems }) {
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
  const canClosePeriod = board.length > 0 && unpaidForClose === 0;

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
        next[s.id] = { ...current, status: "pendente", paid: false, entries: keptEntries, lockedWeeks: keptLockedWeeks, noClientDays: keptNoClientDays, reopened: false };
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
      return { name: s.name, paid: h.paid, status: h.status, hours: staffTotalHours(h, period), value: staffTotalPay(h, clients, period) };
    });
    exportPeriodSummaryPdf({
      companyName: company?.name,
      periodLabel,
      rows,
      totalHours: periodTotalHours,
      totalValue: periodTotalEuros,
      pdfT,
      statusLabels: { paid: c0.paid, finished: t.statusFinished, pending: c0.pending },
    });
  }
  function exportStaffPdf() {
    exportStaffHorasPdf({
      companyName: company?.name,
      staffName: openStaff.name,
      periodLabel,
      entries: openHoras.entries,
      clients,
      totalHours: staffTotalHours(openHoras, period),
      totalValue: staffTotalPay(openHoras, clients, period),
      lang,
      pdfT,
    });
  }

  function updateHoras(staffId, updater) {
    setHorasData((prev) => ({ ...prev, [staffId]: updater(prev[staffId]) }));
  }
  function togglePaid(staffId) {
    updateHoras(staffId, (h) => (h.status === "finalizado" ? { ...h, paid: !h.paid } : h));
  }
  function reopenForCorrection(staffId) {
    updateHoras(staffId, (h) => ({ ...h, status: "pendente", lockedWeeks: {}, reopened: true }));
    setReopenConfirmOpen(false);
  }
  function approveEntry(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: true } : e)) }));
  }
  function revertApproval(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: false } : e)) }));
  }
  function toggleVoid(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, voided: !e.voided } : e)) }));
  }
  function startEditRow(i, entry) { setEditingIndex(i); setRowDraft({ clientId: entry.clientId, hours: entry.hours }); }
  function cancelEditRow() { setEditingIndex(null); }
  function saveEditRow(staffId, i) {
    updateHoras(staffId, (h) => ({
      ...h,
      entries: h.entries.map((e, idx) => (idx === i ? { ...e, clientId: rowDraft.clientId, hours: Number(rowDraft.hours) || 0, approved: e.extra ? false : e.approved } : e)),
    }));
    setEditingIndex(null);
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
    { key: "hours", label: t.colTotalHours, width: 1, render: (s) => fmtHoursScreen(staffTotalHours(horasData[s.id] || { entries: [] }, period)) },
    {
      key: "extras", label: t.miniExtrasLabel, width: 1,
      render: (s) => {
        const h = horasData[s.id] || { entries: [] };
        const n = h.entries.filter((e) => e.extra && !e.approved && !e.voided).length;
        return n > 0 ? <Pill variant="pending">{n}</Pill> : <span style={{ color: COLORS.ink3 }}>–</span>;
      },
    },
    { key: "pay", label: t.colTotalPay, width: 1, numeric: true, render: (s) => fmtEuro(staffTotalPay(horasData[s.id] || { entries: [] }, clients, period)) },
    {
      key: "paid", label: t.colPaid, width: 1,
      render: (s) => {
        const h = horasData[s.id] || { status: "pendente", paid: false };
        const togglable = h.status === "finalizado";
        return (
          <button
            type="button"
            title={togglable ? t.markAsPaid : t.waitingFinalize(s.name)}
            disabled={!togglable}
            onClick={(ev) => { ev.stopPropagation(); togglePaid(s.id); }}
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
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.pill, padding: 3 }}>
              <button
                type="button" onClick={() => setMonthOffset((m) => m - 1)} aria-label={t.previousPeriod}
                style={{ width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, padding: "0 4px", whiteSpace: "nowrap" }}>{periodLabel}</span>
              <button
                type="button" onClick={() => setMonthOffset((m) => m + 1)} aria-label={t.nextPeriod}
                style={{ width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="secondary" onClick={exportPeriodPdf}>{t.exportPdfGeneral}</Button>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <Button variant="primary" disabled={!canClosePeriod} onClick={() => setCloseConfirmOpen(true)}>{t.closePeriod}</Button>
              {!canClosePeriod && <Pill variant="pending">{t.missingPaymentsHint(unpaidForClose)}</Pill>}
            </div>
          </div>
        )}
      />

      {isLateClosing && (
        <Card variant="alert" style={{ marginBottom: 16 }}>
          {t.lateClosingBanner(periodLabel)}
        </Card>
      )}

      <Card variant="hero" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>{t.heroTitle}</div>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 32, marginBottom: 2 }}>{fmtEuro(periodTotalEuros)}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }}>{fmtHoursScreen(periodTotalHours)} · {periodLabel}</div>
        <SegmentedBar
          onHero
          segments={[
            { value: kpiCounts.paid, color: "#fff" },
            { value: kpiCounts.unpaid, color: COLORS.clay },
            { value: kpiCounts.pending, color: "rgba(255,255,255,.28)" },
          ]}
        />
        <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 8 }}>
          {t.heroLegend(kpiCounts.paid, kpiCounts.unpaid, kpiCounts.pending)}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip active={activeChip === "todos"} onClick={() => setActiveChip("todos")} count={board.length}>{t.filterAll}</FilterChip>
          <FilterChip active={activeChip === "pendentes"} onClick={() => setActiveChip("pendentes")} count={kpiCounts.pending}>{t.kpiPending}</FilterChip>
          <FilterChip active={activeChip === "porPagar"} onClick={() => setActiveChip("porPagar")} count={kpiCounts.unpaid}>{t.kpiUnpaid}</FilterChip>
          <FilterChip active={activeChip === "pagos"} onClick={() => setActiveChip("pagos")} count={kpiCounts.paid}>{t.kpiPaid}</FilterChip>
        </div>
        <SearchField value={staffSearch} onChange={setStaffSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
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
              icon={openHoras.paid ? Check : undefined}
              onClick={() => togglePaid(openStaff.id)}
            >
              {openHoras.paid ? c0.paid : t.markAsPaid}
            </Button>
          </>
        )}
      >
        {openStaff && openHoras && (() => {
          const locked = openHoras.paid;
          const pendingExtras = openHoras.entries.filter((e) => e.extra && !e.approved && !e.voided).length;
          const groups = groupEntriesByBlock(openHoras.entries, payPeriodChunks, lang);
          return (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniHoursLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtHoursScreen(staffTotalHours(openHoras, period))}</div>
                </Card>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniReceiveLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtEuro(staffTotalPay(openHoras, clients, period))}</div>
                </Card>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.miniExtrasLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{pendingExtras || "–"}</div>
                </Card>
              </div>

              {locked && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.lineSoft, color: COLORS.ink2, borderRadius: RADIUS.control, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
                  🔒 {t.lockedBanner}
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
                        const valueHour = client ? client.valueHour : 0;
                        const d = parseISODate(e.date);
                        const dateLabel = `${dayAbbr[d.getDay()].toLowerCase()} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
                        return (
                          <div
                            key={i}
                            style={{
                              borderRadius: RADIUS.chip, border: `1px solid ${COLORS.line}`, padding: "10px 12px",
                              background: e.voided ? COLORS.lineSoft : (e.extra && !e.approved) ? COLORS.amberBg : COLORS.card,
                              opacity: e.voided ? 0.6 : 1,
                            }}
                          >
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <select value={rowDraft.clientId || ""} onChange={(ev) => setRowDraft((dft) => ({ ...dft, clientId: Number(ev.target.value) }))} style={{ flex: 1, minWidth: 140, height: 36, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 8px", fontFamily: "inherit" }}>
                                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input type="number" step="0.5" value={rowDraft.hours} onChange={(ev) => setRowDraft((dft) => ({ ...dft, hours: ev.target.value }))} style={{ width: 70, height: 36, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 8px", fontFamily: "inherit" }} />
                                <Button variant="secondary" onClick={cancelEditRow}>{c0.cancel}</Button>
                                <Button variant="primary" onClick={() => saveEditRow(openStaff.id, i)}>{c0.save}</Button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ fontSize: 13.5, color: COLORS.ink, textDecoration: e.voided ? "line-through" : "none" }}>
                                  {dateLabel} · {client ? client.name : "—"} · {fmtHoursScreen(e.hours)} · {fmtEuro(valueHour)}/h · {fmtEuro(e.hours * valueHour)}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {e.voided ? (
                                    <>
                                      <Pill variant="missing">{t.voided}</Pill>
                                      {!locked && <Button variant="ghost" icon={RotateCcw} onClick={() => toggleVoid(openStaff.id, i)} />}
                                    </>
                                  ) : (
                                    <>
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
        body={t.closeConfirmBody(periodLabel, fmtHoursScreen(periodTotalHours), fmtEuro(periodTotalEuros))}
        cancelLabel={c0.cancel}
        confirmLabel={t.confirmClose}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={closePeriod}
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

      {closedToast && <Toast message={t.closedToast} onDismiss={() => setClosedToast(false)} closeLabel={c0.close} />}
    </div>
  );
}

export default HorasScreen;
