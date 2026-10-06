import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { RADIUS, SHADOW, FONT } from "../styles/tokens.js";
import { LangSwitcher, InstallAppButton } from "./shared/Layout.jsx";
import { Button } from "./shared/ui/index.js";
import { T } from "../models/i18n.js";
import { isSupabaseConfigured } from "../models/supabaseClient.js";

const ERROR_KEY_BY_CODE = {
  invalid_credentials: "errorInvalidCredentials",
  no_account: "errorNoAccount",
  generic: "errorGeneric",
};

// Logótipo do ecrã de início de sessão (documento, 4.12): "bloco 34
// forest-600 com ✓ + 'Servi' em forest-800 e 'x' em clay" — marca nova,
// mais simples que o `LogoLockup`/`LogoMark` já existente (Logo.jsx, duas
// cores/dois traços, pensado pro painel escuro do desenho antigo). Fica só
// aqui por agora; se isto virar a marca única do produto, LogoLockup pode
// ser substituído por este bloco mais tarde.
function LoginLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.forest600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 13 L9.5 18.5 L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 21, color: COLORS.forest800, lineHeight: 1 }}>
        Servi<span style={{ color: COLORS.clay }}>x</span>
      </span>
    </div>
  );
}

const inputStyle = {
  width: "100%", height: 44, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`,
  padding: "0 14px", fontSize: 14, color: COLORS.ink, background: COLORS.card, boxSizing: "border-box",
  fontFamily: "inherit",
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
function LoginScreen({ lang, setLang, onEnterManagement, onEnterEmployee, onLoginWithPassword, authLoading, authError, company, staff }) {
  const t = T[lang].login;
  const [mode, setMode] = useState("gerencia"); // 'gerencia' | 'funcionario' — só usado no modo de demonstração
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  function submitRealLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password || authLoading) return;
    onLoginWithPassword(email.trim(), password);
  }

  return (
    <div
      style={{
        minHeight: "100dvh", flex: 1, width: "100%", position: "relative", boxSizing: "border-box",
        background: "linear-gradient(155deg, #E3F2EA 0%, #A9D9C2 45%, #4D9D7E 85%, #2E8570 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(circle at 50% 0%, rgba(226,138,101,.35), transparent 50%), " +
            "radial-gradient(circle at 100% 100%, rgba(15,49,41,.35), transparent 55%)",
        }}
      />

      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>

      <div
        style={{
          position: "relative", width: 420, maxWidth: "100%", background: COLORS.card,
          borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: "36px 32px", boxSizing: "border-box",
        }}
      >
        <LoginLogo />
        <div style={{ fontSize: 13.5, color: COLORS.ink2, marginTop: 14, marginBottom: 26 }}>{company.name}</div>

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
              <div style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>
                {t[ERROR_KEY_BY_CODE[authError]] || t.errorGeneric}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.forest700, fontSize: 12.5, fontWeight: 600, padding: 0 }}
              >
                {t.forgotPassword}
              </button>
            </div>
            {showForgotHelp && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>
                {t.forgotPasswordHelp}
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
                    {s.role === "supervisor" && (
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
      </div>
    </div>
  );
}

export default LoginScreen;
