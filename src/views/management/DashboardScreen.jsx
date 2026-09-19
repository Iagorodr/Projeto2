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
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours,
} from "../../models/utils.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { KpiCard, PendingRow, ComplaintsGauge, BarChart, LineChart } from "../shared/DashboardWidgets.jsx";

function DashboardScreen({ lang, setLang, company, clients, staff, horasData, missingItems, sentItems, contractAlertDays, reclamacaoRatioClients, cutoffDay, onNavigate }) {
  const activeStaff = staff.filter((s) => s.status === "ativo");
  const currentPeriod = getCutoffPeriod(TODAY, cutoffDay, 0);
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

  const CLIENTS_HISTORY = [42, 45, 48, 50, 53, clients.length];
  const HOURS_HISTORY = [620, 650, 700, 680, 740, 780];
  const MONTH_LABELS = ["Abr", "Mai", "Jun", "Jul", "Ago", "Set"];
  const complaintsCurrent = sentItems.filter((i) => i.type === "reclamacao").length;
  const razoavelThreshold = Math.max(1, Math.round(clients.length / (reclamacaoRatioClients || 5)));
  const criticoThreshold = razoavelThreshold * 2;
  const gaugeT = { excelente: "Excelente", razoavel: "Razoável", critico: "Crítico" };

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />

      <div style={styles.kpiRow}>
        <KpiCard label="Funcionarios em atividade" value={activeStaff.length} />
        <KpiCard label="Clientes" value={clients.length} />
        <KpiCard label="Clientes Replacement" value={replacementClientsActive} />
      </div>

      <div style={styles.midRow}>
        <div style={styles.dashPendingCard}>
          <div style={styles.sectionTitle}>Pendencias</div>
          <PendingRow label="Horas extra aguardando aprovação" count={overtimePending} onClick={() => onNavigate("horas")} />
          {isLastDayOfPeriod && (
            <PendingRow label="Funcionários que não finalizaram o mês" count={unfinishedMonth} onClick={() => onNavigate("horas")} />
          )}
          <PendingRow label="Reabertos para correção" count={reopenedCount} onClick={() => onNavigate("horas")} />
          <PendingRow label="Avisos/Solicitações não lidas" count={unreadNotices} onClick={() => onNavigate("avisos")} />
          <PendingRow label="Contratos perto de vencer" count={contractsNearExpiry} onClick={() => onNavigate("clientes")} last />
        </div>
        <div style={styles.gaugeCard}>
          <div style={styles.sectionTitle}>Reclamações</div>
          <ComplaintsGauge current={complaintsCurrent} razoavelThreshold={razoavelThreshold} criticoThreshold={criticoThreshold} t={gaugeT} />
        </div>
      </div>

      <div style={styles.historyRow}>
        <div style={styles.historyCard}>
          <div style={styles.chartTitle}>Histórico 6 meses total de clientes</div>
          <BarChart data={CLIENTS_HISTORY} labels={MONTH_LABELS} />
        </div>
        <div style={styles.historyCard}>
          <div style={styles.chartTitle}>Histórico 6 meses total de horas</div>
          <LineChart data={HOURS_HISTORY} labels={MONTH_LABELS} />
        </div>
      </div>
    </div>
  );
}

export default DashboardScreen;
