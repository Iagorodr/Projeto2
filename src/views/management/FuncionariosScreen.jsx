import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Phone, Briefcase, Calendar, MapPin, Euro, RotateCcw, Check,
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
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

const EMPTY_STAFF = { name: "", email: "", contact: "", password: "", accountType: "fixo", status: "ativo", validUntil: "", iban: "", role: "funcionario", canViewAllClients: false, documents: [null, null, null, null] };

function FuncionariosScreen({ lang, setLang, staff, setStaff, clients, assignments, onDeleteStaff }) {
  const t = T[lang].funcionarios;
  const c0 = T[lang].common;
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [viewStaff, setViewStaff] = useState(null);
  const [draft, setDraft] = useState(EMPTY_STAFF);
  const [editingId, setEditingId] = useState(null);
  const isMobile = useIsMobile();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setDraft(EMPTY_STAFF); setEditingId(null); setViewStaff(null); setFormErrors({}); setModalMode("edit"); }
  function openView(s) { setViewStaff(s); setModalMode("view"); }
  function startEdit() { setDraft({ ...viewStaff }); setEditingId(viewStaff.id); setFormErrors({}); setModalMode("edit"); }
  function cancelEdit() { setModalMode(editingId ? "view" : null); }
  function closeModal() { setModalMode(null); setViewStaff(null); }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function confirmDelete() {
    onDeleteStaff(viewStaff.id);
    setDeleteConfirmOpen(false);
    closeModal();
  }
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((s) => s.id))));
  }
  function confirmBulkDelete() {
    selectedIds.forEach((id) => onDeleteStaff(id));
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
  }
  function validateDraft() {
    const errs = {};
    if (!draft.name.trim()) errs.name = true;
    if (!draft.contact.trim()) errs.contact = true;
    if (!draft.iban.trim()) errs.iban = true;
    if (!draft.accountType) errs.accountType = true;
    return errs;
  }
  function saveDraft() {
    const errs = validateDraft();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (editingId) {
      const updated = { ...draft, id: editingId };
      setStaff((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
      setViewStaff(updated);
      setModalMode("view");
    } else {
      setStaff((prev) => [...prev, { ...draft, id: Date.now() }]);
      setModalMode(null);
    }
  }

  function attachDocument(staffId, slotIndex, fileName) {
    setStaff((prev) => prev.map((s) => {
      if (s.id !== staffId) return s;
      const docs = [...(s.documents || [null, null, null, null])];
      docs[slotIndex] = fileName;
      return { ...s, documents: docs };
    }));
    setViewStaff((v) => {
      if (!v || v.id !== staffId) return v;
      const docs = [...(v.documents || [null, null, null, null])];
      docs[slotIndex] = fileName;
      return { ...v, documents: docs };
    });
  }

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />

      <div style={styles.toolbar}>
        <div style={isMobile ? { ...styles.searchWrap, width: "100%" } : styles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={styles.searchInput} />
        </div>
        <button style={styles.newButton} onClick={openNew}>{t.newStaff}</button>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.extraTint, border: `1px solid ${COLORS.extra}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.extra }}>{t.selectedCount(selectedIds.size)}</span>
          <button style={{ ...styles.editButton, background: COLORS.extra, color: "#fff" }} onClick={() => setBulkDeleteConfirmOpen(true)}>{t.deleteSelected}</button>
        </div>
      )}

      <div style={isMobile ? { ...styles.tableWrap, overflowX: "auto" } : styles.tableWrap}>
        <div style={styles.tableHeaderRow}>
          <div style={{ width: 28, flexShrink: 0 }}>
            <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} />
          </div>
          <div style={{ ...styles.th, flex: 2.5 }}>{t.colName}</div>
          <div style={{ ...styles.th, flex: 1.3 }}>{t.colContact}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colClients}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colStatus}</div>
        </div>
        {filtered.length === 0 ? (
          <div style={styles.noResults}>{t.noResults}</div>
        ) : (
          filtered.map((s) => {
            const assignedCount = getAssignedClientIds(assignments, s.id).length;
            return (
              <div key={s.id} style={styles.tableRow}>
                <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                </div>
                <button style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }} onClick={() => openView(s)}>
                  <div style={{ ...styles.td, flex: 2.5, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ ...styles.td, flex: 1.3 }}>{s.contact}</div>
                  <div style={{ ...styles.td, flex: 1 }}>{assignedCount}</div>
                  <div style={{ ...styles.td, flex: 1 }}>
                    <span style={{ ...styles.statusBadge, ...(s.status === "ativo" ? styles.statusActive : styles.statusInactive) }}>
                      {s.status === "ativo" ? c0.active : c0.inactive}
                    </span>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {modalMode === "view" && viewStaff && (() => {
        const assignedIds = getAssignedClientIds(assignments, viewStaff.id);
        return (
          <div style={styles.modalOverlay} onClick={closeModal}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div style={styles.viewTitleRow}>
                  <div style={styles.viewIconCircle}><UsersRound size={18} color={COLORS.primaryDark} /></div>
                  <div>
                    <div style={styles.modalTitle}>{viewStaff.name}</div>
                    <span style={{ ...styles.statusBadge, ...(viewStaff.status === "ativo" ? styles.statusActive : styles.statusInactive) }}>
                      {viewStaff.status === "ativo" ? c0.active : c0.inactive}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.editButton} onClick={startEdit}><Pencil size={13} style={{ marginRight: 6 }} />{c0.edit}</button>
                  <button
                    style={{ ...styles.editButton, background: COLORS.extraTint, color: COLORS.extra }}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    {c0.delete}
                  </button>
                  <button style={styles.modalClose} onClick={closeModal}><X size={16} /></button>
                </div>
              </div>

              <div style={isMobile ? { ...styles.viewGrid, gridTemplateColumns: "1fr" } : styles.viewGrid}>
                <ViewField icon={Phone} label={t.fContact}>{viewStaff.contact}</ViewField>
                <ViewField label={t.fIban}>{viewStaff.iban || "-"}</ViewField>
                <ViewField icon={Briefcase} label={t.fAccountType} full={viewStaff.accountType !== "replacement"}>
                  {viewStaff.accountType === "fixo" ? t.accountFixed : t.accountReplacement}
                </ViewField>
                {viewStaff.accountType === "replacement" && (
                  <ViewField icon={Calendar} label={t.fValidUntil}>{viewStaff.validUntil || "-"}</ViewField>
                )}
                <ViewField label={t.fCanViewAllClients}>{viewStaff.canViewAllClients ? c0.yes : c0.no}</ViewField>
              </div>

              <div style={styles.profileFieldsBlock}>
                <div style={styles.fieldLabel}>{t.assignedClients}</div>
                {assignedIds.length === 0 ? (
                  <div style={styles.noClientsText}>{t.noClients}</div>
                ) : (
                  <div style={styles.clientChipsRow}>
                    {assignedIds.map((cid) => {
                      const c = clientById(clients, cid);
                      return c ? <span key={cid} style={styles.clientChip}>{c.name}</span> : null;
                    })}
                  </div>
                )}
                <div style={styles.assignedNote}>{t.assignedNote}</div>
              </div>

              <div style={{ ...styles.profileFieldsBlock, marginTop: 14 }}>
                <div style={styles.fieldLabel}>{t.documentsTitle}</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                  {t.docSlots.map((label, idx) => {
                    const fileName = (viewStaff.documents || [])[idx];
                    const inputId = `doc-staff-${viewStaff.id}-${idx}`;
                    return (
                      <div key={idx} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textSoft, marginBottom: 6 }}>{label}</div>
                        {fileName ? (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: COLORS.primaryDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.attached(fileName)}</span>
                            <button
                              style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: COLORS.extraTint, color: COLORS.extra, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                              onClick={() => attachDocument(viewStaff.id, idx, null)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              id={inputId}
                              style={{ display: "none" }}
                              onChange={(e) => { if (e.target.files[0]) attachDocument(viewStaff.id, idx, e.target.files[0].name); }}
                            />
                            <label htmlFor={inputId} style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 8, border: `1px dashed ${COLORS.border}`, fontSize: 12, fontWeight: 600, color: COLORS.textSoft, cursor: "pointer" }}>
                              {t.attach}
                            </label>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ ...styles.defSettingHint, marginTop: 8 }}>{t.docsNote}</div>
              </div>

              <div style={{ ...styles.defSettingHint, marginTop: 12 }}>{t.loginNote}</div>
            </div>
          </div>
        );
      })()}

      {deleteConfirmOpen && viewStaff && (
        <div style={styles.modalOverlay} onClick={() => setDeleteConfirmOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{c0.deleteConfirmTitle}</div>
              <button style={styles.modalClose} onClick={() => setDeleteConfirmOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ ...styles.defSettingHint, marginBottom: 16 }}>{t.confirmDeleteBody(viewStaff.name)}</div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setDeleteConfirmOpen(false)}>{c0.cancel}</button>
              <button style={{ ...styles.saveButton, background: COLORS.extra }} onClick={confirmDelete}>{c0.confirmDelete}</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirmOpen && (
        <div style={styles.modalOverlay} onClick={() => setBulkDeleteConfirmOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{c0.deleteConfirmTitle}</div>
              <button style={styles.modalClose} onClick={() => setBulkDeleteConfirmOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ ...styles.defSettingHint, marginBottom: 16 }}>{t.confirmDeleteBulkBody(selectedIds.size)}</div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setBulkDeleteConfirmOpen(false)}>{c0.cancel}</button>
              <button style={{ ...styles.saveButton, background: COLORS.extra }} onClick={confirmBulkDelete}>{c0.confirmDelete}</button>
            </div>
          </div>
        </div>
      )}

      {modalMode === "edit" && (
        <div style={styles.modalOverlay} onClick={cancelEdit}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{editingId ? t.modalEditTitle : t.modalNewTitle}</div>
              <button style={styles.modalClose} onClick={cancelEdit}><X size={16} /></button>
            </div>
            <div style={isMobile ? { ...styles.formGrid, gridTemplateColumns: "1fr" } : styles.formGrid}>
              <Field label={t.fName} full required error={formErrors.name ? c0.requiredField : undefined}><input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} /></Field>
              <Field label={t.fContact} required error={formErrors.contact ? c0.requiredField : undefined}><input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} /></Field>
              <Field label={t.fIban} required error={formErrors.iban ? c0.requiredField : undefined}><input type="text" style={styles.input} value={draft.iban} onChange={(e) => updateDraft("iban", e.target.value)} placeholder="BE00 0000 0000 0000" /></Field>
              <Field label={t.fAccountType} required>
                <select style={styles.input} value={draft.accountType} onChange={(e) => updateDraft("accountType", e.target.value)}>
                  <option value="fixo">{t.accountFixed}</option>
                  <option value="replacement">{t.accountReplacement}</option>
                </select>
              </Field>
              {draft.accountType === "replacement" && (
                <Field label={t.fValidUntil}><input type="date" style={styles.input} value={draft.validUntil} onChange={(e) => updateDraft("validUntil", e.target.value)} /></Field>
              )}
              <Field label={t.fStatus}>
                <select style={styles.input} value={draft.status} onChange={(e) => updateDraft("status", e.target.value)}>
                  <option value="ativo">{c0.active}</option>
                  <option value="inativo">{c0.inactive}</option>
                </select>
              </Field>
              <Field label={t.fCanViewAllClients}>
                <button
                  type="button"
                  onClick={() => updateDraft("canViewAllClients", !draft.canViewAllClients)}
                  style={{
                    ...styles.horModalPaidToggle,
                    background: draft.canViewAllClients ? COLORS.primaryDark : "transparent",
                    borderColor: COLORS.primaryDark,
                    color: draft.canViewAllClients ? "#fff" : COLORS.primaryDark,
                    cursor: "pointer",
                  }}
                >
                  {draft.canViewAllClients ? c0.yes : c0.no}
                </button>
              </Field>
            </div>
            <div style={{ ...styles.defSettingHint, marginTop: 12 }}>{t.loginNote}</div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={cancelEdit}>{c0.cancel}</button>
              <button style={styles.saveButton} onClick={saveDraft}>{c0.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FuncionariosScreen;
