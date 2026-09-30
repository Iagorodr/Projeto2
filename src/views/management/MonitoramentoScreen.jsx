import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
  AlertTriangle, Minus, Eye,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { mobStyles } from "../../styles/mobStyles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY } from "../../models/data.js";
import {
  getOpenPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, formatPeriodLabel, isoDateStr, pad2,
  clientById, fmtHoursNum, fmtEuro, staffTotalHours, staffTotalPay, clientAppliesThisWeek, startOfISOWeek, dayIsCovered,
} from "../../models/utils.js";
import { formatTodayLabel, T, DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Sidebar } from "../shared/Layout.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

function MonitoramentoScreen({ lang, setLang, staff, clients, horasData, assignments, cutoffDay, closedPeriods, onHome }) {
  const t = T[lang].monitoramento;
  const th = T[lang].horas;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const [search, setSearch] = useState("");
  const [openStaffId, setOpenStaffId] = useState(null);
  const isMobile = useIsMobile();

  const payPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const periodLabel = formatPeriodLabel(payPeriod, lang);
  const blocks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);

  function isoWeekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }

  function hasAgendaOnDay(staffId, d) {
    const clientIds = assignments[`${staffId}-${isoWeekday(d)}`] || [];
    const weekStart = startOfISOWeek(d);
    return clientIds.some((id) => {
      const c = clientById(clients, id);
      return c && clientAppliesThisWeek(c, weekStart);
    });
  }

  // Calculado à parte (não só dentro do .map de `monitored`) porque também é
  // usado para o funcionário aberto no modal, que pode não estar mais na
  // lista filtrada se a pesquisa mudar enquanto o modal está aberto.
  function weeksInfoFor(s) {
    const h = horasData[s.id] || { entries: [], lockedWeeks: {}, noClientDays: [] };
    const migratedLocked = migrateLockedWeeksToBlocks(h.lockedWeeks, payPeriod, cutoffDay);
    return blocks.map((chunk) => {
      const chunkKey = isoDateStr(chunk.start);
      const locked = !!migratedLocked[chunkKey];
      const notStarted = chunk.start > TODAY;
      const days = calPeriodDays(chunk);
      const dayStatuses = days.map((d) => {
        const dKey = isoDateStr(d);
        if (dayIsCovered(h, dKey)) return "filled";
        if (!hasAgendaOnDay(s.id, d)) return "no-agenda";
        if (d > TODAY) return "future";
        return "missed";
      });
      const gaps = locked || notStarted ? 0 : dayStatuses.filter((st) => st === "missed").length;
      return { chunk, locked, notStarted, days, dayStatuses, gaps };
    });
  }

  const monitored = staff
    .filter((s) => s.status === "ativo" && s.accountType === "fixo")
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .map((s) => {
      const weeksInfo = weeksInfoFor(s);
      const totalGaps = weeksInfo.reduce((sum, w) => sum + w.gaps, 0);
      return { staffMember: s, weeksInfo, totalGaps };
    })
    .sort((a, b) => b.totalGaps - a.totalGaps || a.staffMember.name.localeCompare(b.staffMember.name));

  const totalWithGaps = monitored.filter((m) => m.totalGaps > 0).length;

  const openStaff = staff.find((s) => s.id === openStaffId);
  const openWeeksInfo = openStaff ? weeksInfoFor(openStaff) : [];
  const openHoras = openStaffId ? (horasData[openStaffId] || { entries: [] }) : null;
  const openEntries = openHoras
    ? openHoras.entries.filter((e) => !e.voided && e.date >= isoDateStr(payPeriod.start) && e.date <= isoDateStr(payPeriod.end))
    : [];

  return (
    <div style={onHome ? { ...mobStyles.phone, maxWidth: 460 } : styles.content}>
      {onHome ? (
        <div style={mobStyles.header}>
          <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
            <HouseIcon size={18} color={COLORS.textSoft} />
          </button>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
      ) : (
        <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />
      )}
      <h1 style={styles.title}>{t.title}</h1>
      <div style={{ ...styles.defSettingHint, marginBottom: 4, maxWidth: 680 }}>
        {t.periodLabelPrefix}: {periodLabel}
      </div>
      <div style={{ ...styles.defSettingHint, marginBottom: 14, maxWidth: 680 }}>
        {t.clickToSeeDetail}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={isMobile ? { ...styles.searchWrap, width: "100%" } : styles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={styles.searchInput} />
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10,
            background: totalWithGaps > 0 ? COLORS.extraTint : COLORS.successTint,
            color: totalWithGaps > 0 ? COLORS.extra : COLORS.success,
            fontSize: 13, fontWeight: 700,
          }}
        >
          {totalWithGaps > 0 ? <AlertTriangle size={15} /> : <Check size={15} />}
          {totalWithGaps > 0 ? t.summaryGaps(totalWithGaps) : t.summaryAllOk}
        </div>
      </div>

      {monitored.length === 0 ? (
        <div style={styles.noResults}>{t.noResults}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {monitored.map(({ staffMember: s, totalGaps }) => {
            return (
              <button
                key={s.id}
                onClick={() => setOpenStaffId(s.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px",
                  borderRadius: 12, border: `1px solid ${totalGaps > 0 ? COLORS.extra : COLORS.border}`,
                  background: COLORS.surface, cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </div>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, flexShrink: 0,
                    background: totalGaps > 0 ? COLORS.extraTint : COLORS.successTint,
                    color: totalGaps > 0 ? COLORS.extra : COLORS.success,
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  {totalGaps > 0 ? <AlertTriangle size={13} /> : <Check size={13} />}
                  {totalGaps > 0 ? t.staffDaysMissing(totalGaps) : t.staffAllUpToDate}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ ...styles.defSettingHint, marginTop: 12 }}>{t.inactiveNote}</div>

      {openStaff && (
        <div style={styles.modalOverlay} onClick={() => setOpenStaffId(null)}>
          <div style={{ ...styles.modalCard, maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{t.staffReportTitle(openStaff.name)}</div>
                <div style={styles.modalSubtitle}>{periodLabel}</div>
              </div>
              <button style={styles.modalClose} onClick={() => setOpenStaffId(null)}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {openWeeksInfo.map((w, wi) => (
                <div
                  key={wi}
                  style={{
                    border: `1px solid ${!w.locked && w.gaps > 0 ? COLORS.extra : COLORS.border}`,
                    borderRadius: 10, padding: "10px 12px",
                    background: !w.locked && w.gaps > 0 ? COLORS.extraTint : COLORS.bg,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{calPeriodLabel(w.chunk, lang)}</div>
                    {w.locked ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.success, fontWeight: 700, fontSize: 11.5 }}>
                        <Check size={13} />{t.weekFinalizedShort}
                      </span>
                    ) : w.notStarted ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.textSoft, fontWeight: 700, fontSize: 11.5 }}>
                        –
                      </span>
                    ) : w.gaps > 0 ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.extra, fontWeight: 700, fontSize: 11.5 }}>
                        <AlertTriangle size={13} />{t.staffDaysMissing(w.gaps)}
                      </span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.success, fontWeight: 700, fontSize: 11.5 }}>
                        <Check size={13} />{t.weekUpToDate}
                      </span>
                    )}
                  </div>
                  {!w.locked && w.gaps > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {w.days.map((d, di) => (
                        w.dayStatuses[di] === "missed" && (
                          <span
                            key={di}
                            style={{
                              fontSize: 11, fontWeight: 700, color: COLORS.extra, background: COLORS.surface,
                              border: `1px solid ${COLORS.extra}`, borderRadius: 6, padding: "3px 8px",
                            }}
                          >
                            {dayAbbr[d.getDay()]} {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {openEntries.length === 0 ? (
              <div style={styles.noResults}>{t.noEntriesYet}</div>
            ) : (
              <div style={styles.horReportTable}>
                <div style={styles.horReportHeaderRow}>
                  <div style={{ ...styles.horRth, flex: 1 }}>{th.repDate}</div>
                  <div style={{ ...styles.horRth, flex: 2 }}>{th.repClient}</div>
                  <div style={{ ...styles.horRth, flex: 1 }}>{th.repHours}</div>
                </div>
                {openEntries.map((e, i) => {
                  const c = clientById(clients, e.clientId);
                  return (
                    <div key={i} style={styles.horReportRow}>
                      <div style={{ ...styles.horRtd, flex: 1 }}>{e.date}</div>
                      <div style={{ ...styles.horRtd, flex: 2 }}>{c ? c.name : "—"}</div>
                      <div style={{ ...styles.horRtd, flex: 1, color: e.extra ? COLORS.extra : COLORS.text, fontWeight: e.extra ? 700 : 400 }}>
                        {fmtHoursNum(e.hours)}{e.extra && "*"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitoramentoScreen;
