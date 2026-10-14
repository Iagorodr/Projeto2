// Página de administração da plataforma (/admin): ver, criar, renovar e
// suspender as empresas (clientes do Servix). Só para o dono da plataforma —
// por isso é só em português e não passa pelo código de empresa do app.
// Tudo o que importa é decidido no banco (multi_empresa_admin.sql): esta página
// só mostra o que as funções devolvem a uma conta de administração.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, LogOut, Search } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { Button } from "../shared/ui/index.js";
import { AuthShell, LoginLogo, authInputStyle } from "../shared/AuthShell.jsx";
import { Dialog } from "./AdminUi.jsx";
import CompanyCard from "./CompanyCard.jsx";
import CompanyFormDialog from "./CompanyFormDialog.jsx";
import DeliveryDialog from "./DeliveryDialog.jsx";
import { adminClient, adminConfigured } from "../../models/adminClient.js";
import { isMissingRpc } from "../../models/horasSync.js";
import { FILTERS, filterCompanies, sortCompanies, errorMessage, accessLink, formatIsoDate } from "../../models/adminCompanies.js";

// Pede à Edge Function a palavra-passe temporária da gerência de uma empresa.
async function fetchManagerLogin(email) {
  const { data, error } = await adminClient.functions.invoke("admin-company-login", { body: { email } });
  if (error) {
    let detail = "";
    try { const j = await error.context.json(); detail = j.detail ? `${j.error}: ${j.detail}` : j.error; } catch { /* sem corpo */ }
    if (!detail) detail = /not found|404/i.test(error.message || "") ? "a função admin-company-login ainda não está publicada neste projeto" : (error.message || "erro desconhecido");
    throw new Error(detail === "forbidden" ? errorMessage("forbidden") : detail);
  }
  if (!data?.password) throw new Error("a função não devolveu a palavra-passe");
  return data;
}

