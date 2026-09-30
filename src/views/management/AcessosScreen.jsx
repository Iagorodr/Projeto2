import { useState } from "react";
import { Search, X, Pencil, Mail, ShieldCheck, UsersRound, KeyRound, Copy, Check } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, Field } from "../shared/Layout.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../models/supabaseClient.js";

function RoleBadge({ role, t }) {
  const isSupervisor = role === "supervisor";
  const isGerencia = role === "gerencia";
  const label = isGerencia ? t.roleGerencia : isSupervisor ? t.roleSupervisor : t.roleFuncionario;
  return (
    <span
      style={{
        ...styles.statusBadge,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: isGerencia ? COLORS.extraTint : isSupervisor ? COLORS.primaryTint : COLORS.bg,
        color: isGerencia ? COLORS.extra : isSupervisor ? COLORS.primaryDark : COLORS.textSoft,
      }}
    >
      {(isSupervisor || isGerencia) && <ShieldCheck size={11} />}
      {label}
    </span>
  );
}

function AcessosScreen({ lang, setLang, staff, setStaff }) {
  const t = T[lang].acessos;
  const c0 = T[lang].common;
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const isMobile = useIsMobile();
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  function openEdit(s) {
    setEditingId(s.id);
    setDraft({ email: s.email || "", role: s.role || "funcionario" });
    setResetBusy(false); setResetError(null); setResetResult(null); setCopied(false);
  }
  function closeModal() {
    setEditingId(null); setDraft(null);
    setResetBusy(false); setResetError(null); setResetResult(null); setCopied(false);
  }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function saveDraft() {
    setStaff((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...draft } : s)));
    closeModal();
  }

  // Cria (se ainda não existir) ou redefine a senha de login REAL do
  // funcionário, via Edge Function update-staff-password — ver 4.10/4.11 do
  // documento de design. A função usa o token da sessão atual (gerência) pra
  // se autorizar, e devolve a senha gerada uma única vez.
  async function handleReset() {
    const email = (draft?.email || "").trim();
    if (!email) { setResetError(t.resetNeedsEmail); return; }
    if (!supabase) { setResetError(t.resetFailed); return; }
    setResetBusy(true);
    setResetError(null);
    setResetResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("update-staff-password", {
        body: { email },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setResetResult(data);
      // mantém staff.email sincronizado mesmo que o draft ainda não tivesse sido guardado
      setStaff((prev) => prev.map((s) => (s.id === editingId ? { ...s, email } : s)));
    } catch {
      setResetError(t.resetFailed);
    } finally {
      setResetBusy(false);
    }
  }

  async function copyCredentials() {
    if (!resetResult) return;
    const text = `${resetResult.email} / ${resetResult.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponível — a senha continua visível na tela para copiar à mão
    }
  }

  const editingStaff = editingId ? staff.find((s) => s.id === editingId) : null;

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />

      <div style={{ fontSize: 13, color: COLORS.textSoft, marginBottom: 16, maxWidth: 640 }}>{t.subtitle}</div>

      <div style={styles.toolbar}>
        <div style={isMobile ? { ...styles.searchWrap, width: "100%" } : styles.searchWrap}>
          <Search size={16} color={COLORS.textSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={styles.searchInput} />
        </div>
      </div>

      <div style={isMobile ? { ...styles.tableWrap, overflowX: "auto" } : styles.tableWrap}>
        <div style={styles.tableHeaderRow}>
          <div style={{ ...styles.th, flex: 2 }}>{t.colName}</div>
          <div style={{ ...styles.th, flex: 2.2 }}>{t.colEmail}</div>
          <div style={{ ...styles.th, flex: 1 }}>{t.colRole}</div>
        </div>
        {filtered.length === 0 ? (
          <div style={styles.noResults}>{t.noResults}</div>
        ) : (
          filtered.map((s) => (
            <button key={s.id} style={styles.tableRow} onClick={() => openEdit(s)}>
              <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{s.name}</div>
              <div style={{ ...styles.td, flex: 2.2 }}>{s.email}</div>
              <div style={{ ...styles.td, flex: 1 }}><RoleBadge role={s.role} t={t} /></div>
            </button>
          ))
        )}
      </div>

      {editingId && editingStaff && draft && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={{ ...styles.modalCard, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.viewTitleRow}>
                <div style={styles.viewIconCircle}><UsersRound size={18} color={COLORS.primaryDark} /></div>
                <div>
                  <div style={styles.modalTitle}>{editingStaff.name}</div>
                  <RoleBadge role={draft.role} t={t} />
                </div>
              </div>
              <button style={styles.modalClose} onClick={closeModal}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label={t.fEmail} full>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={14} color={COLORS.textSoft} />
                  <input style={styles.input} value={draft.email} onChange={(e) => updateDraft("email", e.target.value)} />
                </div>
              </Field>
              <Field label={t.fRole} full>
                <select style={styles.input} value={draft.role} onChange={(e) => updateDraft("role", e.target.value)}>
                  <option value="funcionario">{t.roleFuncionario}</option>
                  <option value="supervisor">{t.roleSupervisor}</option>
                  <option value="gerencia">{t.roleGerencia}</option>
                </select>
              </Field>
              {draft.role === "gerencia" && (
                <div style={{ ...styles.defSettingHint, marginTop: -6 }}>{t.gerenciaHint}</div>
              )}

              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                <div style={styles.defSettingLabel}>{t.accessSectionLabel}</div>
                <button
                  type="button"
                  style={{ ...styles.editButton, opacity: resetBusy ? 0.6 : 1 }}
                  onClick={handleReset}
                  disabled={resetBusy}
                >
                  <KeyRound size={13} style={{ marginRight: 6 }} />
                  {resetBusy ? t.resetBusy : t.resetButton}
                </button>
                {resetError && (
                  <div style={{ ...styles.defSettingHint, color: COLORS.extra, marginTop: 8 }}>{resetError}</div>
                )}
                {resetResult && (
                  <div style={{ marginTop: 10, background: COLORS.primaryTint, border: `1px solid ${COLORS.primaryDark}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.primaryDark, marginBottom: 6 }}>
                      {resetResult.created ? t.resetSuccessCreated : t.resetSuccessUpdated}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 6, wordBreak: "break-all" }}>
                      {resetResult.email}<br />{resetResult.password}
                    </div>
                    <div style={{ ...styles.defSettingHint, marginBottom: 8 }}>{t.credentialsWarning}</div>
                    <button type="button" style={styles.editButton} onClick={copyCredentials}>
                      {copied ? <Check size={13} style={{ marginRight: 6 }} /> : <Copy size={13} style={{ marginRight: 6 }} />}
                      {copied ? t.copied : t.copyCredentials}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={closeModal}>{c0.cancel}</button>
              <button style={styles.saveButton} onClick={saveDraft}>{c0.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AcessosScreen;
