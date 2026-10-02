import { useState } from "react";
import { Mail, KeyRound, Copy, Check, ShieldAlert } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { Field } from "../shared/Layout.jsx";
import {
  PageHeader, SearchField, DataTable, Avatar, Pill, SupervisorTag, Drawer, Button, ConfirmDialog,
} from "../shared/ui/index.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../models/supabaseClient.js";

// Etiqueta de papel (documento, 4.10, linha da tabela): "Funcionário"
// neutro, "Supervisor" reaproveita o mesmo `SupervisorTag` já usado em
// Funcionários/Agendas (duas semânticas, doc 2.3 — este é kind="role"),
// "Gerência" em forest-800 — a variante `owed` do Pill já é
// {bg: forest100, ink: forest800}, exatamente a cor pedida aqui, por isso
// é reaproveitada em vez de inventar uma variante nova só para isto.
function RoleTag({ role, t }) {
  if (role === "supervisor") return <SupervisorTag kind="role">{t.roleSupervisor}</SupervisorTag>;
  if (role === "gerencia") return <Pill variant="owed">{t.roleGerencia}</Pill>;
  return <Pill variant="neutral">{t.roleFuncionario}</Pill>;
}

// Diálogo de redefinir/criar acesso (documento, 4.10): ação própria da
// linha da tabela ("ação 'Redefinir'"), separada da gaveta de
// email/papel. Mesmo padrão visual do `ConfirmDialog` (2.10: 420,
// centrado) mas com um terceiro estado — resultado com as credenciais,
// mostradas uma única vez — por isso é um componente pequeno e próprio
// aqui, em vez de forçar esse terceiro estado dentro do `ConfirmDialog`
// genérico (que só conhece confirmar/cancelar).
function ResetDialog({ open, staffMember, t, c0, onClose, onConfirm, busy, error, result, copied, onCopy }) {
  if (!open || !staffMember) return null;
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={result ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, width: 420, maxWidth: "100%", borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box" }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>
          {result ? (result.created ? t.resetSuccessCreated : t.resetSuccessUpdated) : t.resetConfirmTitle}
        </div>

        {!result && (
          <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 22 }}>
            {t.resetConfirmBody(staffMember.name)}
          </div>
        )}

        {error && <div style={{ fontSize: 12.5, color: COLORS.alert, marginBottom: 14 }}>{error}</div>}

        {result && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 13.5, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, wordBreak: "break-all", marginBottom: 8 }}>
              {result.email}<br />{result.password}
            </div>
            <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.credentialsWarning}</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {result ? (
            <>
              <Button variant="secondary" icon={copied ? Check : Copy} onClick={onCopy}>{copied ? t.copied : t.copyCredentials}</Button>
              <Button variant="primary" onClick={onClose}>{c0.close}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={busy}>{c0.cancel}</Button>
              <Button variant="primary" icon={KeyRound} onClick={onConfirm} disabled={busy}>{busy ? t.resetBusy : t.resetButton}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Acessos (documento de design, 4.10) — segurança real já construída na
// Etapa 0b (Edge Function `update-staff-password`, RLS, sem mais colunas
// de palavra-passe em texto simples); o que falta aqui é só o redesign
// visual: tabela com `DataTable`, gaveta pequena (420) só pra email/papel
// (a criação de conta, com email novo, passou pra Funcionários — 4.9),
// ação "Redefinir" por linha com o seu próprio diálogo, e confirmação
// escrita ao escolher o papel "Gerência".
function AcessosScreen({ lang, setLang, staff, setStaff }) {
  const t = T[lang].acessos;
  const c0 = T[lang].common;
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");

  // Gaveta pequena de edição (email + papel).
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pendingGerencia, setPendingGerencia] = useState(false);

  // Diálogo de redefinir/criar acesso — independente da gaveta de edição.
  const [resetTargetId, setResetTargetId] = useState(null);
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
    setPendingGerencia(false);
  }
  function closeEdit() {
    setEditingId(null); setDraft(null); setPendingGerencia(false);
  }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }
  function onRoleChange(value) {
    // "Escolher Gerência abre confirmação escrita" (4.10): a troca só
    // entra no rascunho depois de confirmada; cancelar deixa o <select>
    // como estava (controlado por `draft.role`, que não muda).
    if (value === "gerencia" && draft.role !== "gerencia") { setPendingGerencia(true); return; }
    updateDraft("role", value);
  }
  function saveDraft() {
    setStaff((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...draft } : s)));
    closeEdit();
  }

  function openReset(s) {
    setResetTargetId(s.id);
    setResetBusy(false); setResetError(null); setResetResult(null); setCopied(false);
  }
  function closeReset() {
    setResetTargetId(null);
    setResetBusy(false); setResetError(null); setResetResult(null); setCopied(false);
  }

  // Cria (se ainda não existir) ou redefine a senha de login REAL do
  // funcionário, via Edge Function update-staff-password — ver 4.10 do
  // documento de design. A função usa o token da sessão atual (gerência)
  // pra se autorizar, e devolve a senha gerada uma única vez.
  async function handleReset() {
    const target = staff.find((s) => s.id === resetTargetId);
    const email = (target?.email || "").trim();
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
  const resetTargetStaff = resetTargetId ? staff.find((s) => s.id === resetTargetId) : null;

  const columns = [
    {
      key: "name", label: t.colName, width: 2,
      render: (s) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={s.name} size={32} />
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
        </div>
      ),
    },
    { key: "email", label: t.colEmail, width: 2.2, render: (s) => s.email || "—" },
    { key: "role", label: t.colRole, width: 1.2, render: (s) => <RoleTag role={s.role} t={t} /> },
    {
      key: "actions", label: "", width: 1.2,
      render: (s) => (
        <Button
          variant="ghost"
          icon={KeyRound}
          onClick={(ev) => { ev.stopPropagation(); openReset(s); }}
        >
          {t.resetButton}
        </Button>
      ),
    },
  ];

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <div style={{ marginBottom: 18, maxWidth: 420 }}>
        <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} clearLabel={c0.close} mobile={isMobile} />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={openEdit}
        emptyMessage={t.noResults}
      />

      <Drawer
        open={!!(editingId && editingStaff && draft)}
        onClose={closeEdit}
        width={420}
        closeLabel={c0.close}
        avatar={editingStaff ? <Avatar name={editingStaff.name} size={36} /> : undefined}
        title={editingStaff?.name}
        pill={draft ? <RoleTag role={draft.role} t={t} /> : null}
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit}>{c0.cancel}</Button>
            <Button variant="primary" onClick={saveDraft}>{c0.save}</Button>
          </>
        }
      >
        {editingStaff && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label={t.fEmail} full>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} color={COLORS.ink3} />
                <input style={styles.input} type="email" value={draft.email} onChange={(e) => updateDraft("email", e.target.value)} />
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.emailChangeHint}</div>
            </Field>
            <Field label={t.fRole} full>
              <select style={styles.input} value={draft.role} onChange={(e) => onRoleChange(e.target.value)}>
                <option value="funcionario">{t.roleFuncionario}</option>
                <option value="supervisor">{t.roleSupervisor}</option>
                <option value="gerencia">{t.roleGerencia}</option>
              </select>
            </Field>
            {draft.role === "gerencia" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: COLORS.ink3, background: COLORS.bg, borderRadius: 10, padding: "10px 12px" }}>
                <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {t.gerenciaHint}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={pendingGerencia}
        title={t.gerenciaConfirmTitle}
        body={t.gerenciaConfirmBody}
        cancelLabel={c0.cancel}
        confirmLabel={c0.save}
        onCancel={() => setPendingGerencia(false)}
        onConfirm={() => { updateDraft("role", "gerencia"); setPendingGerencia(false); }}
      />

      <ResetDialog
        open={!!resetTargetId}
        staffMember={resetTargetStaff}
        t={t}
        c0={c0}
        onClose={closeReset}
        onConfirm={handleReset}
        busy={resetBusy}
        error={resetError}
        result={resetResult}
        copied={copied}
        onCopy={copyCredentials}
      />
    </div>
  );
}

export default AcessosScreen;
