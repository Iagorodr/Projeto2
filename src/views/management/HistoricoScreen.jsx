import { useState } from "react";
import {
  ArrowLeft, Clock, Euro, Users, MessageSquare, ThumbsUp, Bell, PackageX, TrendingUp, TrendingDown, Minus, Trash2,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { clientById, entryClientName, fmtEuro, fmtHoursNum, fmtHoursScreen, fmtNoteDate, pctChange, groupSentItems } from "../../models/utils.js";
import { T, missingItemSubjectLabel } from "../../models/i18n.js";
import { exportGenericTablePdf } from "../../models/pdfExport.js";
import {
  PageHeader, DataTable, Drawer, Button, Pill, Card, KpiCard, ReclamacoesCard, Avatar, ConfirmDialog, InfoTip,
} from "../shared/ui/index.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

// Pílula de variação face ao período anterior (documento, 4.6: "pílula de
// variação '+6 %'", na lista e nos 2 primeiros KPIs do detalhe).
//
// Antes (ComplaintsGauge/DeltaBadge antigos) uma descida usava
// `styles.histKpiDeltaDown` = `COLORS.extra`/`extraTint`, que são
// LITERALMENTE o mesmo par hex de `COLORS.alert`/`alertTint` (ver
// colors.js) — ou seja, "menos horas que o mês passado" pintava a cor de
// erro, violando a regra de QA geral do documento (1.5: "nenhuma cor de
// alerta em elementos que não sejam erro ou falta"). Uma variação pra
// menos não é um erro nem uma falta, por isso as duas direções (sobe/desce)
// usam agora o MESMO par neutro ("aço", já usado por `SupervisorTag
// kind="role"`) — só o ícone (seta/traço) e o sinal do número indicam a
// direção, nunca a cor.
function DeltaPill({ value, t, compact }) {
  if (value === null) {
    if (compact) return null;
    return (
      <div style={{ ...DELTA_BASE, background: COLORS.lineSoft, color: COLORS.ink3, marginTop: compact ? 0 : 8 }}>
        {t.noPrevious}
      </div>
    );
  }
  const rounded = Math.round(value);
  const flat = Math.abs(rounded) < 1;
  const isUp = rounded > 0;
  return (
    <div style={{ ...DELTA_BASE, background: COLORS.steelBg, color: COLORS.steelInk, marginTop: compact ? 0 : 8 }}>
      {flat ? <Minus size={11} /> : isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {flat ? "0%" : `${isUp ? "+" : ""}${rounded}%`}
      {!compact && ` ${t.vsPrevious}`}
    </div>
  );
}

const DELTA_BASE = {
  display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap",
};

// Barra de dados fina (documento, 4.6: coluna "Horas" da lista) — não é a
// `ProgressBar` partilhada (essa mostra feito/meta com rótulo; aqui não há
// meta nenhuma, só grandeza relativa de um período frente aos outros da
// própria lista, por isso um traço bem mais fino e sem texto).
function DataBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: 56, height: 4, borderRadius: 2, background: COLORS.lineSoft, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: COLORS.forest500, borderRadius: 2 }} />
    </div>
  );
}

// Tile de data (dia + mês) pra cada item do cartão "Ocorrências do período"
// — mesmo visual do `NoteDateTile` da Dashboard (4.1), só que menor (36 em
// vez de 46, porque aqui a lista pode ter vários itens, não 1-2 como lá) e,
// por segurança, tolerando tanto "YYYY-MM-DD" quanto "DD/MM" (o mesmo par
// de formatos que `dateStrInPeriod`/utils.js já trata em todo o app) — na
// prática `sentItems`/`missingItems` são sempre criados com `isoDateStr`,
// mas um tile que só soubesse ler ISO quebraria silenciosamente se isso
// mudar um dia (mesma classe de bug já corrigido em `fmtNoteDate`/4d).
function splitDateParts(dateStr) {
  if (!dateStr) return [null, null];
  if (dateStr.includes("-")) { const [, m, d] = dateStr.split("-"); return [d, m]; }
  if (dateStr.includes("/")) { const [d, m] = dateStr.split("/"); return [d, m]; }
  return [null, null];
}

