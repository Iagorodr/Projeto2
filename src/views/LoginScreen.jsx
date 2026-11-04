import { isSupervisorRole } from "../models/utils.js";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { RADIUS, FONT } from "../styles/tokens.js";
import { InstallAppButton } from "./shared/Layout.jsx";
import { Button } from "./shared/ui/index.js";
import { AuthShell, LoginLogo, authInputStyle as inputStyle } from "./shared/AuthShell.jsx";
import { T } from "../models/i18n.js";
import { isSupabaseConfigured } from "../models/supabaseClient.js";
import { Avatar } from "./shared/ui/Avatar.jsx";

const ERROR_KEY_BY_CODE = {
  invalid_credentials: "errorInvalidCredentials",
  no_account: "errorNoAccount",
  inactive_account: "errorInactiveAccount",
  wrong_company: "errorWrongCompany",
  idle_logout: "errorIdleLogout",
  generic: "errorGeneric",
};

// Badge da empresa — nome + iniciais no avatar, exibido no topo do ecrã 2.
function CompanyBadge({ companyCode, companyName, onChangeCompany, changeLabel }) {
  const name = companyName || companyCode || "";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      background: "var(--p1-8)", borderRadius: 14, marginBottom: 8,
    }}>
      <Avatar name={name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
      </div>
      {onChangeCompany && (
        <button
          type="button" onClick={onChangeCompany}
          style={{
            border: "none", background: "transparent", cursor: "pointer", color: "var(--p1)",
            fontSize: 13, fontWeight: 700, padding: "6px 0", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          {changeLabel}
        </button>
      )}
    </div>
  );
}

function LoginScreen({ lang, setLang, onEnterManagement, onEnterEmployee, onLoginWithPassword, onRequestPasswordReset, authLoading, authError, company, staff, companyCode, onChangeCompany }) {
  const t = T[lang].login;
  const tc = T[lang].company;
  const [mode, setMode] = useState("gerencia");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [resetState, setResetState] = useState(null);

  async function sendReset() {
    if (!email.trim()) { setResetState("needEmail"); return; }
    setResetState("sending");
    const ok = await onRequestPasswordReset(email.trim());
    setResetState(ok ? "sent" : "failed");
  }

  function submitRealLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password || authLoading) return;
    onLoginWithPassword(email.trim(), password);
  }

  return (
    <AuthShell lang={lang} setLang={setLang} tagline={tc.gateTagline} subtitle={tc.gateSubtitle}>
        <LoginLogo />

        {isSupabaseConfigured && companyCode ? (
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            <CompanyBadge
              companyCode={companyCode} companyName={company?.name}
              onChangeCompany={onChangeCompany} changeLabel={tc.changeCompany}
            />
          </div>
        ) : (
          <div style={{ fontSize: 14, color: COLORS.ink2, marginTop: 16, marginBottom: 20, fontWeight: 500 }}>{company.name}</div>
        )}

        {isSupabaseConfigured ? (
          <form onSubmit={submitRealLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder} style={inputStyle} type="email" autoComplete="username"
            />
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder} style={{ ...inputStyle, paddingRight: 44 }} autoComplete="current-password"
              />
              <button
                type="button" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.ink3, borderRadius: 10,
                }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {authError && (
              <div style={authError === "idle_logout"
                ? { background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600 }
                : { background: COLORS.alertTint, color: COLORS.alert, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}
              >
                {t[ERROR_KEY_BY_CODE[authError]] || t.errorGeneric}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--p1)", fontSize: 13, fontWeight: 700, padding: "8px 0", textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 4, fontFamily: "inherit" }}
              >
                {t.forgotPassword}
              </button>
            </div>
            {showForgotHelp && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: COLORS.ink2, lineHeight: 1.5 }}>
                {t.forgotPasswordHelp}
                <div style={{ marginTop: 10 }}>
                  <Button type="button" variant="secondary" disabled={resetState === "sending"} onClick={sendReset} style={{ height: 44, width: "100%", fontSize: 13 }}>
                    {resetState === "sending" ? t.resetSending : t.resetSend}
                  </Button>
                </div>
                {resetState && resetState !== "sending" && (
                  <div style={{ marginTop: 8, fontWeight: 600, color: resetState === "sent" ? COLORS.forest700 : COLORS.alert }}>
                    {resetState === "sent" ? t.resetSent : resetState === "needEmail" ? t.resetEmailRequired : t.resetFailed}
                  </div>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" disabled={authLoading} style={{ height: 52, width: "100%", marginTop: 4, fontSize: 15 }}>
              {authLoading ? t.entering : t.enter}
            </Button>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant={mode === "gerencia" ? "primary" : "secondary"} style={{ flex: 1, height: 44 }} onClick={() => setMode("gerencia")}>
                {t.isManagement}
              </Button>
              <Button variant={mode === "funcionario" ? "primary" : "secondary"} style={{ flex: 1, height: 44 }} onClick={() => setMode("funcionario")}>
                {t.isEmployee}
              </Button>
            </div>

            {mode === "gerencia" ? (
              <>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} style={inputStyle} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} style={inputStyle} />
                <Button variant="primary" onClick={onEnterManagement} style={{ height: 52, width: "100%", marginTop: 4 }}>{t.enter}</Button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: COLORS.ink3, marginBottom: 2 }}>{t.chooseWho}</div>
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onEnterEmployee(s.id)}
                    style={{
                      textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 14,
                      background: "#fff", padding: "12px 16px", fontSize: 14, color: COLORS.ink, cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {s.name}
                    {isSupervisorRole(s.role) && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--p1)" }}>{t.supervisorTag}</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <InstallAppButton lang={lang} />
        </div>
    </AuthShell>
  );
}

export default LoginScreen;
