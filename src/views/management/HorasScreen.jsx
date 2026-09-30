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
  buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours,
} from "../../models/utils.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { ChevronLeftIcon, ChevronRightIcon } from "../shared/Icons.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { exportStaffHorasPdf, exportPeriodSummaryPdf } from "../../models/pdfExport.js";

function HorasScreen({ lang, setLang, company, clients, staff, horasData, setHorasData, cutoffDay, closedPeriods, setClosedPeriods, sentItems, missingItems, setSentItems, setMissingItems }) {
  const t = T[lang].horas;
  const c0 = T[lang].common;
  const pdfT = T[lang].pdf;
  const [monthOffset, setMonthOffset] = useState(0);
  const [staffSearch, setStaffSearch] = useState("");
  const [openStaffId, setOpenStaffId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [rowDraft, setRowDraft] = useState({ clientId: null, hours: "" });
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closedToast, setClosedToast] = useState(false);
  const isMobile = useIsMobile();

  const period = monthOffset === 0
    ? getOpenPeriod(closedPeriods, cutoffDay, TODAY)
    : getCutoffPeriod(TODAY, cutoffDay, monthOffset);
  const periodLabel = formatPeriodLabel(period, lang);

  const visibleStaff = staff.filter((s) => s.name.toLowerCase().includes(staffSearch.toLowerCase()));
  const openStaff = staff.find((s) => s.id === openStaffId);
  const openHoras = openStaffId ? horasData[openStaffId] : null;

  const kpiCounts = {
    pending: staff.filter((s) => horasData[s.id]?.status === "pendente").length,
    paid: staff.filter((s) => horasData[s.id]?.paid).length,
    unpaid: staff.filter((s) => horasData[s.id]?.status === "finalizado" && !horasData[s.id]?.paid).length,
  };
  const periodTotalHours = staff.reduce((s, st) => s + staffTotalHours(horasData[st.id] || { entries: [] }, period), 0);
  const periodTotalEuros = staff.reduce((s, st) => s + staffTotalPay(horasData[st.id] || { entries: [] }, clients, period), 0);
  const canClosePeriod = staff.length > 0 && staff.every((s) => horasData[s.id]?.paid);

  function closePeriod() {
    const snapshot = buildClosedPeriodSnapshot(period, clients, staff, horasData, sentItems, missingItems);
    setClosedPeriods((prev) => [snapshot, ...prev]);
    setHorasData((prev) => {
      const next = {};
      staff.forEach((s) => {
        const current = prev[s.id] || { status: "pendente", paid: false, entries: [], lockedWeeks: {}, noClientDays: [], reopened: false };
        const keptEntries = current.entries.filter((e) => !dateStrInPeriod(e.date, period));
        const keptLockedWeeks = {};
        Object.entries(current.lockedWeeks || {}).forEach(([weekKey, val]) => {
          if (!dateStrInPeriod(weekKey, period)) keptLockedWeeks[weekKey] = val;
        });
        const keptNoClientDays = (current.noClientDays || []).filter((d) => !dateStrInPeriod(d, period));
        next[s.id] = { ...current, status: "pendente", paid: false, entries: keptEntries, lockedWeeks: keptLockedWeeks, noClientDays: keptNoClientDays, reopened: false };
      });
      return next;
    });
    setSentItems((prev) => prev.filter((i) => !dateStrInPeriod(i.date, period)));
    setMissingItems((prev) => prev.filter((i) => !dateStrInPeriod(i.date, period)));
    setCloseConfirmOpen(false);
    setClosedToast(true);
    setTimeout(() => setClosedToast(false), 2200);
  }
  function exportPeriodPdf() {
    const rows = staff.map((s) => {
      const h = horasData[s.id] || { status: "pendente", paid: false, entries: [] };
      return { name: s.name, paid: h.paid, status: h.status, hours: staffTotalHours(h, period), value: staffTotalPay(h, clients, period) };
    });
    exportPeriodSummaryPdf({
      companyName: company?.name,
      periodLabel,
      rows,
      totalHours: periodTotalHours,
      totalValue: periodTotalEuros,
      pdfT,
      statusLabels: { paid: c0.paid, finished: t.statusFinished, pending: c0.pending },
    });
  }
  function exportStaffPdf() {
    exportStaffHorasPdf({
      companyName: company?.name,
      staffName: openStaff.name,
      periodLabel,
      entries: openHoras.entries,
      clients,
      totalHours: staffTotalHours(openHoras, period),
      totalValue: staffTotalPay(openHoras, clients, period),
      lang,
      pdfT,
    });
  }

  function updateHoras(staffId, updater) {
    setHorasData((prev) => ({ ...prev, [staffId]: updater(prev[staffId]) }));
  }
  function togglePaid(staffId) {
    updateHoras(staffId, (h) => (h.status === "finalizado" ? { ...h, paid: !h.paid } : h));
  }
  function reopenForCorrection(staffId) {
    updateHoras(staffId, (h) => ({ ...h, status: "pendente", lockedWeeks: {}, reopened: true }));
  }
  function approveEntry(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: true } : e)) }));
  }
  function revertApproval(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, approved: false } : e)) }));
  }
  function toggleVoid(staffId, i) {
    updateHoras(staffId, (h) => ({ ...h, entries: h.entries.map((e, idx) => (idx === i ? { ...e, voided: !e.voided } : e)) }));
  }
  function startEditRow(i, entry) { setEditingIndex(i); setRowDraft({ clientId: entry.clientId, hours: entry.hours }); }
  function cancelEditRow() { setEditingIndex(null); }
  function saveEditRow(staffId, i) {
    updateHoras(staffId, (h) => ({
      ...h,
      entries: h.entries.map((e, idx) => (idx === i ? { ...e, clientId: rowDraft.clientId, hours: Number(rowDraft.hours) || 0, approved: e.extra ? false : e.approved } : e)),
    }));
    setEditingIndex(null);
  }

  return (
    <div style={styles.content}>
      <div style={styles.horTop}>
        <div style={styles.periodNav}>
          <button style={styles.navButton} onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeftIcon /></button>
          <span style={styles.periodLabel}>{periodLabel}</span>
          <button style={styles.navButton} onClick={() => setMonthOffset((m) => m + 1)}><ChevronRightIcon /></button>
        </div>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>

      <div style={styles.horSearchKpiRow}>
        <div style={styles.horSearchWrap}>
          <input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder={t.searchPlaceholder} style={styles.defTextInput} />
        </div>
        <div style={styles.horKpiBox}>
          <div style={styles.horKpiBoxItem}><div style={styles.horKpiBoxLabel}>{t.kpiPending}</div><div style={styles.horKpiBoxValue}>{kpiCounts.pending}</div></div>
          <div style={styles.horKpiBoxItem}><div style={styles.horKpiBoxLabel}>{t.kpiPaid}</div><div style={styles.horKpiBoxValue}>{kpiCounts.paid}</div></div>
          <div style={styles.horKpiBoxItem}><div style={styles.horKpiBoxLabel}>{t.kpiUnpaid}</div><div style={styles.horKpiBoxValue}>{kpiCounts.unpaid}</div></div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={styles.horPeriodTotal}>{t.periodTotal}: {fmtHoursNum(periodTotalHours)}h · {fmtEuro(periodTotalEuros)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.cancelButton} onClick={exportPeriodPdf}>{t.exportPdfGeneral}</button>
          <button
            style={{ ...styles.saveButton, opacity: canClosePeriod ? 1 : 0.5, cursor: canClosePeriod ? "pointer" : "not-allowed" }}
            disabled={!canClosePeriod}
            onClick={() => setCloseConfirmOpen(true)}
          >
            {t.closePeriod}
          </button>
        </div>
      </div>
      {!canClosePeriod && (
        <div style={{ ...styles.defSettingHint, marginTop: -8, marginBottom: 16 }}>
          {t.closePeriodHint}
        </div>
      )}
      {closedToast && <div style={{ ...styles.avSentNote, marginBottom: 12, display: "block" }}>{t.closedToast}</div>}

      <div style={isMobile ? { ...styles.tableWrap, overflowX: "auto" } : styles.tableWrap}>
        <div style={styles.tableHeaderRow}>
          <div style={{ ...styles.th, flex: 2 }}>{t.colStaff}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colStatus}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colTotalHours}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colTotalPay}</div>
          <div style={{ ...styles.th, flex: 1.2, textAlign: "center" }}>{t.colPaid}</div>
        </div>
        {visibleStaff.map((s) => {
          const h = horasData[s.id] || { status: "pendente", paid: false, entries: [] };
          const pendingExtras = h.entries.filter((e) => e.extra && !e.approved && !e.voided).length;
          const paidTogglable = h.status === "finalizado";
          return (
            <div key={s.id} style={styles.tableRow} onClick={() => setOpenStaffId(s.id)}>
              <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{s.name}</div>
              <div style={{ ...styles.td, flex: 1 }}>
                <span style={{ ...styles.statusBadge, ...(h.paid ? styles.horStatusPaid : h.status === "finalizado" ? styles.horStatusDone : styles.horStatusPending) }}>
                  {h.paid ? c0.paid : h.status === "finalizado" ? t.statusFinished : c0.pending}
                </span>
                {pendingExtras > 0 && <span style={styles.horPendingExtraDot} />}
              </div>
              <div style={{ ...styles.td, flex: 1 }}>{fmtHoursNum(staffTotalHours(h, period))}h</div>
              <div style={{ ...styles.td, flex: 1 }}>{fmtEuro(staffTotalPay(h, clients, period))}</div>
              <div style={{ ...styles.td, flex: 1.2, justifyContent: "center" }}>
                <button
                  style={{
                    ...styles.horPaidToggle,
                    background: h.paid ? COLORS.primaryDark : "transparent",
                    borderColor: paidTogglable ? COLORS.primaryDark : COLORS.border,
                    cursor: paidTogglable ? "pointer" : "not-allowed",
                    opacity: paidTogglable ? 1 : 0.4,
                  }}
                  disabled={!paidTogglable}
                  onClick={(ev) => { ev.stopPropagation(); togglePaid(s.id); }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {openStaff && openHoras && (
        <div style={styles.modalOverlay} onClick={() => { setOpenStaffId(null); setEditingIndex(null); }}>
          <div style={{ ...styles.modalCard, maxWidth: 780 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{openStaff.name}</div>
                <div style={styles.modalSubtitle}>{t.periodTotal}: {periodLabel}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ ...styles.horPeriodTotal, background: COLORS.bg, color: COLORS.text }}>{t.totalHoursLabel}: {fmtHoursNum(staffTotalHours(openHoras, period))}h</div>
                  <div style={styles.horPeriodTotal}>{t.amountToReceiveLabel}: {fmtEuro(staffTotalPay(openHoras, clients, period))}</div>
                </div>
                <button style={styles.horCancelSmall} onClick={exportStaffPdf}>{t.exportPdf}</button>
                {openHoras.status === "finalizado" && !openHoras.paid && (
                  <button style={styles.horCancelSmall} onClick={() => reopenForCorrection(openStaff.id)}>
                    {t.reopenForCorrection}
                  </button>
                )}
                <button
                  style={{
                    ...styles.horModalPaidToggle,
                    background: openHoras.paid ? COLORS.primaryDark : "transparent",
                    borderColor: openHoras.status === "finalizado" ? COLORS.primaryDark : COLORS.border,
                    color: openHoras.paid ? "#fff" : COLORS.primaryDark,
                    cursor: openHoras.status === "finalizado" ? "pointer" : "not-allowed",
                    opacity: openHoras.status === "finalizado" ? 1 : 0.4,
                  }}
                  disabled={openHoras.status !== "finalizado"}
                  onClick={() => togglePaid(openStaff.id)}
                >
                  {openHoras.paid && <Check size={12} />}
                  <span style={{ marginLeft: 6 }}>{openHoras.paid ? c0.paid : t.markAsPaid}</span>
                </button>
                <button style={styles.modalClose} onClick={() => { setOpenStaffId(null); setEditingIndex(null); }}><X size={16} /></button>
              </div>
            </div>

            <div style={styles.horReportTable}>
              <div style={styles.horReportHeaderRow}>
                <div style={{ ...styles.horRth, flex: 1 }}>{t.repDate}</div>
                <div style={{ ...styles.horRth, flex: 2 }}>{t.repClient}</div>
                <div style={{ ...styles.horRth, flex: 1 }}>{t.repHours}</div>
                <div style={{ ...styles.horRth, flex: 1 }}>{t.repValueHour}</div>
                <div style={{ ...styles.horRth, flex: 1 }}>{t.repTotal}</div>
                <div style={{ ...styles.horRth, flex: 1.8 }} />
              </div>
              {openHoras.entries.map((e, i) => {
                const isEditing = editingIndex === i;
                const locked = openHoras.paid;
                const client = clientById(clients, e.clientId);
                const valueHour = client ? client.valueHour : 0;
                return (
                  <div key={i} style={{ ...styles.horReportRow, background: e.voided ? COLORS.bg : e.extra ? COLORS.extraTint : COLORS.surface, opacity: e.voided ? 0.55 : 1 }}>
                    <div style={{ ...styles.horRtd, flex: 1, textDecoration: e.voided ? "line-through" : "none" }}>{e.date}</div>
                    {isEditing ? (
                      <>
                        <div style={{ flex: 2, paddingRight: 8 }}>
                          <select style={styles.horRowEditInput} value={rowDraft.clientId || ""} onChange={(ev) => setRowDraft((d) => ({ ...d, clientId: Number(ev.target.value) }))}>
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1, paddingRight: 8 }}>
                          <input type="number" step="0.5" style={styles.horRowEditInput} value={rowDraft.hours} onChange={(ev) => setRowDraft((d) => ({ ...d, hours: ev.target.value }))} />
                        </div>
                        <div style={{ ...styles.horRtd, flex: 1 }}>{fmtEuro(valueHour)}</div>
                        <div style={{ ...styles.horRtd, flex: 1 }}>{fmtEuro((Number(rowDraft.hours) || 0) * valueHour)}</div>
                        <div style={{ flex: 1.8, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button style={styles.horCancelSmall} onClick={cancelEditRow}>{c0.cancel}</button>
                          <button style={styles.horApproveButton} onClick={() => saveEditRow(openStaff.id, i)}>{c0.save}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ ...styles.horRtd, flex: 2, textDecoration: e.voided ? "line-through" : "none" }}>{client ? client.name : "—"}</div>
                        <div style={{ ...styles.horRtd, flex: 1, textDecoration: e.voided ? "line-through" : "none", color: e.extra ? COLORS.extra : COLORS.text, fontWeight: e.extra ? 700 : 400 }}>
                          {fmtHoursNum(e.hours)}{e.extra && "*"}
                        </div>
                        <div style={{ ...styles.horRtd, flex: 1, textDecoration: e.voided ? "line-through" : "none" }}>{fmtEuro(valueHour)}</div>
                        <div style={{ ...styles.horRtd, flex: 1, textDecoration: e.voided ? "line-through" : "none" }}>{fmtEuro(e.hours * valueHour)}</div>
                        <div style={{ flex: 1.8, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                          {e.voided ? (
                            <span style={styles.horVoidedTag}>
                              {t.voided}
                              {!locked && <button style={styles.horUndoButton} onClick={() => toggleVoid(openStaff.id, i)}><RotateCcw size={11} /></button>}
                            </span>
                          ) : (
                            <>
                              {e.extra && (e.approved ? (
                                <span style={styles.horApprovedTag}>
                                  <Check size={11} style={{ marginRight: 3 }} />{t.approved}
                                  {!locked && <button style={styles.horUndoButton} onClick={() => revertApproval(openStaff.id, i)}><RotateCcw size={11} /></button>}
                                </span>
                              ) : (!locked && <button style={styles.horApproveButton} onClick={() => approveEntry(openStaff.id, i)}>{t.approve}</button>))}
                              {!locked && <button style={styles.horEditRowButton} onClick={() => startEditRow(i, e)}><Pencil size={12} /></button>}
                              {!locked && <button style={styles.horVoidRowButton} onClick={() => toggleVoid(openStaff.id, i)}><X size={12} /></button>}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {closeConfirmOpen && (
        <div style={styles.modalOverlay} onClick={() => setCloseConfirmOpen(false)}>
          <div style={{ ...styles.modalCard, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>{t.closeConfirmTitle}</div>
            <div style={{ ...styles.defSettingHint, marginBottom: 16 }}>
              {t.closeConfirmBody(periodLabel, fmtHoursNum(periodTotalHours), fmtEuro(periodTotalEuros))}
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setCloseConfirmOpen(false)}>{c0.cancel}</button>
              <button style={styles.saveButton} onClick={closePeriod}>{t.confirmClose}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HorasScreen;
