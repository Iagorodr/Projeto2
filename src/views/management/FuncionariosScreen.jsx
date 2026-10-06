import { useState } from "react";
import { Pencil, Eye, EyeOff, Copy, Check, AlertTriangle, Plus } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY, LANG_NAMES } from "../../models/data.js";
import { getAssignedClientIds, clientById, isStaffActive, linkPartners } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { Field, ViewField } from "../shared/Layout.jsx";
import {
  PageHeader, SearchField, FilterChip, DataTable, Avatar, Pill, SupervisorTag, Drawer, Button, ConfirmDialog, Card,
} from "../shared/ui/index.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../models/supabaseClient.js";

const EMPTY_STAFF = {
  name: "", email: "", contact: "", accountType: "fixo", status: "ativo", validUntil: "",
  iban: "", role: "funcionario", canViewAllClients: false, partnerId: null, documents: [null, null, null, null],
};

// "YYYY-MM-DD" -> "23/09" (documento, 4.9: "Expirou a 23/09", "até 23/09").
function dmFromIso(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
// Dias (inteiros) de `TODAY` até à validade — negativo se já passou. A
// validade é INCLUSIVA (comparar com `isStaffActive`, utils.js): no
// próprio dia da validade esta função devolve 0, não -1.
function daysUntilIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d) - TODAY) / (24 * 60 * 60 * 1000));
}
function isExpiredByValidity(s) {
  return s.accountType === "replacement" && !!s.validUntil && daysUntilIso(s.validUntil) < 0;
}

const iconBtnStyle = {
  width: 26, height: 26, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.card,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink2, flexShrink: 0, padding: 0,
};

// IBAN mascarado (documento, 4.9): "PT50 •••• •••• 1234" + botão olho +
// botão copiar; "–" se vazio. Guarda o estado "revelado" localmente — cada
// gaveta aberta começa sempre escondida, de propósito (não persiste entre
// uma pessoa e outra, nem entre aberturas da mesma pessoa).
function MaskedIban({ iban, t }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!iban || !iban.trim()) return <span style={{ color: COLORS.ink3 }}>–</span>;
  const clean = iban.replace(/\s+/g, "");
  const masked = clean.length > 8 ? `${iban.slice(0, 4)} •••• •••• ${clean.slice(-4)}` : iban;
  async function copy() {
    try {
      await navigator.clipboard.writeText(iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível — o IBAN continua visível pra copiar à mão.
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "monospace", fontSize: 13.5, color: COLORS.ink, letterSpacing: "0.02em" }}>{shown ? iban : masked}</span>
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? t.hideIban : t.showIban} style={iconBtnStyle}>
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button type="button" onClick={copy} aria-label={t.copyIban} style={iconBtnStyle}>
        {copied ? <Check size={13} color={COLORS.ok} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// Interruptor só de leitura (documento, 4.9: "'Vê todos os clientes' como
// interruptor só de leitura aqui") — representação visual do estado, sem
// `onClick`; a edição de verdade acontece só no modo de edição, com o
// botão normal já usado no resto do projeto (ver mais abaixo).
function ReadOnlyToggle({ on }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", width: 36, height: 20, borderRadius: 999,
        background: on ? COLORS.forest600 : COLORS.lineSoft, padding: 2, boxSizing: "border-box", flexShrink: 0,
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform .15s ease" }} />
    </span>
  );
}

function SectionTitle({ children, first }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.06em", margin: first ? "0 0 10px" : "22px 0 10px" }}>
      {children}
    </div>
  );
}

// Chip "Tipo de conta" (documento, 4.9): "Fixo" ou "Replacement temporário
// · até 23/09"; se a validade já passou, vira a pílula cinzenta "Expirou a
// 23/09" em vez disso.
function AccountTypePill({ s, t }) {
  if (s.accountType !== "replacement") return <Pill variant="neutral">{t.accountFixed}</Pill>;
  if (!s.validUntil) return <Pill variant="neutral">{t.accountReplacement}</Pill>;
  if (isExpiredByValidity(s)) return <Pill variant="neutral">{t.expiredOn(dmFromIso(s.validUntil))}</Pill>;
  return <Pill variant="neutral">{t.accountReplacementUntil(dmFromIso(s.validUntil))}</Pill>;
}