function AdminLogin({ onSubmit, busy, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <AuthShell lang="pt" setLang={() => {}} cardStyle={{ width: 400 }}>
      <LoginLogo />
      <div style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, color: COLORS.ink, margin: "18px 0 4px" }}>Administração</div>
      <div style={{ fontSize: 13.5, color: COLORS.ink2, marginBottom: 18 }}>Só para a conta de administração do Servix.</div>
      <form onSubmit={(e) => { e.preventDefault(); if (email.trim() && password && !busy) onSubmit(email.trim(), password); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail" type="email" autoComplete="username" style={authInputStyle} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="palavra-passe" type="password" autoComplete="current-password" style={authInputStyle} />
        {error && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
        <Button type="submit" variant="primary" disabled={busy} style={{ height: 50, width: "100%" }}>{busy ? "A entrar..." : "Entrar"}</Button>
      </form>
    </AuthShell>
  );
}

export default function AdminApp() {
  const [phase, setPhase] = useState("loading"); // loading | login | ready
  const [adminEmail, setAdminEmail] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [listError, setListError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);         // null | { mode: "create" } | { mode: "edit", company }
  const [delivery, setDelivery] = useState(null); // null | { company, email, password?, error? }
  const [confirm, setConfirm] = useState(null);   // null | { title, text, label, danger, onConfirm }

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4500);
  }, []);

  const loadCompanies = useCallback(async () => {
    const { data, error } = await adminClient.rpc("admin_list_companies");
    if (error) {
      setListError(isMissingRpc(error) ? "O SQL da administração (multi_empresa_admin.sql) ainda não foi aplicado neste projeto." : errorMessage(error));
      return false;
    }
    setListError(null);
    setCompanies(Array.isArray(data) ? data : []);
    return true;
  }, []);

  // Confirma que a conta é de administração e só então carrega a lista.
  const admit = useCallback(async (email) => {
    const { data, error } = await adminClient.rpc("is_platform_admin");
    if (error || data !== true) {
      await adminClient.auth.signOut();
      return isMissingRpc(error) ? "O SQL da administração ainda não foi aplicado neste projeto." : "Esta conta não tem acesso à administração.";
    }
    setAdminEmail(email);
    await loadCompanies();
    setPhase("ready");
    return null;
  }, [loadCompanies]);

  useEffect(() => {
    if (!adminConfigured) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await adminClient.auth.getSession();
      if (cancelled) return;
      if (!session) { setPhase("login"); return; }
      const err = await admit(session.user.email);
      if (!cancelled && err) { setLoginError(err); setPhase("login"); }
    })();
    return () => { cancelled = true; };
  }, [admit]);

  async function login(email, password) {
    setBusy(true); setLoginError(null);
    try {
      const { data, error } = await adminClient.auth.signInWithPassword({ email, password });
      if (error) { setLoginError(error.message === "Invalid login credentials" ? "E-mail ou palavra-passe incorretos." : "Não foi possível entrar. Tente novamente."); return; }
      const err = await admit(data.user.email);
      if (err) setLoginError(err);
    } finally { setBusy(false); }
  }

  async function logout() {
    await adminClient.auth.signOut();
    setCompanies([]); setPhase("login");
  }

  // Executa uma ação com o botão "ocupado" e mostra o erro (se houver).
  async function run(fn) {
    setBusy(true);
    try { return await fn(); } catch (err) { notify(errorMessage(err)); return null; } finally { setBusy(false); }
  }

  const replaceCompany = (updated) => setCompanies((list) => list.map((c) => (c.id === updated.id ? updated : c)));

  async function updateCompany(id, patch) {
    const { data, error } = await adminClient.rpc("admin_update_company", { p_id: id, p_patch: patch });
    if (error) throw error;
    replaceCompany(data);
    return data;
  }

  async function createCompany(v) {
    const { data, error } = await adminClient.rpc("admin_create_company", {
      p_code: v.code, p_name: v.name, p_manager_email: v.managerEmail, p_valid_until: v.validUntil, p_timezone: v.timezone, p_notes: v.notes || null,
    });
    if (error) return errorMessage(error);
    setCompanies((list) => [...list, data]);
    setForm(null);
    // A empresa existe: gera a palavra-passe temporária da gerência.
    try {
      const login = await fetchManagerLogin(v.managerEmail);
      setDelivery({ company: data, email: login.email, password: login.password });
    } catch (err) {
      setDelivery({ company: data, email: v.managerEmail, error: err.message });
    }
    return null;
  }

  async function editCompany(company, v) {
    try {
      await updateCompany(company.id, { name: v.name, code: v.code, validUntil: v.validUntil, timezone: v.timezone, notes: v.notes });
      setForm(null);
      notify("Alterações guardadas.");
      return null;
    } catch (err) { return errorMessage(err); }
  }

  const renew = (c, months, to) => run(async () => {
    await updateCompany(c.id, { validUntil: to });
    notify(`${c.name}: renovada +${months} ${months === 1 ? "mês" : "meses"}, até ${formatIsoDate(to)}.${c.suspended ? " Atenção: continua suspensa." : ""}`);
  });

  const toggleSuspend = (c) => setConfirm(c.suspended
    ? { title: `Reativar ${c.name}?`, text: "A equipa volta a poder entrar (conforme a validade).", label: "Reativar", onConfirm: () => run(async () => { await updateCompany(c.id, { suspended: false }); notify(`${c.name} reativada.`); }) }
    : { title: `Suspender ${c.name}?`, text: "Ninguém da empresa consegue entrar até a reativar. Os dados ficam guardados.", label: "Suspender", danger: true, onConfirm: () => run(async () => { await updateCompany(c.id, { suspended: true }); notify(`${c.name} suspensa.`); }) });

  const resetLogin = (c) => setConfirm({
    title: `Nova senha para ${c.name}?`,
    text: `Gera uma palavra-passe temporária para ${c.managerEmail}. A atual deixa de funcionar e a gerência terá de escolher outra no próximo login.`,
    label: "Gerar nova senha",
    onConfirm: () => run(async () => {
      try { const l = await fetchManagerLogin(c.managerEmail); setDelivery({ company: c, email: l.email, password: l.password }); }
      catch (err) { notify(`Não foi possível gerar a senha: ${err.message}`); }
    }),
  });

  async function copyLink(c) {
    const link = accessLink(window.location.origin, c.code);
    try { await navigator.clipboard.writeText(link); notify(`Link copiado: ${link}`); } catch { notify(link); }
  }

  const sorted = useMemo(() => sortCompanies(companies), [companies]);
  const visible = useMemo(() => filterCompanies(sorted, filter, query), [sorted, filter, query]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, companies.filter(f.test).length])), [companies]);

  if (!adminConfigured) {
    return <div style={{ padding: 32, fontFamily: FONT.body }}>O Supabase não está configurado neste ambiente (faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).</div>;
  }
  if (phase === "loading") return <div style={{ padding: 32, fontFamily: FONT.body, color: COLORS.ink2 }}>A carregar…</div>;
  if (phase === "login") return <AdminLogin onSubmit={login} busy={busy} error={loginError} />;

  return (
    <div style={{ minHeight: "100dvh", background: COLORS.page, fontFamily: FONT.body, color: COLORS.ink }}>
      <header style={{ background: COLORS.navGradient, color: COLORS.navText, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 18 }}>Servix <span style={{ color: COLORS.navIconActive }}>·</span> Administração</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <span style={{ opacity: 0.85, overflowWrap: "anywhere" }}>{adminEmail}</span>
          <button type="button" onClick={() => run(loadCompanies)} disabled={busy} aria-label="Atualizar" style={headerBtn}><RefreshCw size={16} /> Atualizar</button>
          <button type="button" onClick={logout} style={headerBtn}><LogOut size={16} /> Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 60px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 24, fontWeight: 600 }}>Empresas <span style={{ color: COLORS.ink3, fontWeight: 500, fontSize: 18 }}>({companies.length})</span></div>
          <Button type="button" variant="primary" onClick={() => setForm({ mode: "create" })} icon={Plus}>Nova empresa</Button>
        </div>

        {listError && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{listError}</div>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
                style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? COLORS.vivo : COLORS.line}`, background: on ? COLORS.vivo : COLORS.card, color: on ? "#fff" : COLORS.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {f.label} <span style={{ opacity: 0.75 }}>{counts[f.key]}</span>
              </button>
            );
          })}
          <div style={{ position: "relative", marginLeft: "auto", minWidth: 220, flex: "0 1 280px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: COLORS.ink3 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, código ou e-mail" aria-label="Buscar empresas" style={{ ...authInputStyle, height: 40, paddingLeft: 34, borderRadius: 999 }} />
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.card, padding: 32, textAlign: "center", color: COLORS.ink3, fontSize: 14 }}>
            {companies.length === 0 ? "Ainda não há empresas. Crie a primeira em “Nova empresa”." : "Nenhuma empresa neste filtro."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 14 }}>
            {visible.map((c) => (
              <CompanyCard key={c.id} company={c} busy={busy} onRenew={renew} onEdit={(co) => setForm({ mode: "edit", company: co })} onCopyLink={copyLink} onResetLogin={resetLogin} onToggleSuspend={toggleSuspend} />
            ))}
          </div>
        )}
      </main>

      {form && (
        <CompanyFormDialog
          mode={form.mode} company={form.company} onClose={() => setForm(null)}
          onSubmit={(v) => (form.mode === "create" ? createCompany(v) : editCompany(form.company, v))}
        />
      )}
      {delivery && <DeliveryDialog delivery={delivery} onClose={() => setDelivery(null)} notify={notify} />}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)} width={440}>
          <div style={{ fontSize: 14, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 18 }}>{confirm.text}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button type="button" variant={confirm.danger ? "dangerSolid" : "primary"} onClick={() => { const fn = confirm.onConfirm; setConfirm(null); fn(); }}>{confirm.label}</Button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", maxWidth: "calc(100% - 32px)", background: COLORS.forest900, color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, zIndex: 60, overflowWrap: "anywhere" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const headerBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)",
  background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
