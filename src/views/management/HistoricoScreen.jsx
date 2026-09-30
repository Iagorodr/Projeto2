import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
  ArrowLeft, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, MENU_ITEMS,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours,
} from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { exportGenericTablePdf } from "../../models/pdfExport.js";
import { KpiCard, ComplaintsGauge } from "../shared/DashboardWidgets.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

// Pequeno selo de variação vs. o período anterior — dá ao "dashboard do mês"
// uma leitura de tendência, não só um número solto.
function DeltaBadge({ value, t }) {
  if (value === null) {
    return <div style={{ ...styles.histKpiDelta, ...styles.histKpiDeltaFlat }}>{t.noPrevious}</div>;
  }
  const rounded = Math.round(value);
  if (Math.abs(rounded) < 1) {
    return (
      <div style={{ ...styles.histKpiDelta, ...styles.histKpiDeltaFlat }}>
        <Minus size={11} /> 0% {t.vsPrevious}
      </div>
    );
  }
  const isUp = rounded > 0;
  return (
    <div style={{ ...styles.histKpiDelta, ...(isUp ? styles.histKpiDeltaUp : styles.histKpiDeltaDown) }}>
      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {isUp ? "+" : ""}{rounded}% {t.vsPrevious}
    </div>
  );
}

function OccurrenceCard({ title, count, items, emptyLabel }) {
  return (
    <div style={styles.defSettingsCard}>
      <div style={styles.sectionTitle}>{title} ({count})</div>
      {items.length === 0 ? (
        <div style={styles.avNoItems}>{emptyLabel}</div>
      ) : (
        <div style={styles.avItemsList}>
          {items.map((i) => (
            <div key={i.id} style={styles.avItemCard}>
              <div style={styles.avItemDate}>{i.date}</div>
              <div style={styles.avItemText}>{i.text}</div>
            </div>
          ))}
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
  const [openId, setOpenId] = useState(null);
  const [openStaffId, setOpenStaffId] = useState(null);
  const isMobile = useIsMobile();
  const openIndex = closedPeriods.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? closedPeriods[openIndex] : null;
  // closedPeriods vem do mais recente pro mais antigo, então o "anterior"
  // cronologicamente é o próximo índice da lista.
  const previous = openIndex >= 0 ? closedPeriods[openIndex + 1] : null;
  function closeDrilldown() { setOpenId(null); setOpenStaffId(null); }

  function exportAuditPdf() {
    const rows = open.staffSummaries.map((s) => [s.name, `${fmtHoursNum(s.hours)}h`, fmtEuro(s.euros), s.paid ? c0.paid : c0.unpaid]);
    exportGenericTablePdf({
      companyName: company?.name,
      reportTitle: t.title,
      subtitle: `${open.periodLabel} · ${t.closedAt} ${open.closedAt}`,
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

  // Lista de períodos fechados (tela inicial do Histórico)
  if (!open) {
    return (
      <div style={styles.content}>
        <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />
        <h1 style={styles.title}>{t.title}</h1>
        <div style={{ ...styles.defSettingHint, marginBottom: 14, maxWidth: 640 }}>
          {t.subtitle}
        </div>

        {closedPeriods.length === 0 ? (
          <div style={styles.noResults}>{t.noResults}</div>
        ) : (
          <div style={isMobile ? { ...styles.tableWrap, overflowX: "auto" } : styles.tableWrap}>
            <div style={styles.tableHeaderRow}>
              <div style={{ ...styles.th, flex: 1.6 }}>{t.colPeriod}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colHours}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colValue}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colComplaints}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colPraise}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colNotices}</div>
              <div style={{ ...styles.th, flex: 1.3 }}>{t.colSolicitations}</div>
            </div>
            {closedPeriods.map((p) => (
              <button key={p.id} style={styles.tableRow} onClick={() => setOpenId(p.id)}>
                <div style={{ ...styles.td, flex: 1.6, fontWeight: 600 }}>{p.periodLabel}</div>
                <div style={{ ...styles.td, flex: 1 }}>{fmtHoursNum(p.totalHours)}h</div>
                <div style={{ ...styles.td, flex: 1 }}>{fmtEuro(p.totalEuros)}</div>
                <div style={{ ...styles.td, flex: 1 }}>{p.reclamacoes}</div>
                <div style={{ ...styles.td, flex: 1 }}>{p.elogios}</div>
                <div style={{ ...styles.td, flex: 1 }}>{p.avisos}</div>
                <div style={{ ...styles.td, flex: 1.3 }}>{p.solicitacoesResolvidas}/{p.solicitacoes}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Dashboard do mês selecionado — abrir um período mostra tudo daquele mês
  // aqui mesmo (nada de modal): KPIs, medidor de reclamações, horas por
  // funcionário e as ocorrências, tudo numa vista só.
  const staffInvolved = open.staffSummaries.filter((s) => s.hours > 0).length;
  const deltaHours = previous && previous.totalHours > 0 ? ((open.totalHours - previous.totalHours) / previous.totalHours) * 100 : null;
  const deltaValue = previous && previous.totalEuros > 0 ? ((open.totalEuros - previous.totalEuros) / previous.totalEuros) * 100 : null;

  const historicalClientCount = open.clientCount ?? clients.length;
  const excelenteThreshold = Math.max(0, Math.round((historicalClientCount / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((historicalClientCount / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));
  const gaugeT = { excelente: dashT.gaugeExcelente, razoavel: dashT.gaugeRazoavel, critico: dashT.gaugeCritico };

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />

      <div style={styles.histBackRow}>
        <button style={styles.histBackButton} onClick={closeDrilldown}><ArrowLeft size={14} /> {t.backToList}</button>
      </div>

      <div style={styles.histPeriodHeaderRow}>
        <div>
          <h1 style={{ ...styles.title, margin: "4px 0 4px" }}>{open.periodLabel}</h1>
          <div style={styles.defSettingHint}>{t.closedAt} {open.closedAt}</div>
        </div>
        <button style={styles.cancelButton} onClick={exportAuditPdf}>{T[lang].employeeHistorico.exportPdf}</button>
      </div>

      <div style={{ ...styles.sectionTitle, marginTop: 4 }}>{t.summary}</div>
      <div style={isMobile ? { ...styles.kpiRow, flexDirection: "column" } : styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>{t.kpiHours}</div>
          <div style={styles.kpiValue}>{fmtHoursNum(open.totalHours)}h</div>
          <DeltaBadge value={deltaHours} t={t} />
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>{t.kpiValue}</div>
          <div style={styles.kpiValue}>{fmtEuro(open.totalEuros)}</div>
          <DeltaBadge value={deltaValue} t={t} />
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>{t.kpiStaffInvolved}</div>
          <div style={styles.kpiValue}>{staffInvolved}</div>
        </div>
      </div>

      <div style={isMobile ? { ...styles.midRow, flexDirection: "column" } : styles.midRow}>
        <div style={{ ...styles.dashPendingCard, flex: 1.6 }}>
          <div style={styles.sectionTitle}>{t.hoursByStaff}</div>
          <div style={isMobile ? { ...styles.tableWrap, overflowX: "auto" } : styles.tableWrap}>
            <div style={styles.tableHeaderRow}>
              <div style={{ ...styles.th, flex: 2 }}>{T[lang].funcionarios.colName}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colHours}</div>
              <div style={{ ...styles.th, flex: 1 }}>{t.colValue}</div>
              <div style={{ ...styles.th, flex: 1 }}>{c0.paid}</div>
            </div>
            {open.staffSummaries.map((s) => {
              const isStaffOpen = openStaffId === s.staffId;
              return (
                <div key={s.staffId}>
                  <button style={styles.tableRow} onClick={() => setOpenStaffId(isStaffOpen ? null : s.staffId)}>
                    <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ ...styles.td, flex: 1 }}>{fmtHoursNum(s.hours)}h</div>
                    <div style={{ ...styles.td, flex: 1 }}>{fmtEuro(s.euros)}</div>
                    <div style={{ ...styles.td, flex: 1 }}>
                      <span style={{ ...styles.statusBadge, ...(s.paid ? styles.statusActive : styles.statusInactive) }}>{s.paid ? c0.paid : c0.unpaid}</span>
                    </div>
                  </button>
                  {isStaffOpen && (
                    <div style={{ padding: "6px 16px 12px", background: COLORS.bg }}>
                      {s.entries.length === 0 ? (
                        <div style={styles.avNoItems}>{t.noEntries}</div>
                      ) : (
                        s.entries.map((e, i) => {
                          const c = clientById(clients, e.clientId);
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12.5, borderBottom: `1px solid ${COLORS.border}` }}>
                              <span>{e.date} · {c ? c.name : "—"}</span>
                              <span>{fmtHoursNum(e.hours)}h{e.extra && "*"}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div style={styles.gaugeCard}>
          <div style={styles.sectionTitle}>{dashT.complaintsTitle}</div>
          <ComplaintsGauge current={open.reclamacoes} excelenteThreshold={excelenteThreshold} razoavelThreshold={razoavelThreshold} t={gaugeT} complaintsThisMonthLabel={dashT.complaintsThisMonth} />
        </div>
      </div>

      <div style={{ ...styles.sectionTitle, marginTop: 4 }}>{t.occurrences}</div>
      <div style={isMobile ? { ...styles.viewGrid, gridTemplateColumns: "1fr" } : styles.viewGrid}>
        <OccurrenceCard title={t.complaintsCount} count={open.reclamacoes} items={open.reclamacoesItems} emptyLabel={t.noneThisPeriod} />
        <OccurrenceCard title={t.praiseCount} count={open.elogios} items={open.elogiosItems} emptyLabel={t.noneMasc} />
        <OccurrenceCard title={T[lang].avisos.sectionNotices} count={open.avisos} items={open.avisosItems} emptyLabel={t.noneMasc} />
        <div style={styles.defSettingsCard}>
          <div style={styles.sectionTitle}>{t.solicitationsCount} ({open.solicitacoesResolvidas}/{open.solicitacoes} {t.resolvedOf})</div>
          {open.solicitacoesItems.length === 0 ? <div style={styles.avNoItems}>{t.noneThisPeriod}</div> : (
            <div style={styles.avItemsList}>
              {open.solicitacoesItems.map((i) => (
                <div key={i.id} style={styles.avItemCard}>
                  <div style={styles.avItemTopRow}>
                    <div style={styles.avItemDate}>{i.date} · {i.kind === "correcao" ? T[lang].avisos.correctionOfHours : t.missingProduct}</div>
                    <span style={{ ...styles.statusBadge, ...(i.resolved ? styles.statusActive : styles.statusInactive) }}>{i.resolved ? c0.resolved : c0.pending}</span>
                  </div>
                  <div style={styles.avItemText}>{i.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoricoScreen;