// Coluna/selo "Estado" (documento, 4.9, "Efeitos de estar inativa por
// validade"): Inativo cinzento + "Expirou a 23/09" por baixo quando a
// inatividade vem da validade; Ativo normal; ou, nos últimos 7 dias antes
// de expirar, pílula âmbar "Acaba em N dias" no lugar de "Ativo".
function StatusBlock({ s, t, c0 }) {
  const active = isStaffActive(s, TODAY);
  if (!active) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Pill variant="neutral">{c0.inactive}</Pill>
        {isExpiredByValidity(s) && <span style={{ fontSize: 11, color: COLORS.ink3 }}>{t.expiredOn(dmFromIso(s.validUntil))}</span>}
      </div>
    );
  }
  if (s.accountType === "replacement" && s.validUntil) {
    const days = daysUntilIso(s.validUntil);
    if (days >= 0 && days <= 7) return <Pill variant="pending">{t.endingInDays(days)}</Pill>;
  }
  return <Pill variant="paid">{c0.active}</Pill>;
}

// Funcionários (documento de design, secção 4.9) — gaveta em vez de modal,
// chips de filtro, IBAN mascarado, documentos com estado e a regra nova de
// `isStaffActive` (Etapa 4j) refletida na lista e na gaveta. `onNavigate`
// é opcional (liga "Clientes atribuídos" à tela de Agendas, mesmo padrão
// já usado em ClientesScreen.jsx).
function FuncionariosScreen({ lang, setLang, staff, setStaff, clients, assignments, onDeleteStaff, onNavigate }) {
  const t = T[lang].funcionarios;
  const ta = T[lang].acessos;
  const c0 = T[lang].common;
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("todos");
  const [openId, setOpenId] = useState(null); // id | "new" | null
  const [mode, setMode] = useState("view"); // "view" | "edit" | "created"
  const [draft, setDraft] = useState(EMPTY_STAFF);
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Passo final "Conta criada" (documento, 4.10) — reusa a MESMA Edge
  // Function já ligada em Acessos (`update-staff-password`), chamada daqui
  // só pra não obrigar a gerência a ir a outro ecrã logo a seguir a criar
  // um funcionário novo com email já definido.
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [createCopied, setCreateCopied] = useState(false);

  const CHIP_FILTERS = {
    todos: () => true,
    fixos: (s) => s.accountType === "fixo",
    replacement: (s) => s.accountType === "replacement",
    supervisores: (s) => s.role === "supervisor",
    inativos: (s) => !isStaffActive(s, TODAY),
  };
  const filtered = staff
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .filter(CHIP_FILTERS[chip]);

  const openStaff = openId && openId !== "new" ? staff.find((s) => s.id === openId) : null;
  const isNew = openId === "new";
  const drawerOpen = openId !== null;

  function openView(s) { setOpenId(s.id); setMode("view"); }
  function openNew() { setDraft(EMPTY_STAFF); setFormErrors({}); setOpenId("new"); setMode("edit"); }
  function startEdit() { setDraft({ ...openStaff, documents: openStaff.documents || [null, null, null, null] }); setFormErrors({}); setMode("edit"); }
  function cancelEdit() { if (isNew) setOpenId(null); else setMode("view"); }
  function closeDrawer() {
    setOpenId(null);
    setCreateResult(null); setCreateError(null); setCreateBusy(false); setCreateCopied(false);
  }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }

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
    if (isNew) {
      const created = { ...draft, id: Date.now() };
      setStaff((prev) => linkPartners([...prev, { ...created, partnerId: null }], created.id, draft.partnerId));
      setOpenId(created.id);
      setCreateResult(null); setCreateError(null);
      // Só oferece o passo "Conta criada" quando há email — sem ele a Edge
      // Function não tem por onde procurar/criar a conta no Auth.
      setMode(created.email && created.email.trim() ? "created" : "view");
    } else {
      const updated = { ...draft, id: openStaff.id };
      setStaff((prev) => linkPartners(prev.map((s) => (s.id === openStaff.id ? updated : s)), openStaff.id, draft.partnerId));
      setMode("view");
    }
  }
  function confirmDelete() {
    onDeleteStaff(openStaff.id);
    setDeleteConfirmOpen(false);
    closeDrawer();
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

  // Documentos — agora guardam {name, dataUrl, validUntil} em vez de só o
  // nome do ficheiro (como já era em ClientesScreen/FuncionariosScreen
  // antes), pra o botão "Ver" do documento (4.9) ter mesmo o que abrir.
  // Continua só-sessão: nunca passou por `dbMappers.js` (confirmado antes
  // de mexer aqui), por isso não há nada a migrar no lado do banco.
  function updateDocField(staffId, slotIndex, patch) {
    setStaff((prev) => prev.map((s) => {
      if (s.id !== staffId) return s;
      const docs = [...(s.documents || [null, null, null, null])];
      docs[slotIndex] = patch === null ? null : { ...(docs[slotIndex] || {}), ...patch };
      return { ...s, documents: docs };
    }));
  }
  function attachDocFile(staffId, slotIndex, file) {
    const reader = new FileReader();
    reader.onload = () => updateDocField(staffId, slotIndex, { name: file.name, dataUrl: reader.result, validUntil: null });
    reader.readAsDataURL(file);
  }

  async function createAccountNow() {
    if (openStaff?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(openStaff.email.trim())) { setCreateError(ta.resetInvalidEmail); return; }
    if (!openStaff?.email || !supabase) { setCreateError(ta.resetFailed); return; }
    setCreateBusy(true); setCreateError(null);
    try {
      const { data, error } = await supabase.functions.invoke("update-staff-password", { body: { email: openStaff.email } });
      if (error || data?.error) throw error || new Error(data.error);
      setCreateResult(data);
    } catch {
      setCreateError(ta.resetFailed);
    } finally {
      setCreateBusy(false);
    }
  }
  async function copyCreateCredentials() {
    if (!createResult) return;
    try {
      await navigator.clipboard.writeText(`${createResult.email} / ${createResult.password}`);
      setCreateCopied(true);
      setTimeout(() => setCreateCopied(false), 1800);
    } catch {
      // clipboard indisponível — as credenciais continuam visíveis na tela.
    }
  }

  const columns = [
    {
      key: "name", label: t.colName, width: 2.2,
      render: (s) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={s.name} size={32} />
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          {s.role === "supervisor" && <SupervisorTag kind="role">{ta.roleSupervisor}</SupervisorTag>}
        </div>
      ),
    },
    { key: "accountType", label: t.colAccountType, width: 1.8, render: (s) => <AccountTypePill s={s} t={t} /> },
    { key: "contact", label: t.colContact, render: (s) => s.contact || "—" },
    { key: "clients", label: t.colClients, width: 0.8, numeric: true, render: (s) => getAssignedClientIds(assignments, s.id).length },
    { key: "status", label: t.colStatus, width: 1.4, render: (s) => <StatusBlock s={s} t={t} c0={c0} /> },
  ];

  const assignedIds = openStaff ? getAssignedClientIds(assignments, openStaff.id) : [];
  const drawerStaff = isNew ? draft : openStaff;
  const drawerExpired = mode === "view" && drawerStaff && !isStaffActive(drawerStaff, TODAY) && isExpiredByValidity(drawerStaff);

  return (
    <div style={styles.content}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(staff.length)}
        lang={lang} setLang={setLang} langNames={LANG_NAMES}
        actions={<Button icon={Plus} onClick={openNew}>{t.newStaff}</Button>}
      />

      <div style={{ marginBottom: 14, maxWidth: 420 }}>
        <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} clearLabel={c0.close} mobile={isMobile} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <FilterChip active={chip === "todos"} onClick={() => setChip("todos")}>{t.chipAll}</FilterChip>
        <FilterChip active={chip === "fixos"} onClick={() => setChip("fixos")}>{t.chipFixed}</FilterChip>
        <FilterChip active={chip === "replacement"} onClick={() => setChip("replacement")}>{t.chipReplacement}</FilterChip>
        <FilterChip active={chip === "supervisores"} onClick={() => setChip("supervisores")}>{t.chipSupervisors}</FilterChip>
        <FilterChip active={chip === "inativos"} onClick={() => setChip("inativos")}>{t.chipInactive}</FilterChip>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={openView}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        batchActions={<Button variant="dangerSolid" onClick={() => setBulkDeleteConfirmOpen(true)}>{t.deleteSelected}</Button>}
        batchLabel={(n) => t.selectedCount(n)}
        emptyMessage={t.noResults}
      />

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        closeLabel={c0.close}
        avatar={(mode === "view" || mode === "created") && drawerStaff ? <Avatar name={drawerStaff.name} size={36} /> : undefined}
        title={mode === "edit" ? (isNew ? t.modalNewTitle : t.modalEditTitle) : mode === "created" ? t.newAccountStepTitle : drawerStaff?.name}
        pill={mode === "view" && drawerStaff ? <StatusBlock s={drawerStaff} t={t} c0={c0} /> : null}
        footer={
          mode === "view" && openStaff ? (
            <>
              <Button variant="secondary" icon={Pencil} onClick={startEdit}>{c0.edit}</Button>
              <Button variant="dangerSoft" onClick={() => setDeleteConfirmOpen(true)}>{c0.delete}</Button>
            </>
          ) : mode === "edit" ? (
            <>
              <Button variant="secondary" onClick={cancelEdit}>{c0.cancel}</Button>
              <Button variant="primary" onClick={saveDraft}>{c0.save}</Button>
            </>
          ) : mode === "created" ? (
            <Button variant="primary" onClick={() => setMode("view")}>{t.newAccountDone}</Button>
          ) : null
        }
      >
        {mode === "view" && openStaff && (
          <>
            {drawerExpired && (
              <Card variant="alert" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "12px 14px" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{t.expiredBanner}</span>
              </Card>
            )}

            <SectionTitle first>{t.sectionContact}</SectionTitle>
            <div style={styles.viewGrid}>
              <ViewField label={t.fContact} full>
                {openStaff.contact ? <a href={`tel:${openStaff.contact}`} style={{ color: COLORS.primary, textDecoration: "underline" }}>{openStaff.contact}</a> : "—"}
              </ViewField>
            </div>

            <SectionTitle>{t.sectionIban}</SectionTitle>
            <MaskedIban iban={openStaff.iban} t={t} />

            <SectionTitle>{t.sectionAccount}</SectionTitle>
            <div style={styles.viewGrid}>
              <ViewField label={t.fAccountType}>{openStaff.accountType === "fixo" ? t.accountFixed : t.accountReplacement}</ViewField>
              {openStaff.accountType === "replacement" && (
                <ViewField label={t.fValidUntil}>{openStaff.validUntil || "-"}</ViewField>
              )}
              <ViewField label={t.fPartner}>{(staff.find((s) => s.id === openStaff.partnerId) || {}).name || t.partnerNone}</ViewField>
              <ViewField label={t.fCanViewAllClients}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ReadOnlyToggle on={!!openStaff.canViewAllClients} />
                  <span>{openStaff.canViewAllClients ? c0.yes : c0.no}</span>
                </div>
              </ViewField>
            </div>

            <SectionTitle>{t.assignedClients}</SectionTitle>
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
            {onNavigate ? (
              <Button variant="ghost" onClick={() => onNavigate("agendas")} style={{ marginTop: 6 }}>{t.assignedNote}</Button>
            ) : (
              <div style={styles.assignedNote}>{t.assignedNote}</div>
            )}

            <SectionTitle>{t.documentsTitle}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {t.docSlots.map((label, idx) => {
                const doc = (openStaff.documents || [])[idx];
                const inputId = `doc-staff-${openStaff.id}-${idx}`;
                const docExpired = doc?.validUntil && daysUntilIso(doc.validUntil) < 0;
                return (
                  <div key={idx} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2 }}>{label}</div>
                      {doc ? (
                        <Pill variant={docExpired ? "missing" : "paid"}>{docExpired ? t.docStatusExpired : t.docStatusSent}</Pill>
                      ) : (
                        <Pill variant="neutral">{t.docStatusMissing}</Pill>
                      )}
                    </div>
                    {doc ? (
                      <>
                        <div style={{ fontSize: 12, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>{doc.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          {doc.dataUrl && (
                            <a href={doc.dataUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, textDecoration: "underline" }}>{t.docView}</a>
                          )}
                          <input type="file" id={inputId} style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) attachDocFile(openStaff.id, idx, e.target.files[0]); }} />
                          <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, cursor: "pointer", textDecoration: "underline" }}>{t.docReplace}</label>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, color: COLORS.ink3, marginBottom: 3 }}>{t.docValidUntil}</div>
                          <input
                            type="date" style={{ ...styles.input, height: 32, fontSize: 12.5 }}
                            value={doc.validUntil || ""}
                            onChange={(e) => updateDocField(openStaff.id, idx, { validUntil: e.target.value || null })}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <input type="file" id={inputId} style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) attachDocFile(openStaff.id, idx, e.target.files[0]); }} />
                        <label htmlFor={inputId} style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 8, border: `1px dashed ${COLORS.line}`, fontSize: 12, fontWeight: 600, color: COLORS.ink2, cursor: "pointer" }}>
                          {t.attach}
                        </label>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 8 }}>{t.docsNote}</div>
            <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 10 }}>{t.loginNote}</div>
          </>
        )}

        {mode === "edit" && (
          <div style={isMobile ? { ...styles.formGrid, gridTemplateColumns: "1fr" } : styles.formGrid}>
            <Field label={t.fName} full required error={formErrors.name ? c0.requiredField : undefined}>
              <input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} />
            </Field>
            {isNew && (
              <Field label={t.fEmailNewOnly} full>
                <input type="email" style={styles.input} value={draft.email} onChange={(e) => updateDraft("email", e.target.value)} />
                <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.emailHintNew}</div>
              </Field>
            )}
            <Field label={t.fContact} required error={formErrors.contact ? c0.requiredField : undefined}>
              <input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} />
            </Field>
            <Field label={t.fIban} required error={formErrors.iban ? c0.requiredField : undefined}>
              <input type="text" style={styles.input} value={draft.iban} onChange={(e) => updateDraft("iban", e.target.value)} placeholder="BE00 0000 0000 0000" />
            </Field>
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
            <Field label={t.fPartner}>
              <select
                style={styles.input} value={draft.partnerId || ""}
                onChange={(e) => updateDraft("partnerId", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t.partnerNone}</option>
                {staff.filter((s) => s.id !== (isNew ? null : openStaff?.id) && s.role !== "gerencia").map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.partnerHint}</div>
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
            {!isNew && <div style={{ ...styles.defSettingHint, gridColumn: "1 / -1" }}>{t.loginNote}</div>}
          </div>
        )}

        {mode === "created" && openStaff && (
          <div>
            <div style={{ fontSize: 13.5, color: COLORS.ink, marginBottom: 16 }}>{t.newAccountIntro(openStaff.name)}</div>
            {openStaff.email ? (
              <>
                <Button onClick={createAccountNow} disabled={createBusy}>
                  {createBusy ? ta.resetBusy : t.newAccountButton}
                </Button>
                {createError && <div style={{ ...styles.defSettingHint, color: COLORS.extra, marginTop: 10 }}>{createError}</div>}
                {createResult && (
                  <div style={{ marginTop: 14, background: COLORS.primaryTint, border: `1px solid ${COLORS.primaryDark}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.primaryDark, marginBottom: 6 }}>
                      {createResult.created ? ta.resetSuccessCreated : ta.resetSuccessUpdated}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 6, wordBreak: "break-all" }}>
                      {createResult.email}<br />{createResult.password}
                    </div>
                    <div style={{ ...styles.defSettingHint, marginBottom: 8 }}>{ta.credentialsWarning}</div>
                    <Button variant="secondary" icon={createCopied ? Check : Copy} onClick={copyCreateCredentials}>
                      {createCopied ? ta.copied : ta.copyCredentials}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noEmailForAccount}</div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen && !!openStaff}
        title={c0.deleteConfirmTitle}
        body={openStaff ? t.confirmDeleteBody(openStaff.name) : ""}
        cancelLabel={c0.cancel}
        confirmLabel={c0.confirmDelete}
        destructive
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        title={c0.deleteConfirmTitle}
        body={t.confirmDeleteBulkBody(selectedIds.size)}
        cancelLabel={c0.cancel}
        confirmLabel={c0.confirmDelete}
        destructive
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}

export default FuncionariosScreen;
