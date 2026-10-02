import { useState } from "react";
import {
  ArrowLeft, Clock, Euro, Users, MessageSquare, ThumbsUp, Bell, PackageX, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { clientById, fmtEuro, fmtHoursNum, fmtHoursScreen, fmtNoteDate, pctChange } from "../../models/utils.js";
import { T, missingItemSubjectLabel } from "../../models/i18n.js";
import { exportGenericTablePdf } from "../../models/pdfExport.js";
import {
  PageHeader, DataTable, Drawer, Button, Pill, Card, KpiCard, ReclamacoesCard, Avatar,
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

function HistoricoScreen({ lang, setLang, company, clients, closedPeriods, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount }) {
  const t = T[lang].historico;
  const c0 = T[lang].common;
  const pdfT = T[lang].pdf;
  const dashT = T[lang].dashboard;
  const horasT = T[lang].horas;
  const avisosT = T[lang].avisos;
  const [openId, setOpenId] = useState(null);
  const [openStaffId, setOpenStaffId] = useState(null);
  const isMobile = useIsMobile();

  const openIndex = closedPeriods.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? closedPeriods[openIndex] : null;
  // closedPeriods vem do mais recente pro mais antigo, então o "anterior"
  // cronologicamente é o próximo índice da lista.
  const previous = openIndex >= 0 ? closedPeriods[openIndex + 1] : null;

  function exportAuditPdf() {
    // fmtHoursNum (não fmtHoursScreen) de propósito aqui: o próprio
    // comentário de utils.js é explícito — fmtHoursScreen é "pro ecrã",
    // fmtHoursNum é "só pra PDF/exportações" (o resto do app já segue essa
    // mesma regra, ex.: exportStaffHorasPdf).
    const rows = open.staffSummaries.map((s) => [s.name, `${fmtHoursNum(s.hours)}h`, fmtEuro(s.euros), s.paid ? c0.paid : c0.unpaid]);
    exportGenericTablePdf({
      companyName: company?.name,
      reportTitle: t.title,
      subtitle: `${open.periodLabel} · ${t.closedAt} ${fmtNoteDate(open.closedAt)}`,
      columns: [T[lang].funcionarios.colName, pdfT.colTotalHours, pdfT.colTotalPay, pdfT.colStatus],
      rows,
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      totals: [
        { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(open.totalHours)}h` },
        { label: pdfT.totalValueLabel, value: fmtEuro(open.totalEuros) },
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
  if (!open) {
    const maxHours = Math.max(1, ...closedPeriods.map((p) => p.totalHours));
    const listColumns = [
      { key: "period", label: t.colPeriod, width: 1.3, render: (p) => <span style={{ fontWeight: 600 }}>{p.periodLabel}</span> },
      {
        key: "hours", label: t.colHours, width: 1.5,
        render: (p) => {
          const prev = closedPeriods[closedPeriods.indexOf(p) + 1];
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
        key: "value", label: t.colValue, width: 1.3,
        render: (p) => {
          const prev = closedPeriods[closedPeriods.indexOf(p) + 1];
          const delta = pctChange(p.totalEuros, prev ? prev.totalEuros : null);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{fmtEuro(p.totalEuros)}</span>
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

    return (
      <div style={styles.content}>
        <PageHeader title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
        <DataTable columns={listColumns} rows={closedPeriods} onRowClick={(p) => setOpenId(p.id)} emptyMessage={t.noResults} />
      </div>
    );
  }

  // ---------- Detalhe (documento, 4.6: "página, com '‹ Histórico' no topo") ----------
  const staffInvolved = open.staffSummaries.filter((s) => s.hours > 0).length;
  const deltaHours = pctChange(open.totalHours, previous ? previous.totalHours : null);
  const deltaValue = pctChange(open.totalEuros, previous ? previous.totalEuros : null);

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
        </div>
        <Button variant="secondary" onClick={exportAuditPdf}>{horasT.exportPdfGeneral}</Button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <KpiCard icon={Clock} label={t.kpiHours} value={fmtHoursScreen(open.totalHours)} style={{ flex: 1, minWidth: 220 }}>
          <DeltaPill value={deltaHours} t={t} />
        </KpiCard>
        <KpiCard icon={Euro} label={t.kpiValue} value={fmtEuro(open.totalEuros)} style={{ flex: 1, minWidth: 220 }}>
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
            recent={open.reclamacoesItems.slice(0, 2).map((i) => ({ client: clientById(clients, i.clientId)?.name || "—", date: fmtNoteDate(i.date) }))}
            title={dashT.complaintsTitle}
            subtitle={open.periodLabel}
            labels={{ excelente: dashT.gaugeExcelente, razoavel: dashT.gaugeRazoavel, critico: dashT.gaugeCritico }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink2, marginBottom: 10 }}>{t.occurrences}</div>
      <Card>
        <OccurrenceSection first icon={MessageSquare} title={`${t.complaintsCount} (${open.reclamacoes})`} items={open.reclamacoesItems} emptyLabel={t.noneThisPeriod} clients={clients} lang={lang} />
        <OccurrenceSection icon={ThumbsUp} title={`${t.praiseCount} (${open.elogios})`} items={open.elogiosItems} emptyLabel={t.noneMasc} clients={clients} lang={lang} />
        <OccurrenceSection icon={Bell} title={`${avisosT.sectionNotices} (${open.avisos})`} items={open.avisosItems} emptyLabel={t.noneMasc} clients={clients} lang={lang} />
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
        width={560}
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
                        <span>{fmtNoteDate(e.date)} · {c ? c.name : "—"}</span>
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
    </div>
  );
}

export default HistoricoScreen;
