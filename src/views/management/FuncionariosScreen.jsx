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

const EMPTY_STAFF = { name: "", email: "", contact: "", password: "", accountType: "fixo", status: "ativo", validUntil: "", iban: "" };

function FuncionariosScreen({ lang, setLang, staff, setStaff, clients, assignments }) {
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [viewStaff, setViewStaff] = useState(null);
  const [draft, setDraft] = useState(EMPTY_STAFF);
  const [editingId, setEditingId] = useState(null);

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setDraft(EMPTY_STAFF); setEditingId(null); setViewStaff(null); setModalMode("edit"); }
  function openView(s) { setViewStaff(s); setModalMode("view"); }
  function startEdit() { setDraft({ ...viewStaff }); setEditingId(viewStaff.id); setModalMode("edit"); }
  function cancelEdit() { setModalMode(editingId ? "view" : null); }
  function closeModal() { setModalMode(null); setViewStaff(null); }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function saveDraft() {
    if (!draft.name.trim()) return;
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

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar funcionário" style={styles.searchInput} />
        </div>
        <button style={styles.newButton} onClick={openNew}>+ Novo Funcionário</button>
      </div>

      <div style={styles.tableWrap}>
        <div style={styles.tableHeaderRow}>
          <div style={{ ...styles.th, flex: 2 }}>Nome</div>
          <div style={{ ...styles.th, flex: 2 }}>Email</div>
          <div style={{ ...styles.th, flex: 1.2 }}>Contato</div>
          <div style={{ ...styles.th, flex: 1 }}>Clientes</div>
          <div style={{ ...styles.th, flex: 1 }}>Status</div>
        </div>
        {filtered.length === 0 ? (
          <div style={styles.noResults}>Nenhum funcionário encontrado</div>
        ) : (
          filtered.map((s) => {
            const assignedCount = getAssignedClientIds(assignments, s.id).length;
            return (
              <button key={s.id} style={styles.tableRow} onClick={() => openView(s)}>
                <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{s.name}</div>
                <div style={{ ...styles.td, flex: 2 }}>{s.email}</div>
                <div style={{ ...styles.td, flex: 1.2 }}>{s.contact}</div>
                <div style={{ ...styles.td, flex: 1 }}>{assignedCount}</div>
                <div style={{ ...styles.td, flex: 1 }}>
                  <span style={{ ...styles.statusBadge, ...(s.status === "ativo" ? styles.statusActive : styles.statusInactive) }}>
                    {s.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </button>
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
                      {viewStaff.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.editButton} onClick={startEdit}><Pencil size={13} style={{ marginRight: 6 }} />Editar</button>
                  <button style={styles.modalClose} onClick={closeModal}><X size={16} /></button>
                </div>
              </div>

              <div style={styles.viewGrid}>
                <ViewField icon={Mail} label="Email (login)">{viewStaff.email}</ViewField>
                <ViewField icon={Phone} label="Contato (telefone)">{viewStaff.contact}</ViewField>
                <ViewField icon={KeyRound} label="Senha">{viewStaff.password || "-"}</ViewField>
                <ViewField label="IBAN">{viewStaff.iban || "-"}</ViewField>
                <ViewField icon={Briefcase} label="Tipo de conta" full={viewStaff.accountType !== "replacement"}>
                  {viewStaff.accountType === "fixo" ? "Fixo" : "Replacement temporário"}
                </ViewField>
                {viewStaff.accountType === "replacement" && (
                  <ViewField icon={Calendar} label="Válido até">{viewStaff.validUntil || "-"}</ViewField>
                )}
              </div>

              <div style={styles.profileFieldsBlock}>
                <div style={styles.fieldLabel}>Clientes atribuídos</div>
                {assignedIds.length === 0 ? (
                  <div style={styles.noClientsText}>Nenhum cliente atribuído ainda.</div>
                ) : (
                  <div style={styles.clientChipsRow}>
                    {assignedIds.map((cid) => {
                      const c = clientById(clients, cid);
                      return c ? <span key={cid} style={styles.clientChip}>{c.name}</span> : null;
                    })}
                  </div>
                )}
                <div style={styles.assignedNote}>A atribuição de clientes é feita na tela de Agendas.</div>
              </div>
            </div>
          </div>
        );
      })()}

      {modalMode === "edit" && (
        <div style={styles.modalOverlay} onClick={cancelEdit}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{editingId ? "Editar Funcionário" : "Novo Funcionário"}</div>
              <button style={styles.modalClose} onClick={cancelEdit}><X size={16} /></button>
            </div>
            <div style={styles.formGrid}>
              <Field label="Nome" full><input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} /></Field>
              <Field label="Email (login)"><input style={styles.input} value={draft.email} onChange={(e) => updateDraft("email", e.target.value)} /></Field>
              <Field label="Contato (telefone)"><input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} /></Field>
              <Field label="Senha"><input type="text" style={styles.input} value={draft.password} onChange={(e) => updateDraft("password", e.target.value)} /></Field>
              <Field label="IBAN"><input type="text" style={styles.input} value={draft.iban} onChange={(e) => updateDraft("iban", e.target.value)} placeholder="BE00 0000 0000 0000" /></Field>
              <Field label="Tipo de conta">
                <select style={styles.input} value={draft.accountType} onChange={(e) => updateDraft("accountType", e.target.value)}>
                  <option value="fixo">Fixo</option>
                  <option value="replacement">Replacement temporário</option>
                </select>
              </Field>
              {draft.accountType === "replacement" && (
                <Field label="Válido até"><input type="date" style={styles.input} value={draft.validUntil} onChange={(e) => updateDraft("validUntil", e.target.value)} /></Field>
              )}
              <Field label="Status">
                <select style={styles.input} value={draft.status} onChange={(e) => updateDraft("status", e.target.value)}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Field>
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

export default FuncionariosScreen;
