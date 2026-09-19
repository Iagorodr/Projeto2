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

const EMPTY_CLIENT = {
  name: "", type: "office", city: "", address: "", contact: "",
  contractStart: "", contractEnd: "", hoursMonth: "", valueHour: "",
  frequency: "weekly", availability: "", duration: "", days: [],
  description: "", priorities: "", note: "",
  clientType: "fixo", clientValidUntil: "", origin: "",
};
const CLIENT_TYPES = { store: "Loja", office: "Escritório", house: "Residência", factory: "Fábrica" };
const FREQS = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };

function ClientesScreen({ lang, setLang, clients, setClients }) {
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [draft, setDraft] = useState(EMPTY_CLIENT);
  const [editingId, setEditingId] = useState(null);

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setDraft(EMPTY_CLIENT); setEditingId(null); setViewClient(null); setModalMode("edit"); }
  function openView(c) { setViewClient(c); setModalMode("view"); }
  function startEdit() { setDraft({ ...viewClient }); setEditingId(viewClient.id); setModalMode("edit"); }
  function cancelEdit() { setModalMode(editingId ? "view" : null); }
  function closeModal() { setModalMode(null); setViewClient(null); }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function saveDraft() {
    if (!draft.name.trim()) return;
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

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar cliente" style={styles.searchInput} />
        </div>
        <button style={styles.newButton} onClick={openNew}>+ Novo Cliente</button>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeaderRow}>
          <div style={{ ...styles.th, flex: 2 }}>Nome</div>
          <div style={{ ...styles.th, flex: 1 }}>Cidade</div>
          <div style={{ ...styles.th, flex: 1 }}>Contato</div>
          <div style={{ ...styles.th, flex: 1 }}>Horas</div>
          <div style={{ ...styles.th, flex: 1.4 }}>Início \ Fim</div>
        </div>
        {filtered.length === 0 ? (
          <div style={styles.noResults}>Nenhum cliente encontrado</div>
        ) : (
          filtered.map((c) => (
            <button key={c.id} style={styles.tableRow} onClick={() => openView(c)}>
              <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{c.name}</div>
              <div style={{ ...styles.td, flex: 1 }}>{c.city}</div>
              <div style={{ ...styles.td, flex: 1 }}>{c.contact}</div>
              <div style={{ ...styles.td, flex: 1 }}>{c.hoursMonth} por mes</div>
              <div style={{ ...styles.td, flex: 1.4 }}>{c.contractStart} - {c.contractEnd}</div>
            </button>
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
                <button style={styles.editButton} onClick={startEdit}><Pencil size={13} style={{ marginRight: 6 }} />Editar</button>
                <button style={styles.modalClose} onClick={closeModal}><X size={16} /></button>
              </div>
            </div>
            <div style={styles.viewGrid}>
              <ViewField icon={MapPin} label="Cidade">{viewClient.city || "—"}</ViewField>
              <ViewField icon={MapPin} label="Endereço">{viewClient.address || "—"}</ViewField>
              <ViewField icon={Phone} label="Contato">{viewClient.contact || "—"}</ViewField>
              <ViewField icon={Calendar} label="Contrato">{viewClient.contractStart || "—"} - {viewClient.contractEnd || "—"}</ViewField>
              <ViewField label="Tipo de cliente">{viewClient.clientType === "replacement" ? "Replacement (temporário)" : "Fixo"}</ViewField>
              {viewClient.clientType === "replacement" && (
                <ViewField icon={Calendar} label="Válido até">{viewClient.clientValidUntil || "—"}</ViewField>
              )}
              <ViewField label="Origem">{viewClient.origin || "—"}</ViewField>
              <ViewField label="Horas / mês (meta do contrato)">{viewClient.hoursMonth || "—"}</ViewField>
              <ViewField icon={Euro} label="Valor / hora">{viewClient.valueHour || "—"}</ViewField>
              <ViewField label="Frequência">{FREQS[viewClient.frequency] || "—"}</ViewField>
              <ViewField label="Horário">{viewClient.availability || "—"}</ViewField>
              <ViewField label="Horas por dia (duração da visita)">{viewClient.duration ? `${fmtMinutes(viewClient.duration)}` : "—"}</ViewField>
              <ViewField label="Dias por semana">
                {viewClient.days && viewClient.days.length > 0
                  ? `${viewClient.days.map((d) => DAY_LABELS_1_7[d]).join(", ")} (${viewClient.days.length} dia${viewClient.days.length > 1 ? "s" : ""})`
                  : "—"}
              </ViewField>
              <ViewField label="Descrição" full>{viewClient.description || "—"}</ViewField>
              <ViewField label="Prioridades" full>{viewClient.priorities || "—"}</ViewField>
              <ViewField label="Observação" full>{viewClient.note || "—"}</ViewField>
            </div>
          </div>
        </div>
      )}

      {modalMode === "edit" && (
        <div style={styles.modalOverlay} onClick={cancelEdit}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{editingId ? "Editar Cliente" : "Novo Cliente"}</div>
              <button style={styles.modalClose} onClick={cancelEdit}><X size={16} /></button>
            </div>
            <div style={styles.formGrid}>
              <Field label="Nome" full><input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} /></Field>
              <Field label="Tipo">
                <select style={styles.input} value={draft.type} onChange={(e) => updateDraft("type", e.target.value)}>
                  {Object.keys(CLIENT_TYPES).map((k) => <option key={k} value={k}>{CLIENT_TYPES[k]}</option>)}
                </select>
              </Field>
              <Field label="Cidade"><input style={styles.input} value={draft.city} onChange={(e) => updateDraft("city", e.target.value)} /></Field>
              <Field label="Endereço completo" full><input style={styles.input} value={draft.address} onChange={(e) => updateDraft("address", e.target.value)} /></Field>
              <Field label="Contato (telefone)"><input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} /></Field>
              <Field label="Frequência">
                <select style={styles.input} value={draft.frequency} onChange={(e) => updateDraft("frequency", e.target.value)}>
                  {Object.keys(FREQS).map((k) => <option key={k} value={k}>{FREQS[k]}</option>)}
                </select>
              </Field>
              <Field label="Início do contrato"><input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractStart} onChange={(e) => updateDraft("contractStart", e.target.value)} /></Field>
              <Field label="Fim do contrato"><input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractEnd} onChange={(e) => updateDraft("contractEnd", e.target.value)} /></Field>
              <Field label="Tipo de cliente">
                <select style={styles.input} value={draft.clientType} onChange={(e) => updateDraft("clientType", e.target.value)}>
                  <option value="fixo">Fixo</option>
                  <option value="replacement">Replacement (temporário)</option>
                </select>
              </Field>
              {draft.clientType === "replacement" && (
                <Field label="Válido até"><input type="date" style={styles.input} value={draft.clientValidUntil} onChange={(e) => updateDraft("clientValidUntil", e.target.value)} /></Field>
              )}
              <Field label="Origem (ex: XLG, CleanUp, Próprio)"><input style={styles.input} value={draft.origin} onChange={(e) => updateDraft("origin", e.target.value)} /></Field>
              <Field label="Horas por mês"><input type="number" style={styles.input} value={draft.hoursMonth} onChange={(e) => updateDraft("hoursMonth", e.target.value)} /></Field>
              <Field label="Valor / hora (€)"><input type="number" style={styles.input} value={draft.valueHour} onChange={(e) => updateDraft("valueHour", e.target.value)} /></Field>
              <Field label="Horário / disponibilidade"><input style={styles.input} value={draft.availability} onChange={(e) => updateDraft("availability", e.target.value)} /></Field>
              <Field label="Duração da visita (min) — horas por dia"><input type="number" style={styles.input} value={draft.duration} onChange={(e) => updateDraft("duration", e.target.value)} /></Field>
              <Field label="Dias da semana" full>
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
              <Field label="Descrição (o que fazer)" full><textarea style={styles.textarea} rows={2} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} /></Field>
              <Field label="Prioridades (pontos de atenção)" full><textarea style={styles.textarea} rows={2} value={draft.priorities} onChange={(e) => updateDraft("priorities", e.target.value)} /></Field>
              <Field label="Observação (acesso/logística)" full><textarea style={styles.textarea} rows={2} value={draft.note} onChange={(e) => updateDraft("note", e.target.value)} /></Field>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={cancelEdit}>Cancelar</button>
              <button style={styles.saveButton} onClick={saveDraft}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientesScreen;
