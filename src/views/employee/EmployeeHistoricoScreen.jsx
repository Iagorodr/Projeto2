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
import { EMP_T } from "../../models/translations.js";
import { LangSwitcher } from "../shared/Layout.jsx";

function EmployeeHistoricoScreen({ lang, setLang, onHome, staffId, closedPeriods }) {
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
      <h1 style={mobStyles.title}>HISTÓRICO</h1>

      {mine.length === 0 ? (
        <div style={mobStyles.emptyState}>Nenhum mês fechado ainda.</div>
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
              <div style={{ ...mobStyles.modalQuestion, marginBottom: 4 }}>Fechado em {open.closedAt}</div>
              <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
                {line && line.entries.map((e, i) => (
                  <div key={i} style={mobStyles.selectedRow}>
                    <div style={mobStyles.selectedName}>{e.date}</div>
                    <div style={mobStyles.selectedDuration}>{fmtMinutes(Math.round(e.hours * 60))}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...mobStyles.selectedHeader, display: "flex", justifyContent: "space-between" }}>
                <span>Total</span>
                <strong>{fmtHoursNum(line ? line.hours : 0)}h · {fmtEuro(line ? line.euros : 0)}</strong>
              </div>
              <div style={mobStyles.modalActions}>
                <button style={mobStyles.modalCancel} onClick={() => window.print()}>Exportar PDF</button>
                <button style={mobStyles.modalConfirm} onClick={() => setOpenId(null)}>Fechar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default EmployeeHistoricoScreen;