function OccurrenceDateTile({ date, lang }) {
  const [d, m] = splitDateParts(date);
  if (!d) return null;
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: RADIUS.chip, background: COLORS.clayTint,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 13, lineHeight: 1, color: COLORS.clayInk }}>{Number(d)}</div>
      <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: COLORS.clayInk, marginTop: 2 }}>
        {monthAbbrSafe(lang, m)}
      </div>
    </div>
  );
}

// `monthAbbr` espera o índice 0-based do mês; aqui já temos o mês como
// string "MM" vindo de `splitDateParts`.
function monthAbbrSafe(lang, mStr) {
  const idx = Number(mStr) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return "";
  return MONTHS_FALLBACK[lang]?.[idx] || MONTHS_FALLBACK.pt[idx];
}
const MONTHS_FALLBACK = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
  fr: ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"],
};

// Uma secção do cartão "Ocorrências do período" (documento, 4.6, ponto 3):
// substitui as 4 caixas empilhadas (`OccurrenceCard` antigo) por
// separadores dentro de UM cartão só. `statusOf(item)` é opcional — só o
// grupo "Pedidos" o usa, pra mostrar Resolvido/Pendente por item.
function OccurrenceSection({ icon: Icon, title, items, emptyLabel, clients, lang, statusOf, kindOf, first }) {
  return (
    <div style={{ padding: first ? "0 0 18px" : "18px 0", borderTop: first ? "none" : `1px solid ${COLORS.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: COLORS.ink, marginBottom: 12 }}>
        <Icon size={15} color={COLORS.ink2} />
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink3 }}>{emptyLabel}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => {
            const c = clientById(clients, item.clientId);
            return (
              <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <OccurrenceDateTile date={item.date} lang={lang} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{c ? c.name : "—"}</div>
                    {statusOf && statusOf(item)}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 2 }}>
                    {kindOf ? `${kindOf(item)} — ` : ""}{item.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Carimbos do período (documento p. 29): PAGO quando todos os que trabalharam
// estão pagos; REABERTO quando houve um mês reaberto para correção nesse período
// (registado no fecho a partir desta versão; períodos antigos não o têm).
// Sem PAGO, mostra "N por pagar" a âmbar. `index` dá o atraso da cascata.
function periodStatus(p) {
  const worked = (p.staffSummaries || []).filter((s) => s.hours > 0 || s.euros > 0);
  const unpaid = worked.filter((s) => !s.paid).length;
  const reopened = (p.staffSummaries || []).some((s) => s.reopened);
  return { paid: worked.length > 0 && unpaid === 0, unpaid, reopened };
}

function Stamp({ tone, children, delay }) {
  const c = tone === "re" ? { ink: COLORS.reopened, bg: COLORS.reopenedBg } : { ink: COLORS.ok, bg: COLORS.okTint };
  return (
    <span
      className="b1-stamp-hit"
      style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 6, border: `2px solid ${c.ink}`, color: c.ink, background: c.bg,
        fontFamily: FONT.heading, fontWeight: 900, fontSize: 11, letterSpacing: "0.08em", lineHeight: 1.3, whiteSpace: "nowrap",
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </span>
  );
}

function PeriodStamps({ p, t, index = 0 }) {
  const st = periodStatus(p);
  const delay = 150 + Math.min(index, 12) * 90;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
      {st.paid ? <Stamp delay={delay}>{t.b1Paid}</Stamp> : st.unpaid > 0 ? <Pill variant="pending">{t.b1Unpaid(st.unpaid)}</Pill> : null}
      {st.reopened && <span title={t.b1ReopenedHint}><Stamp tone="re" delay={delay + 60}>{t.b1Reopened}</Stamp></span>}
    </div>
  );
}

// Resumo do último período fechado vs o anterior.
function LastPeriodSummary({ p, prev, t, mobile, onOpen }) {
  const value = p.totalEuros + (p.totalExpenses || 0);
  const prevValue = prev ? prev.totalEuros + (prev.totalExpenses || 0) : null;
  const people = (p.staffSummaries || []).filter((s) => s.hours > 0).length;
  const dRecl = prev ? p.reclamacoes - prev.reclamacoes : null;
  const metric = (label, val, extra) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.ink3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: mobile ? 22 : 26, lineHeight: 1.1, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>{val}</div>
      {extra && <div style={{ marginTop: 6 }}>{extra}</div>}
    </div>
  );
  return (
    <Card className="b1-rise" style={{ marginBottom: 18, padding: mobile ? 16 : "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.b1Last}</span>
          <span style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 17, color: COLORS.ink }}>{p.periodLabel}</span>
          <PeriodStamps p={p} t={t} />
        </div>
        {!mobile && <Button variant="secondary" onClick={onOpen}>{t.b1Open}</Button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: mobile ? 16 : 20 }}>
        {metric(t.kpiHours, fmtHoursScreen(p.totalHours), <DeltaPill value={pctChange(p.totalHours, prev ? prev.totalHours : null)} t={t} compact={mobile} />)}
        {metric(t.kpiValue, fmtEuro(value), <DeltaPill value={pctChange(value, prevValue)} t={t} compact={mobile} />)}
        {metric(t.colComplaints, p.reclamacoes, dRecl === null ? null : <span style={{ fontSize: 12, fontWeight: 600, color: dRecl > 0 ? COLORS.clayInk : COLORS.ink2 }}>{t.b1ComplaintsDelta(dRecl)}</span>)}
        {metric(t.b1People, people, <span style={{ fontSize: 12, color: COLORS.ink2 }}>{t.b1OccShort(p.reclamacoes, p.elogios, p.avisos)}</span>)}
      </div>
      {mobile && <div style={{ marginTop: 16, display: "flex" }}><Button variant="secondary" onClick={onOpen} style={{ flex: 1 }}>{t.b1Open}</Button></div>}
    </Card>
  );
}

// Telemóvel: cartões agrupados por ano (o ano do fim do período), com a mesma
// seleção para apagar que a tabela do PC.
function MobilePeriodList({ periods, t, onOpen, valueOf, selectable, selectedIds, onToggleSelect, batch }) {
  if (periods.length === 0) {
    return <Card style={{ padding: "28px 16px", textAlign: "center", fontSize: 13.5, color: COLORS.ink2 }}>{t.noResults}</Card>;
  }
  const groups = [];
  periods.forEach((p, i) => {
    const y = (p.periodEnd || "").slice(0, 4) || "—";
    const g = groups[groups.length - 1];
    if (g && g.year === y) g.items.push({ p, i }); else groups.push({ year: y, items: [{ p, i }] });
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((g) => (
        <section key={g.year}>
          <div style={{ fontFamily: FONT.heading, fontWeight: 800, fontSize: 15, color: COLORS.ink2, margin: "0 2px 8px" }}>{g.year}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map(({ p, i }) => {
              const selected = selectedIds?.has(p.id);
              return (
                <div
                  key={p.id} role="button" tabIndex={0} onClick={() => onOpen(p)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(p); }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: RADIUS.card, cursor: "pointer", background: selected ? COLORS.forest50 : COLORS.card, border: `1px solid ${selected ? COLORS.forest600 : COLORS.line}` }}
                >
                  {selectable && (
                    <label onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", padding: "2px 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect(p.id)} style={{ width: 20, height: 20, margin: 0, accentColor: COLORS.vivo, cursor: "pointer" }} />
                    </label>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{p.periodLabel}</span>
                      <PeriodStamps p={p} t={t} index={i} />
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 13.5, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
                      <span><b>{fmtHoursScreen(p.totalHours)}</b></span>
                      <span><b>{fmtEuro(valueOf(p))}</b></span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 4 }}>{t.b1OccShort(p.reclamacoes, p.elogios, p.avisos)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {batch && (
        <div style={{ position: "fixed", bottom: 116, left: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: COLORS.forest900, color: "#fff", padding: "10px 14px", borderRadius: RADIUS.card, boxShadow: "0 12px 30px rgba(0,0,0,.25)", fontSize: 13, zIndex: 40 }}>
          {batch}
        </div>
      )}
    </div>
  );
}

function HistoricoScreen({ lang, setLang, company, clients, closedPeriods, onDeletePeriods, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount }) {
  const t = T[lang].historico;
  const c0 = T[lang].common;
  const pdfT = T[lang].pdf;
  const dashT = T[lang].dashboard;
  const horasT = T[lang].horas;
  const avisosT = T[lang].avisos;
  const [openId, setOpenId] = useState(null);
  const [openStaffId, setOpenStaffId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleteIds, setDeleteIds] = useState(null); // ids a apagar (diálogo de confirmação aberto)
  const isMobile = useIsMobile();

  const openIndex = closedPeriods.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? closedPeriods[openIndex] : null;
  // closedPeriods vem do mais recente pro mais antigo, então o "anterior"
  // cronologicamente é o próximo índice da lista.
  const previous = openIndex >= 0 ? closedPeriods[openIndex + 1] : null;

  // Apagar períodos do Histórico (só o registo: as horas já foram arquivadas no
  // fecho). Apagar o MAIS RECENTE muda o período aberto — `getOpenPeriod` parte
  // do fim do último período fechado —, por isso o aviso é mais forte.
  const canDelete = typeof onDeletePeriods === "function";
  const deleting = deleteIds ? closedPeriods.filter((p) => deleteIds.includes(p.id)) : [];
  const deletingLatest = deleting.some((p) => p.id === closedPeriods[0]?.id);
  const remainingAfterDelete = closedPeriods.filter((p) => !(deleteIds || []).includes(p.id));
  function toggleSelect(id) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === closedPeriods.length ? new Set() : new Set(closedPeriods.map((p) => p.id))));
  }
  function confirmDelete() {
    const ids = deleteIds || [];
    onDeletePeriods(ids);
    setDeleteIds(null);
    setSelectedIds(new Set());
    if (ids.includes(openId)) { setOpenId(null); setOpenStaffId(null); }
  }
  const deleteDialog = canDelete && (
    <ConfirmDialog
      open={!!deleteIds && deleting.length > 0}
      title={t.deleteTitle(deleting.length)}
      body={(
        <>
          <div>{t.deleteBody(deleting.map((p) => p.periodLabel))}</div>
          {deletingLatest && (
            <div style={{ marginTop: 10, fontWeight: 600, color: COLORS.alert }}>
              {remainingAfterDelete.length > 0 ? t.deleteLatestBody : t.deleteLatestBodyNone}
            </div>
          )}
        </>
      )}
      cancelLabel={c0.cancel}
      confirmLabel={t.deleteConfirmBtn}
      destructive
      requireTypedWord={t.deleteTyped}
      typedWordHint={t.deleteTypedHint}
      onCancel={() => setDeleteIds(null)}
      onConfirm={confirmDelete}
    />
  );

  function exportAuditPdf() {
    // fmtHoursNum (não fmtHoursScreen) de propósito aqui: o próprio
    // comentário de utils.js é explícito — fmtHoursScreen é "pro ecrã",
    // fmtHoursNum é "só pra PDF/exportações" (o resto do app já segue essa
    // mesma regra, ex.: exportStaffHorasPdf).
    const rows = open.staffSummaries.map((s) => [s.name, `${fmtHoursNum(s.hours)}h`, fmtEuro(s.euros), s.paid ? c0.paid : c0.unpaid]);
    exportGenericTablePdf({
      companyName: company?.name,
      companyInfo: company,
      reportTitle: t.title,
      subtitle: `${open.periodLabel} · ${t.closedAt} ${fmtNoteDate(open.closedAt)}`,
      columns: [T[lang].funcionarios.colName, pdfT.colTotalHours, pdfT.colTotalPay, pdfT.colStatus],
      rows,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      totals: [
        { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(open.totalHours)}h` },
        { label: pdfT.totalValueLabel, value: fmtEuro(open.totalEuros + (open.totalExpenses || 0)) },
        { label: t.colComplaints, value: String(open.reclamacoes) },
        { label: t.colPraise, value: String(open.elogios) },
        { label: t.colNotices, value: String(open.avisos) },
        { label: t.colSolicitations, value: `${open.solicitacoesResolvidas}/${open.solicitacoes}` },
      ],
      pdfT,
      fileName: `historico-${open.periodLabel.replace(/\s+/g, "_")}.pdf`,
    });
  }

  // ---------- Lista (ecrã inicial do Histórico) ----------
  // Redesign B1 (documento p. 29): resumo do último período vs o anterior; lista
  // com horas, valor pago, ocorrências e carimbo PAGO / REABERTO (batem em
  // cascata); seleção + Apagar com "APAGAR" mantidos. Telemóvel: cartões
  // agrupados por ano.
  if (!open) {
    const maxHours = Math.max(1, ...closedPeriods.map((p) => p.totalHours));
    const valueOf = (p) => p.totalEuros + (p.totalExpenses || 0);
    const prevOf = (p) => closedPeriods[closedPeriods.indexOf(p) + 1] || null;
    const stampsOf = (p, i) => <PeriodStamps p={p} t={t} index={i} />;
    const listColumns = [
      { key: "period", label: t.colPeriod, width: 1.3, render: (p) => <span style={{ fontWeight: 600 }}>{p.periodLabel}</span> },
      { key: "status", label: <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>{t.b1ColStatus}<InfoTip text={t.b1StatusInfo} label={c0.moreInfoLabel} /></span>, width: 1.3, allowOverflow: true, render: (p) => stampsOf(p, closedPeriods.indexOf(p)) },
      {
        key: "hours", label: t.colHours, width: 1.5,
        render: (p) => {
          const prev = prevOf(p);
          const delta = pctChange(p.totalHours, prev ? prev.totalHours : null);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{fmtHoursScreen(p.totalHours)}</span>
                <DeltaPill value={delta} t={t} compact />
              </div>
              <DataBar value={p.totalHours} max={maxHours} />
            </div>
          );
        },
      },
      {
        key: "value", label: t.colValue, width: 1.6,
        render: (p) => {
          const prev = prevOf(p);
          const delta = pctChange(valueOf(p), prev ? valueOf(prev) : null);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{fmtEuro(valueOf(p))}</span>
              <DeltaPill value={delta} t={t} compact />
            </div>
          );
        },
      },
      {
        key: "complaints", label: t.colComplaints,
        render: (p) => {
          const historicalClientCount = p.clientCount ?? clients.length;
          const excelente = Math.max(0, Math.round((historicalClientCount / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
          const color = p.reclamacoes === 0 ? COLORS.okInk : p.reclamacoes <= excelente ? COLORS.ink2 : COLORS.clayInk;
          return <span style={{ fontWeight: 600, color }}>{p.reclamacoes}</span>;
        },
      },
      { key: "praise", label: t.colPraise, render: (p) => p.elogios },
      { key: "notices", label: t.colNotices, render: (p) => p.avisos },
      {
        key: "solicitations", label: t.colSolicitations, width: 1.1,
        render: (p) => {
          const allResolved = p.solicitacoes === 0 || p.solicitacoesResolvidas === p.solicitacoes;
          return <Pill variant={allResolved ? "paid" : "pending"}>{p.solicitacoesResolvidas}/{p.solicitacoes}</Pill>;
        },
      },
    ];
    const selectionProps = canDelete ? {
      selectedIds,
      onToggleSelect: toggleSelect,
      onToggleSelectAll: toggleSelectAll,
      batchActions: <Button variant="dangerSolid" onClick={() => setDeleteIds([...selectedIds])}>{t.deleteSelected}</Button>,
      batchLabel: (n) => t.selectedCount(n),
    } : {};

    return (
      <div style={styles.content}>
        <PageHeader title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
        {closedPeriods.length > 0 && (
          <LastPeriodSummary p={closedPeriods[0]} prev={closedPeriods[1] || null} t={t} mobile={isMobile} onOpen={() => setOpenId(closedPeriods[0].id)} />
        )}
        {isMobile ? (
          <MobilePeriodList
            periods={closedPeriods} t={t} onOpen={(p) => setOpenId(p.id)} valueOf={valueOf}
            selectable={canDelete} selectedIds={selectedIds} onToggleSelect={toggleSelect}
            batch={canDelete && selectedIds.size > 0 ? (
              <>
                <span>{t.selectedCount(selectedIds.size)}</span>
                <Button variant="dangerSolid" onClick={() => setDeleteIds([...selectedIds])}>{t.deleteSelected}</Button>
              </>
            ) : null}
          />
        ) : (
          <DataTable
            columns={listColumns}
            rows={closedPeriods}
            onRowClick={(p) => setOpenId(p.id)}
            emptyMessage={t.noResults}
            {...selectionProps}
          />
        )}
        {deleteDialog}
      </div>
    );
  }

  // ---------- Detalhe (documento, 4.6: "página, com '‹ Histórico' no topo") ----------
  const staffInvolved = open.staffSummaries.filter((s) => s.hours > 0).length;
  const deltaHours = pctChange(open.totalHours, previous ? previous.totalHours : null);
  const deltaValue = pctChange(open.totalEuros + (open.totalExpenses || 0), previous ? previous.totalEuros + (previous.totalExpenses || 0) : null);

  // open.clientCount é o nº de clientes NO FECHO deste período — congelado,
  // pra faixa não "andar" quando clientes são criados/removidos depois.
  const historicalClientCount = open.clientCount ?? clients.length;
  const excelenteThreshold = Math.max(0, Math.round((historicalClientCount / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((historicalClientCount / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));

  const openStaff = open.staffSummaries.find((s) => s.staffId === openStaffId);
  const staffColumns = [
    { key: "name", label: T[lang].funcionarios.colName, width: 2, render: (s) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
    { key: "hours", label: t.colHours, numeric: true, render: (s) => fmtHoursScreen(s.hours) },
    { key: "value", label: t.colValue, numeric: true, render: (s) => fmtEuro(s.euros) },
    { key: "paid", label: c0.paid, render: (s) => <Pill variant={s.paid ? "paid" : "owed"}>{s.paid ? c0.paid : c0.unpaid}</Pill> },
  ];

  return (
    <div style={styles.content}>
      <div style={{ marginBottom: 6 }}>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => { setOpenId(null); setOpenStaffId(null); }}>{t.backToList}</Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, color: COLORS.ink, margin: 0 }}>{open.periodLabel}</h1>
          <Pill variant="neutral">{t.closedAt} {fmtNoteDate(open.closedAt)}</Pill>
          <PeriodStamps p={open} t={t} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={exportAuditPdf}>{horasT.exportPdfGeneral}</Button>
          {canDelete && <Button variant="dangerSoft" icon={Trash2} onClick={() => setDeleteIds([open.id])}>{t.deletePeriod}</Button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard icon={Clock} label={t.kpiHours} value={fmtHoursScreen(open.totalHours)} style={{ flex: 1, minWidth: 220 }}>
          <DeltaPill value={deltaHours} t={t} />
        </KpiCard>
        <KpiCard icon={Euro} label={t.kpiValue} value={fmtEuro(open.totalEuros + (open.totalExpenses || 0))} style={{ flex: 1, minWidth: 220 }}>
          <DeltaPill value={deltaValue} t={t} />
        </KpiCard>
        <KpiCard icon={Users} label={t.kpiStaffInvolved} value={staffInvolved} style={{ flex: 1, minWidth: 220 }} />
      </div>

      <div style={isMobile ? { display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 } : { display: "flex", gap: 16, marginBottom: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1.6, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink2, marginBottom: 10 }}>{t.hoursByStaff}</div>
          <DataTable columns={staffColumns} rows={open.staffSummaries} getRowId={(s) => s.staffId} onRowClick={(s) => setOpenStaffId(s.staffId)} dense />
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <ReclamacoesCard
            current={open.reclamacoes}
            excelenteThreshold={excelenteThreshold}
            razoavelThreshold={razoavelThreshold}
            recent={groupSentItems(open.reclamacoesItems).slice(0, 2).map((i) => ({ client: clientById(clients, i.clientId)?.name || "—", date: fmtNoteDate(i.date) }))}
            title={dashT.complaintsTitle}
            subtitle={open.periodLabel}
            labels={{ excelente: dashT.gaugeExcelente, razoavel: dashT.gaugeRazoavel, critico: dashT.gaugeCritico }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink2, marginBottom: 10 }}>{t.occurrences}</div>
      <Card>
        <OccurrenceSection first icon={MessageSquare} title={`${t.complaintsCount} (${open.reclamacoes})`} items={groupSentItems(open.reclamacoesItems)} emptyLabel={t.noneThisPeriod} clients={clients} lang={lang} />
        <OccurrenceSection icon={ThumbsUp} title={`${t.praiseCount} (${open.elogios})`} items={groupSentItems(open.elogiosItems)} emptyLabel={t.noneMasc} clients={clients} lang={lang} />
        <OccurrenceSection icon={Bell} title={`${avisosT.sectionNotices} (${open.avisos})`} items={groupSentItems(open.avisosItems)} emptyLabel={t.noneMasc} clients={clients} lang={lang} />
        <OccurrenceSection
          icon={PackageX}
          title={`${t.solicitationsCount} (${open.solicitacoesResolvidas}/${open.solicitacoes} ${t.resolvedOf})`}
          items={open.solicitacoesItems} emptyLabel={t.noneThisPeriod} clients={clients} lang={lang}
          kindOf={(i) => missingItemSubjectLabel(i, lang)}
          statusOf={(i) => <Pill variant={i.resolved ? "paid" : "pending"}>{i.resolved ? c0.resolved : c0.pending}</Pill>}
        />
      </Card>

      <Drawer
        open={!!openStaff}
        onClose={() => setOpenStaffId(null)}
        avatar={openStaff && <Avatar name={openStaff.name} size={36} />}
        title={openStaff?.name}
        pill={openStaff && <Pill variant={openStaff.paid ? "paid" : "owed"}>{openStaff.paid ? c0.paid : c0.unpaid}</Pill>}
      >
        {openStaff && (() => {
          const sortedEntries = [...openStaff.entries].sort((a, b) => a.date.localeCompare(b.date));
          return (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{horasT.miniHoursLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtHoursScreen(openStaff.hours)}</div>
                </Card>
                <Card style={{ flex: 1, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{horasT.miniReceiveLabel}</div>
                  <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>{fmtEuro(openStaff.euros)}</div>
                </Card>
              </div>
              {sortedEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noEntries}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {sortedEntries.map((e, i) => {
                    const c = clientById(clients, e.clientId);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.lineSoft}`, fontSize: 13 }}>
                        <span>{fmtNoteDate(e.date)} · {entryClientName(clients, e)}</span>
                        <span style={{ fontWeight: 600 }}>{fmtHoursScreen(e.hours)}{e.extra ? " *" : ""}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </Drawer>
      {deleteDialog}
    </div>
  );
}

export default HistoricoScreen;
