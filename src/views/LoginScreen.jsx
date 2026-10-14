import { isSupervisorRole } from "../models/utils.js";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { RADIUS } from "../styles/tokens.js";
import { InstallAppButton } from "./shared/Layout.jsx";
import { Button } from "./shared/ui/index.js";
import { AuthShell, LoginLogo, authInputStyle as inputStyle } from "./shared/AuthShell.jsx";
import { T } from "../models/i18n.js";
import { isSupabaseConfigured } from "../models/supabaseClient.js";

const ERROR_KEY_BY_CODE = {
  invalid_credentials: "errorInvalidCredentials",
  no_account: "errorNoAccount",
  inactive_account: "errorInactiveAccount",
  wrong_company: "errorWrongCompany",
  idle_logout: "errorIdleLogout",
  generic: "errorGeneric",
};

// Início de sessão (documento de design, 4.12) — cartão centrado (420)
// sobre fundo #E2EBE7 com brilho radial clay bem leve, logótipo novo,
// campos com tokens/componentes da Etapa 2. "Sem mais alterações de
// fluxo": a branch `isSupabaseConfigured` (login real) e o modo de
// demonstração (toggle Gerência/Funcionário) continuam exatamente como
// estavam — só a casca visual muda.
//
// QA (achado do Iago, 2ª volta): a 1ª correção (ver histórico) trocou a
// cor lisa por um `linear-gradient`, mas os tons escolhidos (#EDF4F1 ->
// #CBDDD3) eram perto demais uns dos outros — na prática continuava
// parecendo uma cor quase lisa, "muito opaco sem as cores". Também
// faltava o `body { margin: 0 }` global (ver index.css) — o
// user-agent stylesheet do browser dá 8px de margem ao `body` por
// padrão, então o fundo (mesmo cobrindo `100vh`) nunca chegava às
// bordas reais da janela, sobrando uma faixa branca à volta. Esta volta:
// gradiente com tons bem mais afastados entre si (de um verde-menta
// quase branco até um forest-500 saturado, mesma família do
// `AppSidebar.jsx`) pra ter profundidade/cor de verdade, e dois brilhos
// radiais (clay no topo, forest escuro no canto oposto) em vez de um só
// — eco dos dois tons da marca (verde + clay) em vez de só um ponto de
// luz.
function LoginScreen({ lang, setLang, onEnterManagement, onEnterEmployee, onLoginWithPassword, onRequestPasswordReset, authLoading, authError, company, staff, companyCode, onChangeCompany }) {
  const t = T[lang].login;
  const tc = T[lang].company;
  const [mode, setMode] = useState("gerencia"); // 'gerencia' | 'funcionario' — só usado no modo de demonstração
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [resetState, setResetState] = useState(null); // null | "sending" | "sent" | "failed" | "needEmail"

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
    <AuthShell lang={lang} setLang={setLang}>
        <LoginLogo />
        {isSupabaseConfigured && companyCode ? (
          // Várias empresas: mostra a empresa escolhida no ecrã do código e deixa trocá-la.
          <div style={{ marginTop: 14, marginBottom: 26, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 10px", fontSize: 13.5, color: COLORS.ink2 }}>
            <span>{tc.currentCompany}: <strong style={{ color: COLORS.ink }}>{companyCode}</strong></span>
            {onChangeCompany && (
              <button
                type="button" onClick={onChangeCompany}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.vivo, fontSize: 13, fontWeight: 600, padding: "6px 0", textDecoration: "underline", textUnderlineOffset: 3, fontFamily: "inherit" }}
              >
                {tc.changeCompany}
              </button>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: COLORS.ink2, marginTop: 14, marginBottom: 26 }}>{company.name}</div>
        )}

        {isSupabaseConfigured ? (
          <form onSubmit={submitRealLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder} style={inputStyle} type="email" autoComplete="username"
            />
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder} style={{ ...inputStyle, paddingRight: 40 }} autoComplete="current-password"
              />
              <button
                type="button" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.ink3,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {authError && (
              <div style={authError === "idle_logout"
                ? { background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }
                : { background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}
              >
                {t[ERROR_KEY_BY_CODE[authError]] || t.errorGeneric}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.vivo, fontSize: 13, fontWeight: 600, padding: "10px 0", textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 4, fontFamily: "inherit" }}
              >
                {t.forgotPassword}
              </button>
            </div>
            {showForgotHelp && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>
                {t.forgotPasswordHelp}
                <div style={{ marginTop: 10 }}>
                  <Button type="button" variant="secondary" disabled={resetState === "sending"} onClick={sendReset} style={{ height: 40, width: "100%", fontSize: 13 }}>
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

            <Button type="submit" variant="primary" disabled={authLoading} style={{ height: 52, width: "100%", marginTop: 4, fontSize: 14 }}>
              {authLoading ? t.entering : t.enter}
            </Button>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant={mode === "gerencia" ? "primary" : "secondary"} style={{ flex: 1, height: 40 }} onClick={() => setMode("gerencia")}>
                {t.isManagement}
              </Button>
              <Button variant={mode === "funcionario" ? "primary" : "secondary"} style={{ flex: 1, height: 40 }} onClick={() => setMode("funcionario")}>
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
                <div style={{ fontSize: 12, color: COLORS.ink3, marginBottom: 2 }}>{t.chooseWho}</div>
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onEnterEmployee(s.id)}
                    style={{
                      textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control,
                      background: COLORS.card, padding: "10px 14px", fontSize: 13.5, color: COLORS.ink, cursor: "pointer",
                    }}
                  >
                    {s.name}
                    {isSupervisorRole(s.role) && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: COLORS.forest700 }}>{t.supervisorTag}</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
          <InstallAppButton lang={lang} />
        </div>
    </AuthShell>
  );
}

export default LoginScreen;
