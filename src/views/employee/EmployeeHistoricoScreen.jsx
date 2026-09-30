import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  startOfISOWeek, addDays, isoDateStr, weekDiff, clientAppliesThisWeek, weekLabelPT,
  getAssignedClientIds, recomputeSharedHours, getCutoffPeriod, formatPeriodLabel,
  getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk,
  buildWeekChunkSequence, weekChunksOfPayPeriod, calPeriodDays, calPeriodLabel,
} from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { exportStaffHorasPdf } from "../../models/pdfExport.js";

function EmployeeHistoricoScreen({ lang, setLang, onHome, staffId, company, clients, closedPeriods }) {
  const t = T[lang].employeeHistorico;
  const pdfT = T[lang].pdf;
  const [openId, setOpenId] = useState(null);
  const mine = closedPeriods.filter((p) => p.staffSummaries.some((s) => s.staffId === staffId));
  const open = mine.find((p) => p.id === openId);
  const myLine = (p) => p.staffSummaries.find((s) => s.staffId === staffId);

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <h1 style={mobStyles.title}>{t.title}</h1>

      {mine.length === 0 ? (
        <div style={mobStyles.emptyState}>{t.noneYet}</div>
      ) : (
        <div style={mobStyles.dayList}>
          {mine.map((p) => {
            const line = myLine(p);
            return (
              <button key={p.id} style={mobStyles.dayCard} onClick={() => setOpenId(p.id)}>
                <div style={mobStyles.agendaDayHeader}>
                  <span style={mobStyles.dayHeaderLeft}>
                    <span style={mobStyles.dayAbbrBold}>{p.periodLabel}</span>
                  </span>
                  <span style={mobStyles.dayTotalPill}>{fmtHoursNum(line ? line.hours : 0)}h</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && (() => {
        const line = myLine(open);
        return (
          <div style={mobStyles.modalOverlay} onClick={() => setOpenId(null)}>
            <div style={{ ...mobStyles.modalCard, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
              <div style={mobStyles.modalTitle}>{open.periodLabel}</div>
              <div style={{ ...mobStyles.modalQuestion, marginBottom: 4 }}>{t.closedAt} {open.closedAt}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 12 }}>
                <div style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSoft }}>{t.total}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{fmtHoursNum(line ? line.hours : 0)}h</div>
                </div>
                <div style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSoft }}>{t.receivedValue}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.primaryDark }}>{fmtEuro(line ? line.euros : 0)}</div>
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
                {line && line.entries.map((e, i) => {
                  const c = clientById(clients, e.clientId);
                  const [, m, d] = e.date.split("-");
                  return (
                    <div key={i} style={{ ...mobStyles.selectedRow, alignItems: "center" }}>
                      <div style={{ minWidth: 34, fontSize: 12, color: COLORS.textSoft, fontVariantNumeric: "tabular-nums" }}>{d}/{m}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={mobStyles.selectedName}>{c ? c.name : "—"}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtMinutes(Math.round(e.hours * 60))}</div>
                    </div>
                  );
                })}
              </div>
              <div style={mobStyles.modalActions}>
                <button
                  style={mobStyles.modalCancel}
                  onClick={() => exportStaffHorasPdf({
                    companyName: company?.name,
                    staffName: line ? line.name : "",
                    periodLabel: open.periodLabel,
                    entries: line ? line.entries : [],
                    clients,
                    totalHours: line ? line.hours : 0,
                    totalValue: line ? line.euros : 0,
                    lang,
                    pdfT,
                  })}
                >
                  {t.exportPdf}
                </button>
                <button style={mobStyles.modalConfirm} onClick={() => setOpenId(null)}>{t.close}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default EmployeeHistoricoScreen;
