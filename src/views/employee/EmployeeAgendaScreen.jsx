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
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, WEEKDAY_FULL_PT, DAY_ABBR_SUN0_PT,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  startOfISOWeek, addDays, isoDateStr, weekDiff, clientAppliesThisWeek, weekLabelPT,
  getAssignedClientIds, recomputeSharedHours, getCutoffPeriod, formatPeriodLabel,
  getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk,
  buildWeekChunkSequence, weekChunksOfPayPeriod, calPeriodDays, calPeriodLabel,
} from "../../models/utils.js";
import { T, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { ChevronLeftMini, ChevronRightMini, Minus2 } from "../shared/Icons.jsx";

function EmployeeAgendaScreen({ lang, setLang, onHome, staffId, clients, assignments }) {
  const t = T[lang].employeeAgenda;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(TODAY));
  const [expandedDay, setExpandedDay] = useState(TODAY.getDay() === 0 ? 7 : TODAY.getDay());

  function getDayOccurrences(day) {
    const clientIds = assignments[`${staffId}-${day}`] || [];
    return clientIds
      .map((id) => clientById(clients, id))
      .filter((c) => c && clientAppliesThisWeek(c, weekStart));
  }
  function getDayTotalMinutes(day) { return getDayOccurrences(day).reduce((s, c) => s + c.duration, 0); }
  function goWeek(delta) { setWeekStart((w) => addDays(w, delta * 7)); }

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <h1 style={mobStyles.title}>{t.title}</h1>
      <div style={mobStyles.weekNav}>
        <button style={mobStyles.periodNav} onClick={() => goWeek(-1)}><ChevronLeftMini /></button>
        <span style={mobStyles.weekLabel}>{weekLabelPT(weekStart, lang)}</span>
        <button style={mobStyles.periodNav} onClick={() => goWeek(1)}><ChevronRightMini /></button>
      </div>
      <div style={mobStyles.dayList}>
        {AGENDA_DAYS.map((day) => {
          const occ = getDayOccurrences(day);
          const totalMin = getDayTotalMinutes(day);
          const isExpanded = expandedDay === day;
          const isToday = isoDateStr(weekStart) === isoDateStr(startOfISOWeek(TODAY)) && day === (TODAY.getDay() === 0 ? 7 : TODAY.getDay());
          return (
            <div key={day} style={mobStyles.dayCard}>
              <button style={{ ...mobStyles.agendaDayHeader, borderBottom: isExpanded ? `1px solid ${COLORS.border}` : "none" }} onClick={() => setExpandedDay(isExpanded ? null : day)}>
                <span style={mobStyles.dayHeaderLeft}>
                  <span style={mobStyles.dayAbbrBold}>{dayLabels[day]}</span>
                  {isToday && <span style={mobStyles.todayDot} />}
                </span>
                <span style={mobStyles.dayTotalPill}>{fmtMinutes(totalMin)}</span>
              </button>
              {isExpanded && (
                <div style={mobStyles.agendaDayBody}>
                  {occ.length === 0 ? (
                    <div style={mobStyles.emptyDay}>{t.noClients}</div>
                  ) : (
                    <div style={mobStyles.chipList}>
                      {occ.map((c) => (
                        <div key={c.id} style={mobStyles.chip}>
                          <div style={{ width: "100%" }}>
                            <div style={mobStyles.chipTopRow}>
                              <div style={{ minWidth: 0 }}>
                                <div style={mobStyles.chipName}>{c.name}</div>
                                <div style={mobStyles.chipMeta}>
                                  {fmtMinutes(c.duration)}
                                  {c.frequency !== "weekly" && <> · {c.frequency === "weekly" ? t.freqWeekly : c.frequency === "biweekly" ? t.freqBiweekly : t.freqMonthly}</>}
                                  {c.availability && <> · {c.availability}</>}
                                </div>
                              </div>
                            </div>
                            {c.description && <div style={mobStyles.descRowStatic}><span style={mobStyles.descText}>{c.description}</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EmployeeAgendaScreen;
