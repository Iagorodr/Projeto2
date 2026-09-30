import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
  AlertTriangle,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, WEEKDAY_FULL_PT, DAY_ABBR_SUN0_PT,
} from "../../models/data.js";
import {
  clientById, dayIsCovered, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  startOfISOWeek, addDays, isoDateStr, weekDiff, clientAppliesThisWeek, weekLabelPT,
  getAssignedClientIds, recomputeSharedHours, getCutoffPeriod, formatPeriodLabel,
  getWeekChunk, getWeekChunkFor, nextWeekChunk, prevWeekChunk,
  buildWeekChunkSequence, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel,
  getOpenPeriod,
} from "../../models/utils.js";
import { T, DAY_ABBR_SUN0_BY_LANG, WEEKDAY_FULL_BY_LANG } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { ChevronLeftMini, ChevronRightMini, Minus2 } from "../shared/Icons.jsx";

function EmployeeHorasScreen({ lang, setLang, onHome, staffId, clients, staff, assignments, horasData, setHorasData, cutoffDay, closedPeriods, setMissingItems }) {
  const t = T[lang].employeeHoras;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const weekdayFull = WEEKDAY_FULL_BY_LANG[lang];
  const myClients = clients.filter((c) => getAssignedClientIds(assignments, staffId).includes(c.id));

  const payPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const payPeriodChunks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);

  const [chunkIndex, setChunkIndex] = useState(null);
  const [chunks] = useState(() => {
    const todayBlockIndex = payPeriodChunks.findIndex((b) => TODAY >= b.start && TODAY <= b.end);
    const countBefore = todayBlockIndex >= 0 ? todayBlockIndex : (TODAY > payPeriod.end ? payPeriodChunks.length : 0);
    return buildWeekChunkSequence(TODAY, cutoffDay, countBefore, 8);
  });
  const anchorIndex = chunks.anchorIndex;
  const idx = chunkIndex === null ? anchorIndex : chunkIndex;
  const chunk = chunks.list[idx];
  const days = calPeriodDays(chunk);
  const isBoundary = days.length < 7;

  const [selectedDateKey, setSelectedDateKey] = useState(() => isoDateStr(TODAY));
  const [search, setSearch] = useState("");
  const [extraTarget, setExtraTarget] = useState(null);
  const [extraDraft, setExtraDraft] = useState(0);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missingConfirmOpen, setMissingConfirmOpen] = useState(false);
  const [missingDays, setMissingDays] = useState([]);
  const [reviewMode, setReviewMode] = useState(null);
  const [finalizeMonthConfirmOpen, setFinalizeMonthConfirmOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionSentToast, setCorrectionSentToast] = useState(false);

  const myHoras = horasData[staffId] || { status: "pendente", paid: false, entries: [], lockedWeeks: {} };
  const chunkKey = isoDateStr(chunk.start);
  const weekLockedRaw = !!(myHoras.lockedWeeks && myHoras.lockedWeeks[chunkKey]);
  const monthFinalized = myHoras.status === "finalizado";

  const chunkZone = chunk.end < payPeriod.start ? "before" : chunk.start > payPeriod.end ? "after" : "within";
  const weekLockedFlag =
    chunkZone === "before" ? true :
    chunkZone === "within" ? (weekLockedRaw || monthFinalized) :
    weekLockedRaw;

  const migratedLocked = migrateLockedWeeksToBlocks(myHoras.lockedWeeks, payPeriod, cutoffDay);
  const allWeeksFinalized = payPeriodChunks.every((c) => !!migratedLocked[isoDateStr(c.start)]);
  const finalizedCount = payPeriodChunks.filter((c) => !!migratedLocked[isoDateStr(c.start)]).length;
  const canFinalizeMonth = allWeeksFinalized && !monthFinalized;

  const selectedDate = days.find((d) => isoDateStr(d) === selectedDateKey) || days[0];
  const selectedKey = isoDateStr(selectedDate);
  const entriesForDay = myHoras.entries.filter((e) => e.date === selectedKey);

  const results = search.trim()
    ? myClients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) && !entriesForDay.some((e) => e.clientId === c.id))
    : [];

  function updateMyHoras(updater) {
    setHorasData((prev) => ({ ...prev, [staffId]: updater(prev[staffId] || { status: "pendente", paid: false, entries: [], lockedWeeks: {} }) }));
  }
  function addClient(clientId) {
    if (weekLockedFlag) return;
    const client = clientById(clients, clientId);
    setHorasData((prev) => {
      const current = prev[staffId] || { status: "pendente", paid: false, entries: [], lockedWeeks: {} };
      const withNew = {
        ...prev,
        [staffId]: { ...current, entries: [...current.entries, { date: selectedKey, clientId, hours: (client.duration || 60) / 60, extra: false, extraMinutes: 0, approved: false, voided: false }] },
      };
      return recomputeSharedHours(withNew, clients, selectedKey, clientId);
    });
    setSearch("");
  }
  function removeEntry(entryIdx) {
    if (weekLockedFlag) return;
    const entry = entriesForDay[entryIdx];
    setHorasData((prev) => {
      const current = prev[staffId];
      const withoutIt = { ...prev, [staffId]: { ...current, entries: current.entries.filter((e) => e !== entry) } };
      return recomputeSharedHours(withoutIt, clients, entry.date, entry.clientId);
    });
  }
  function openExtra(entryIdx) {
    if (weekLockedFlag) return;
    const entry = entriesForDay[entryIdx];
    setExtraDraft(entry.extraMinutes || 0);
    setExtraTarget(entry);
  }
  function saveExtra() {
    setHorasData((prev) => {
      const current = prev[staffId];
      const updated = {
        ...prev,
        [staffId]: {
          ...current,
          entries: current.entries.map((e) => {
            if (e !== extraTarget) return e;
            return { ...e, extra: extraDraft > 0, extraMinutes: extraDraft, approved: extraDraft > 0 ? false : e.approved };
          }),
        },
      };
      return recomputeSharedHours(updated, clients, extraTarget.date, extraTarget.clientId);
    });
    setExtraTarget(null);
  }
  function finalizeDay() { setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); }
  function finalizeWeek() {
    updateMyHoras((h) => ({ ...h, lockedWeeks: { ...(h.lockedWeeks || {}), [chunkKey]: true } }));
    setConfirmOpen(false); setMissingConfirmOpen(false);
  }
  function handleConfirmFirst() {
    const missing = days.filter((d) => !dayIsCovered(myHoras, isoDateStr(d)));
    if (missing.length > 0) { setConfirmOpen(false); setMissingDays(missing); setMissingConfirmOpen(true); }
    else finalizeWeek();
  }
  function finalizeMonth() {
    updateMyHoras((h) => ({ ...h, status: "finalizado", reopened: false }));
    setReviewMode(null);
    setFinalizeMonthConfirmOpen(false);
  }
  function dayTotalHours(dateKey) { return myHoras.entries.filter((e) => e.date === dateKey).reduce((s, e) => s + e.hours, 0); }
  function chunkTotalHours() { return days.reduce((s, d) => s + dayTotalHours(isoDateStr(d)), 0); }
  function fmtH(hours) { return fmtMinutes(Math.round(hours * 60)); }
  function goChunk(delta) {
    const next = idx + delta;
    if (next < 0 || next >= chunks.list.length) return;
    setChunkIndex(next);
    setSelectedDateKey(isoDateStr(calPeriodDays(chunks.list[next])[0]));
  }

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <div style={mobStyles.horasTop}>
        <div style={mobStyles.subtitle}>{t.subtitle}</div>
        <div style={mobStyles.periodRow}>
          <button style={mobStyles.periodNav} onClick={() => goChunk(-1)}><ChevronLeftMini /></button>
          <span style={mobStyles.weekLabel}>{calPeriodLabel(chunk, lang)}</span>
          <button style={mobStyles.periodNav} onClick={() => goChunk(1)}><ChevronRightMini /></button>
        </div>
        <div style={mobStyles.periodMetaRow}>
          {idx === anchorIndex && <span style={mobStyles.currentWeekBadge}>{t.currentWeekBadge}</span>}
          {isBoundary && <div style={mobStyles.boundaryBadge}>{t.boundaryBadge}</div>}
        </div>
      </div>

      <div style={mobStyles.dayGrid}>
        {days.map((date) => {
          const dateKey = isoDateStr(date);
          const total = dayTotalHours(dateKey);
          const filled = myHoras.entries.some((e) => e.date === dateKey);
          const needsAttention = !filled && date < TODAY;
          const isActive = dateKey === selectedKey;
          return (
            <button key={dateKey} onClick={() => setSelectedDateKey(dateKey)} style={{ ...mobStyles.dayChip, borderColor: isActive ? COLORS.primary : (needsAttention ? COLORS.extra : COLORS.border), borderWidth: isActive ? 2 : 1, background: filled ? COLORS.primaryTint : COLORS.surface }}>
              <span style={{ ...mobStyles.dayIcon, background: filled ? COLORS.success : (needsAttention ? COLORS.extra : COLORS.muted || COLORS.border) }}>
                {filled ? <Check size={11} color="#fff" /> : (needsAttention ? <AlertTriangle size={11} color="#fff" /> : <X size={11} color="#fff" />)}
              </span>
              <span style={mobStyles.dayAbbr}>{dayAbbr[date.getDay()]}</span>
              <span style={mobStyles.dayDate}>{pad2(date.getDate())}/{pad2(date.getMonth() + 1)}</span>
              <span style={mobStyles.dayHours}>{total > 0 ? fmtH(total) : "-"}</span>
            </button>
          );
        })}
      </div>

      <div style={mobStyles.panel}>
        <h2 style={mobStyles.panelTitle}>{t.which(weekdayFull[selectedDate.getDay()], `${pad2(selectedDate.getDate())}/${pad2(selectedDate.getMonth() + 1)}`)}</h2>
        <div style={mobStyles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input disabled={weekLockedFlag} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} style={mobStyles.searchInput} />
        </div>
        {results.length > 0 && (
          <div style={mobStyles.resultsBox}>
            {results.map((c) => (
              <button key={c.id} style={mobStyles.resultRow} onClick={() => addClient(c.id)}>
                <span>{c.name}</span>
                <span style={mobStyles.resultMeta}>
                  <span style={{ color: COLORS.textSoft, fontSize: 13 }}>{fmtMinutes(c.duration)}</span>
                  <Plus size={16} color={COLORS.primary} />
                </span>
              </button>
            ))}
          </div>
        )}
        <div style={mobStyles.selectedHeader}>{t.selected}</div>
        {entriesForDay.length === 0 ? (
          <div style={mobStyles.emptyState}>{t.empty}</div>
        ) : (
          <div style={mobStyles.selectedList}>
            {entriesForDay.map((e, i) => {
              const c = clientById(clients, e.clientId);
              return (
                <div key={i} style={mobStyles.selectedRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={mobStyles.selectedName}>{c ? c.name : "—"}</div>
                    <div style={mobStyles.selectedDuration}>
                      {fmtH(e.hours - (e.extraMinutes || 0) / 60)}
                      {e.extra && <span style={mobStyles.extraBadge}> + {e.extraMinutes}min {t.extraShort}*</span>}
                      {e.sharedCount > 1 && <span style={{ color: COLORS.textSoft }}> · {t.sharedWith(e.sharedCount - 1)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button disabled={weekLockedFlag} onClick={() => openExtra(i)} style={mobStyles.extraButton}><Clock size={15} /></button>
                    <button disabled={weekLockedFlag} onClick={() => removeEntry(i)} style={mobStyles.removeButton}><X size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button disabled={weekLockedFlag || entriesForDay.length === 0} onClick={finalizeDay} style={{ ...mobStyles.finalizeDayButton, opacity: weekLockedFlag || entriesForDay.length === 0 ? 0.5 : 1 }}>{t.finalizeDay}</button>
      </div>

      <div style={mobStyles.footer}>
        <div>
          <div style={mobStyles.footerLabel}>{t.weekTotal}</div>
          <div style={mobStyles.footerValue}>{fmtH(chunkTotalHours())}</div>
        </div>
        <button disabled={weekLockedFlag} onClick={() => setConfirmOpen(true)} style={{ ...mobStyles.finalizeWeekButton, opacity: weekLockedFlag ? 0.6 : 1 }}>
          {weekLockedFlag ? (<><Check size={14} style={{ marginRight: 6 }} />{t.weekDoneTag}</>) : t.finalizeWeek}
        </button>
      </div>

      <div style={mobStyles.footNote}>
        {monthFinalized ? t.monthDoneNote : t.weeksProgress(finalizedCount, payPeriodChunks.length)}
        {(canFinalizeMonth || monthFinalized) && (
          <button style={{ ...mobStyles.finalizeDayButton, marginTop: 8 }} onClick={() => setReviewMode("view")}>
            {t.viewDetails}
          </button>
        )}
        {canFinalizeMonth && (
          <button style={{ ...mobStyles.finalizeWeekButton, marginTop: 8, width: "100%", justifyContent: "center" }} onClick={() => setFinalizeMonthConfirmOpen(true)}>
            {t.finalizeMonth}
          </button>
        )}
      </div>

      {finalizeMonthConfirmOpen && (
        <div style={mobStyles.modalOverlay} onClick={() => setFinalizeMonthConfirmOpen(false)}>
          <div style={mobStyles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={mobStyles.modalTitle}>{t.finalizeMonthConfirmTitle}</div>
            <div style={mobStyles.modalQuestion}>{t.finalizeMonthConfirmBody}</div>
            <div style={mobStyles.modalActions}>
              <button style={mobStyles.modalCancel} onClick={() => setFinalizeMonthConfirmOpen(false)}>{t.confirmNo}</button>
              <button style={mobStyles.modalConfirmDanger} onClick={finalizeMonth}>{t.confirmYes}</button>
            </div>
          </div>
        </div>
      )}

      {savedToast && <div style={mobStyles.toast}>{t.daySaved}</div>}
      {correctionSentToast && <div style={mobStyles.toast}>{t.correctionSent}</div>}

      {extraTarget && (
        <div style={mobStyles.modalOverlay} onClick={() => setExtraTarget(null)}>
          <div style={mobStyles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={mobStyles.modalTitle}>{t.extraTitle}</div>
            <div style={mobStyles.modalQuestion}>{t.extraQuestion}</div>
            <div style={mobStyles.stepperRow}>
              <button style={mobStyles.stepperButton} onClick={() => setExtraDraft((v) => Math.max(0, v - 30))}><Minus2 /></button>
              <div style={mobStyles.stepperValue}>{extraDraft} {t.minutesUnit}</div>
              <button style={mobStyles.stepperButton} onClick={() => setExtraDraft((v) => v + 30)}><Plus size={18} /></button>
            </div>
            <div style={mobStyles.modalHint}>{t.extraHint}</div>
            <div style={mobStyles.modalActions}>
              <button style={mobStyles.modalCancel} onClick={() => setExtraTarget(null)}>{t.cancel}</button>
              <button style={mobStyles.modalConfirm} onClick={saveExtra}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div style={mobStyles.modalOverlay} onClick={() => setConfirmOpen(false)}>
          <div style={mobStyles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={mobStyles.modalTitle}>{t.confirmWeekTitle}</div>
            <div style={mobStyles.modalQuestion}>{t.confirmWeekBody}</div>
            <div style={mobStyles.modalActions}>
              <button style={mobStyles.modalCancel} onClick={() => setConfirmOpen(false)}>{t.confirmNo}</button>
              <button style={mobStyles.modalConfirmDanger} onClick={handleConfirmFirst}>{t.confirmYes}</button>
            </div>
          </div>
        </div>
      )}

      {missingConfirmOpen && (
        <div style={mobStyles.modalOverlay} onClick={() => setMissingConfirmOpen(false)}>
          <div style={mobStyles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={mobStyles.modalTitle}>{t.missingDaysTitle}</div>
            <div style={mobStyles.modalQuestion}>{t.missingDaysBody(missingDays.map((d) => weekdayFull[d.getDay()]).join(", "))}</div>
            <div style={mobStyles.modalActions}>
              <button style={mobStyles.modalCancel} onClick={() => setMissingConfirmOpen(false)}>{t.sureNo}</button>
              <button style={mobStyles.modalConfirmDanger} onClick={finalizeWeek}>{t.sureYes}</button>
            </div>
          </div>
        </div>
      )}

      {weekLockedFlag && !monthFinalized && (
        <div style={mobStyles.lockedBanner}>
          <div>
            <div style={mobStyles.lockedBannerTitle}>{t.weekDoneTag}</div>
            <div style={mobStyles.lockedBannerBody}>{t.lockedBody}</div>
          </div>
        </div>
      )}

      {reviewMode && (() => {
        const periodEntries = myHoras.entries.filter((e) => {
          const d = new Date(e.date.split("-")[0], e.date.split("-")[1] - 1, e.date.split("-")[2]);
          return d >= payPeriod.start && d <= payPeriod.end && !e.voided;
        });
        const totalHoursPeriod = periodEntries.reduce((s, e) => s + e.hours, 0);
        const totalValuePeriod = periodEntries.reduce((s, e) => {
          const c = clientById(clients, e.clientId);
          return s + e.hours * (c ? c.valueHour : 0);
        }, 0);
        const shortDate = (dateStr) => {
          const [, m, d] = dateStr.split("-");
          return `${d}/${m}`;
        };
        return (
        <div style={mobStyles.modalOverlay} onClick={() => setReviewMode(null)}>
          <div style={{ ...mobStyles.modalCard, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={mobStyles.modalTitle}>{t.reviewTitleView}</div>
            <div style={mobStyles.modalQuestion}>{calPeriodLabel(payPeriod, lang)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: COLORS.textSoft }}>{t.periodTotal}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{fmtH(totalHoursPeriod)}</div>
              </div>
              <div style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: COLORS.textSoft }}>{t.amountToReceiveNote}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.primaryDark }}>{fmtEuro(totalValuePeriod)}</div>
              </div>
            </div>
            <div style={{ ...mobStyles.selectedHeader, marginTop: 0 }}>{t.selected}</div>
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 12 }}>
              {periodEntries.map((e, i) => {
                const c = clientById(clients, e.clientId);
                return (
                  <div key={i} style={{ ...mobStyles.selectedRow, alignItems: "center" }}>
                    <div style={{ minWidth: 34, fontSize: 12, color: COLORS.textSoft, fontVariantNumeric: "tabular-nums" }}>{shortDate(e.date)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={mobStyles.selectedName}>{c ? c.name : "—"}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: e.extra ? COLORS.extra : COLORS.text, whiteSpace: "nowrap" }}>
                      {fmtH(e.hours)}{e.extra && "*"}
                    </div>
                  </div>
                );
              })}
            </div>
            {!correctionOpen ? (
              <div style={mobStyles.modalActions}>
                <button style={mobStyles.modalCancel} onClick={() => setCorrectionOpen(true)}>{t.requestCorrection}</button>
                <button style={mobStyles.modalConfirm} onClick={() => setReviewMode(null)}>{t.close}</button>
              </div>
            ) : (
              <div>
                <textarea
                  value={correctionText}
                  onChange={(ev) => setCorrectionText(ev.target.value)}
                  placeholder={t.correctionPlaceholder}
                  style={mobStyles.avisosTextarea}
                  rows={3}
                />
                <div style={{ ...mobStyles.modalActions, marginTop: 8 }}>
                  <button style={mobStyles.modalCancel} onClick={() => { setCorrectionOpen(false); setCorrectionText(""); }}>{t.cancel}</button>
                  <button
                    style={mobStyles.modalConfirm}
                    onClick={() => {
                      setMissingItems((prev) => [
                        {
                          id: Date.now(),
                          staffId,
                          clientId: null,
                          kind: "correcao",
                          text: `Correção nas horas de ${calPeriodLabel(payPeriod, lang)}: ${correctionText.trim()}`,
                          date: isoDateStr(TODAY),
                          resolved: false,
                          response: "",
                        },
                        ...prev,
                      ]);
                      setCorrectionOpen(false);
                      setCorrectionText("");
                      setReviewMode(null);
                      setCorrectionSentToast(true);
                      setTimeout(() => setCorrectionSentToast(false), 1800);
                    }}
                  >
                    {t.sendCorrection}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default EmployeeHorasScreen;
