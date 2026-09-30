import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, MENU_ITEMS,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, compactEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours, recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner,
} from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { KpiCard, PendingRow, ComplaintsGauge, BarChart, LineChart } from "../shared/DashboardWidgets.jsx";
import { NotesWidget, NotesTeaser } from "../shared/NotesWidget.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

function DashboardScreen({ lang, setLang, company, clients, staff, horasData, missingItems, sentItems, contractAlertDays, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount, cutoffDay, closedPeriods, personalNotes, onNavigate }) {
  const t = T[lang].dashboard;
  const isMobile = useIsMobile();
  const activeStaff = staff.filter((s) => s.status === "ativo");
  const currentPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const isLastDayOfPeriod = isoDateStr(TODAY) === isoDateStr(currentPeriod.end);

  let overtimePending = 0, unfinishedMonth = 0, reopenedCount = 0;
  Object.entries(horasData).forEach(([staffId, data]) => {
    if (data.status !== "finalizado") unfinishedMonth += 1;
    if (data.reopened) reopenedCount += 1;
    data.entries.forEach((e) => { if (e.extra && !e.approved && !e.voided) overtimePending += 1; });
  });
  const unreadNotices = missingItems.filter((m) => !m.resolved).length;

  const contractsNearExpiry = clients.filter((c) => {
    const end = parseDMY(c.contractEnd);
    const diffDays = (end - TODAY) / (24 * 60 * 60 * 1000);
    return diffDays >= 0 && diffDays <= contractAlertDays;
  }).length;

  const replacementClientsActive = clients.filter((c) => {
    if (c.clientType !== "replacement") return false;
    if (!c.clientValidUntil) return true;
    return new Date(c.clientValidUntil) >= TODAY;
  }).length;

  const recentPeriods = recentClosedPeriodsChronological(closedPeriods, 6);
  const HISTORY_LABELS = recentPeriods.map((p) => shortMonthFromIso(p.periodEnd, lang));
  const HISTORY_TOOLTIPS = recentPeriods.map((p) => p.periodLabel);
  const VALUE_HISTORY = recentPeriods.map((p) => p.totalEuros);
  const HOURS_HISTORY = recentPeriods.map((p) => p.totalHours);
  const hasHistory = recentPeriods.length > 0;
  const complaintsCurrent = sentItems.filter((i) => i.type === "reclamacao").length;
  // Limites escalam com o tamanho da carteira de clientes (configurado em
  // Definições como "reclamações a cada N clientes"), em vez de um valor fixo.
  const excelenteThreshold = Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));
  const gaugeT = { excelente: t.gaugeExcelente, razoavel: t.gaugeRazoavel, critico: t.gaugeCritico };

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />

      <div style={isMobile ? { ...styles.kpiRow, flexDirection: "column" } : styles.kpiRow}>
        <KpiCard label={t.kpiStaffActive} value={activeStaff.length} icon={Users} tint={COLORS.primaryTint} iconColor={COLORS.primary} />
        <KpiCard label={t.kpiClients} value={clients.length} icon={Building2} tint={COLORS.successTint} iconColor={COLORS.success} />
        <KpiCard label={t.kpiReplacementClients} value={replacementClientsActive} icon={RotateCcw} tint={COLORS.extraTint} iconColor={COLORS.extra} />
        <NotesTeaser notes={notesForOwner(personalNotes, "management")} todayIso={isoDateStr(TODAY)} lang={lang} onSeeAll={() => onNavigate("notas")} />
      </div>

      <div style={isMobile ? { ...styles.midRow, flexDirection: "column" } : styles.midRow}>
        <div style={styles.dashPendingCard}>
          <div style={styles.sectionTitle}>{t.pendingTitle}</div>
          <PendingRow label={t.pendingOvertime} count={overtimePending} onClick={() => onNavigate("horas")} />
          {isLastDayOfPeriod && (
            <PendingRow label={t.pendingUnfinishedMonth} count={unfinishedMonth} onClick={() => onNavigate("horas")} />
          )}
          <PendingRow label={t.pendingReopened} count={reopenedCount} onClick={() => onNavigate("horas")} />
          <PendingRow label={t.pendingUnread} count={unreadNotices} onClick={() => onNavigate("avisos")} />
          <PendingRow label={t.pendingContracts} count={contractsNearExpiry} onClick={() => onNavigate("clientes")} last />
        </div>
        <div style={styles.gaugeCard}>
          <div style={styles.sectionTitle}>{t.complaintsTitle}</div>
          <ComplaintsGauge current={complaintsCurrent} excelenteThreshold={excelenteThreshold} razoavelThreshold={razoavelThreshold} t={gaugeT} complaintsThisMonthLabel={t.complaintsThisMonth} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <NotesWidget notes={notesForOwner(personalNotes, "management")} todayIso={isoDateStr(TODAY)} lang={lang} onSeeAll={() => onNavigate("notas")} limit={5} />
      </div>

      <div style={isMobile ? { ...styles.historyRow, flexDirection: "column" } : styles.historyRow}>
        <div style={styles.historyCard}>
          <div style={styles.chartTitle}>{t.historyValueTitle}</div>
          {hasHistory ? (
            <BarChart data={VALUE_HISTORY} labels={HISTORY_LABELS} tooltipLabels={HISTORY_TOOLTIPS} valueFormatter={(v) => compactEuro(v)} tooltipValueFormatter={(v) => fmtEuro(v)} />
          ) : (
            <div style={styles.noResults}>{t.historyEmpty}</div>
          )}
        </div>
        <div style={styles.historyCard}>
          <div style={styles.chartTitle}>{t.historyHoursTitle}</div>
          {hasHistory ? (
            <LineChart data={HOURS_HISTORY} labels={HISTORY_LABELS} tooltipLabels={HISTORY_TOOLTIPS} valueFormatter={(v) => fmtHoursNum(v)} />
          ) : (
            <div style={styles.noResults}>{t.historyEmpty}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardScreen;
