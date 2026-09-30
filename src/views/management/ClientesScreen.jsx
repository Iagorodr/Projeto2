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
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

const EMPTY_CLIENT = {
  name: "", type: "office", city: "", address: "", contact: "",
  contractStart: "", contractEnd: "", hoursMonth: "", valueHour: "",
  frequency: "weekly", availability: "", duration: "", days: [],
  description: "", priorities: "", note: "",
  clientType: "fixo", clientValidUntil: "", origin: "",
  documents: [null, null, null, null],
};

function ClientesScreen({ lang, setLang, clients, setClients, onDeleteClient }) {
  const t = T[lang].clientes;
  const c0 = T[lang].common;
  const CLIENT_TYPES = { store: t.typeStore, office: t.typeOffice, house: t.typeHouse, factory: t.typeFactory };
  const FREQS = { weekly: t.freqWeekly, biweekly: t.freqBiweekly, monthly: t.freqMonthly };
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [draft, setDraft] = useState(EMPTY_CLIENT);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setDraft(EMPTY_CLIENT); setEditingId(null); setViewClient(null); setFormErrors({}); setModalMode("edit"); }
  function openView(c) { setViewClient(c); setModalMode("view"); }
  function startEdit() { setDraft({ ...viewClient }); setEditingId(viewClient.id); setFormErrors({}); setModalMode("edit"); }
  function cancelEdit() { setModalMode(editingId ? "view" : null); }
  function closeModal() { setModalMode(null); setViewClient(null); }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function confirmDelete() {
    onDeleteClient(viewClient.id);
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
    setSelectedIds((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }
  function confirmBulkDelete() {
    selectedIds.forEach((id) => onDeleteClient(id));
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
  }
  function validateDraft() {
    const errs = {};
    if (!draft.name.trim()) errs.name = true;
    if (!draft.address.trim()) errs.address = true;
    if (!draft.contact.trim()) errs.contact = true;
    if (!String(draft.valueHour).trim()) errs.valueHour = true;
    if (!draft.contractStart.trim()) errs.contractStart = true;
    return errs;
  }
  function saveDraft() {
    const errs = validateDraft();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (editingId) {
      const updated = { ...draft, id: editingId };
      setClients((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      setViewClient(updated);
      setModalMode("view");
    } else {
      setClients((prev) => [...prev, { ...draft, id: Date.now(), days: draft.days.length ? draft.days : [1] }]);
      setModalMode(null);
    }
  }

  function attachDocument(clientId, slotIndex, fileName) {
    setClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      const docs = [...(c.documents || [null, null, null, null])];
      docs[slotIndex] = fileName;
      return { ...c, documents: docs };
    }));
    setViewClient((v) => {
      if (!v || v.id !== clientId) return v;
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
        <button style={styles.newButton} onClick={openNew}>{t.newClient}</button>
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
          <div style={{ ...styles.th, flex: 2 }}>{t.colName}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colCity}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colContact}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colHours}</div>
          <div style={{ ...styles.th, flex: 1.4 }}>{t.colContractRange}</div>
        </div>
        {filtered.length === 0 ? (
          <div style={styles.noResults}>{t.noResults}</div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} style={styles.tableRow}>
              <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center" }}>
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
              </div>
              <button style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }} onClick={() => openView(c)}>
                <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{c.name}</div>
                <div style={{ ...styles.td, flex: 1 }}>{c.city}</div>
                <div style={{ ...styles.td, flex: 1 }}>{c.contact}</div>
                <div style={{ ...styles.td, flex: 1 }}>{c.hoursMonth} {t.perMonth}</div>
                <div style={{ ...styles.td, flex: 1.4 }}>{c.contractStart} - {c.contractEnd}</div>
              </button>
            </div>
          ))
        )}
      </div>

      {modalMode === "view" && viewClient && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.viewTitleRow}>
                <div style={styles.viewIconCircle}>
                  {(() => { const Icon = TYPE_ICONS[viewClient.type] || Store; return <Icon size={18} color={COLORS.primaryDark} />; })()}
                </div>
                <div style={styles.modalTitle}>{viewClient.name}</div>
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
              <ViewField icon={MapPin} label={t.fCity}>{viewClient.city || "—"}</ViewField>
              <ViewField icon={MapPin} label={t.fAddress}>
                {viewClient.address ? (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewClient.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, textDecoration: "underline" }}>
                    {viewClient.address}
                  </a>
                ) : "—"}
              </ViewField>
              <ViewField icon={Phone} label={t.fContact}>{viewClient.contact || "—"}</ViewField>
              <ViewField icon={Calendar} label={t.fContract}>{viewClient.contractStart || "—"} - {viewClient.contractEnd || "—"}</ViewField>
              <ViewField label={t.fClientType}>{viewClient.clientType === "replacement" ? t.clientTypeReplacement : t.clientTypeFixed}</ViewField>
              {viewClient.clientType === "replacement" && (
                <ViewField icon={Calendar} label={t.fValidUntil}>{viewClient.clientValidUntil || "—"}</ViewField>
              )}
              <ViewField label={t.fOrigin}>{viewClient.origin || "—"}</ViewField>
              <ViewField label={t.fHoursMonth}>{viewClient.hoursMonth || "—"}</ViewField>
              <ViewField icon={Euro} label={t.fValueHour}>{viewClient.valueHour || "—"}</ViewField>
              <ViewField label={t.fFrequency}>{FREQS[viewClient.frequency] || "—"}</ViewField>
              <ViewField label={t.fAvailability}>{viewClient.availability || "—"}</ViewField>
              <ViewField label={t.fHoursPerDay}>{viewClient.duration ? `${fmtMinutes(viewClient.duration)}` : "—"}</ViewField>
              <ViewField label={t.fDaysPerWeek}>
                {viewClient.days && viewClient.days.length > 0
                  ? `${viewClient.days.map((d) => DAY_LABELS_1_7[d]).join(", ")} (${viewClient.days.length})`
                  : "—"}
              </ViewField>
              <ViewField label={t.fDescription} full>{viewClient.description || "—"}</ViewField>
              <ViewField label={t.fPriorities} full>{viewClient.priorities || "—"}</ViewField>
              <ViewField label={t.fNote} full>{viewClient.note || "—"}</ViewField>
            </div>

            <div style={{ ...styles.profileFieldsBlock }}>
              <div style={styles.fieldLabel}>{t.documentsTitle}</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                {t.docSlots.map((label, idx) => {
                  const fileName = (viewClient.documents || [])[idx];
                  const inputId = `doc-client-${viewClient.id}-${idx}`;
                  return (
                    <div key={idx} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textSoft, marginBottom: 6 }}>{label}</div>
                      {fileName ? (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: COLORS.primaryDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.attached(fileName)}</span>
                          <button
                            style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: COLORS.extraTint, color: COLORS.extra, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                            onClick={() => attachDocument(viewClient.id, idx, null)}
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
                            onChange={(e) => { if (e.target.files[0]) attachDocument(viewClient.id, idx, e.target.files[0].name); }}
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
          </div>
        </div>
      )}

      {deleteConfirmOpen && viewClient && (
        <div style={styles.modalOverlay} onClick={() => setDeleteConfirmOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{c0.deleteConfirmTitle}</div>
              <button style={styles.modalClose} onClick={() => setDeleteConfirmOpen(false)}><X size={16} /></button>
            </div>
            <div style={{ ...styles.defSettingHint, marginBottom: 16 }}>{t.confirmDeleteBody(viewClient.name)}</div>
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
              <Field label={t.formName} full required error={formErrors.name ? c0.requiredField : undefined}><input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} /></Field>
              <Field label={t.formType}>
                <select style={styles.input} value={draft.type} onChange={(e) => updateDraft("type", e.target.value)}>
                  {Object.keys(CLIENT_TYPES).map((k) => <option key={k} value={k}>{CLIENT_TYPES[k]}</option>)}
                </select>
              </Field>
              <Field label={t.formCity}><input style={styles.input} value={draft.city} onChange={(e) => updateDraft("city", e.target.value)} /></Field>
              <Field label={t.formAddress} full required error={formErrors.address ? c0.requiredField : undefined}><input style={styles.input} value={draft.address} onChange={(e) => updateDraft("address", e.target.value)} /></Field>
              <Field label={t.formContact} required error={formErrors.contact ? c0.requiredField : undefined}><input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} /></Field>
              <Field label={t.formFrequency}>
                <select style={styles.input} value={draft.frequency} onChange={(e) => updateDraft("frequency", e.target.value)}>
                  {Object.keys(FREQS).map((k) => <option key={k} value={k}>{FREQS[k]}</option>)}
                </select>
              </Field>
              <Field label={t.formContractStart} required error={formErrors.contractStart ? c0.requiredField : undefined}><input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractStart} onChange={(e) => updateDraft("contractStart", e.target.value)} /></Field>
              <Field label={t.formContractEnd}><input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractEnd} onChange={(e) => updateDraft("contractEnd", e.target.value)} /></Field>
              <Field label={t.fClientType}>
                <select style={styles.input} value={draft.clientType} onChange={(e) => updateDraft("clientType", e.target.value)}>
                  <option value="fixo">{t.clientTypeFixed}</option>
                  <option value="replacement">{t.clientTypeReplacement}</option>
                </select>
              </Field>
              {draft.clientType === "replacement" && (
                <Field label={t.fValidUntil}><input type="date" style={styles.input} value={draft.clientValidUntil} onChange={(e) => updateDraft("clientValidUntil", e.target.value)} /></Field>
              )}
              <Field label={t.formOrigin}><input style={styles.input} value={draft.origin} onChange={(e) => updateDraft("origin", e.target.value)} /></Field>
              <Field label={t.formHoursMonth}><input type="number" style={styles.input} value={draft.hoursMonth} onChange={(e) => updateDraft("hoursMonth", e.target.value)} /></Field>
              <Field label={t.formValueHour} required error={formErrors.valueHour ? c0.requiredField : undefined}><input type="number" style={styles.input} value={draft.valueHour} onChange={(e) => updateDraft("valueHour", e.target.value)} /></Field>
              <Field label={t.formAvailability}><input style={styles.input} value={draft.availability} onChange={(e) => updateDraft("availability", e.target.value)} /></Field>
              <Field label={t.formDuration}><input type="number" style={styles.input} value={draft.duration} onChange={(e) => updateDraft("duration", e.target.value)} /></Field>
              <Field label={t.formDays} full>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {AGENDA_DAYS.map((d) => {
                    const active = (draft.days || []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                          background: active ? COLORS.primaryTint : COLORS.surface,
                          color: active ? COLORS.primaryDark : COLORS.textSoft,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          updateDraft(
                            "days",
                            active ? (draft.days || []).filter((x) => x !== d) : [...(draft.days || []), d]
                          )
                        }
                      >
                        {DAY_LABELS_1_7[d]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label={t.formDescription} full><textarea style={styles.textarea} rows={2} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} /></Field>
              <Field label={t.formPriorities} full><textarea style={styles.textarea} rows={2} value={draft.priorities} onChange={(e) => updateDraft("priorities", e.target.value)} /></Field>
              <Field label={t.formNote} full><textarea style={styles.textarea} rows={2} value={draft.note} onChange={(e) => updateDraft("note", e.target.value)} /></Field>
            </div>
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

export default ClientesScreen;
