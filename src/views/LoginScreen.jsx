import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../styles/styles.js";
import { COLORS } from "../styles/colors.js";
import { TopBar, LangSwitcher, InstallAppButton } from "./shared/Layout.jsx";
import { LogoLockup } from "./shared/Logo.jsx";
import { T } from "../models/i18n.js";
import { isSupabaseConfigured } from "../models/supabaseClient.js";
import { useIsMobile } from "../hooks/useIsMobile.js";

// Silhueta de skyline (janelas acesas em laranja/verde-menta) desenhada por
// código — genérica o bastante para não prender a marca só a "limpeza", já
// pensando na expansão para outros nichos de operação.
function Skyline({ buildings, color, opacity, withWindows }) {
  return buildings.map((b, bi) => {
    const y = 520 - b.h;
    const windows = [];
    if (withWindows) {
      const winW = 6, winH = 8, gapX = 6, gapY = 11;
      const cols = Math.max(1, Math.floor((b.w - 10) / (winW + gapX)));
      const rows = Math.max(1, Math.floor((b.h - 20) / (winH + gapY)));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((bi * 7 + r * 3 + c * 5) % 4 !== 0) continue;
          const wx = b.x + 8 + c * (winW + gapX);
          const wy = y + 14 + r * (winH + gapY);
          const isOrange = (bi + r + c) % 2 === 0;
          windows.push(
            <rect key={`${bi}-${r}-${c}`} x={wx} y={wy} width={winW} height={winH} rx="1"
              fill={isOrange ? "#E28A65" : "#BFE3D3"} opacity={isOrange ? 0.65 : 0.4} />
          );
        }
      }
    }
    return (
      <g key={bi}>
        <rect x={b.x} y={y} width={b.w} height={b.h} rx="2" fill={color} opacity={opacity} />
        {windows}
      </g>
    );
  });
}

function LoginScene() {
  const backBuildings = [
    { x: -10, w: 60, h: 170 }, { x: 46, w: 46, h: 120 }, { x: 88, w: 72, h: 200 },
    { x: 158, w: 50, h: 140 }, { x: 206, w: 66, h: 185 }, { x: 270, w: 48, h: 130 },
    { x: 316, w: 62, h: 165 }, { x: 380, w: 50, h: 195 },
  ];
  const frontBuildings = [
    { x: -20, w: 84, h: 120 }, { x: 62, w: 58, h: 88 }, { x: 118, w: 66, h: 150 },
    { x: 182, w: 48, h: 96 }, { x: 228, w: 72, h: 168 }, { x: 298, w: 52, h: 108 },
    { x: 348, w: 70, h: 138 },
  ];
  return (
    <svg
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMax slice"
      viewBox="0 0 400 520"
    >
      <defs>
        <radialGradient id="servixGlow" cx="72%" cy="14%" r="60%">
          <stop offset="0%" stopColor="#E28A65" stopOpacity="0.30" />
          <stop offset="55%" stopColor="#E28A65" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#E28A65" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="520" fill="url(#servixGlow)" />
      {/* marca d'água: o visto da marca, gigante e muito sutil */}
      <g opacity="0.06" transform="translate(30,-30) rotate(-6)">
        <path d="M60 230 Q100 300 150 330" fill="none" stroke="#FFFFFF" strokeWidth="26" strokeLinecap="round" />
        <path d="M150 330 Q230 290 340 120" fill="none" stroke="#FFFFFF" strokeWidth="26" strokeLinecap="round" />
      </g>
      <Skyline buildings={backBuildings} color="#FFFFFF" opacity={0.06} withWindows={false} />
      <Skyline buildings={frontBuildings} color="#FFFFFF" opacity={0.11} withWindows />
    </svg>
  );
}

const ERROR_KEY_BY_CODE = {
  invalid_credentials: "errorInvalidCredentials",
  no_account: "errorNoAccount",
  generic: "errorGeneric",
};

function LoginScreen({ lang, setLang, onEnterManagement, onEnterEmployee, onLoginWithPassword, authLoading, authError, company, staff }) {
  const t = T[lang].login;
  const [mode, setMode] = useState("gerencia"); // 'gerencia' | 'funcionario' — só usado no modo de demonstração
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const isMobile = useIsMobile();

  function submitRealLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password || authLoading) return;
    onLoginWithPassword(email.trim(), password);
  }

  const loginShellStyle = isMobile
    ? { ...styles.loginShell, flexDirection: "column", maxWidth: 420, minHeight: 0 }
    : styles.loginShell;
  const loginLeftStyle = isMobile
    ? { ...styles.loginLeft, flex: "0 0 auto", minHeight: 150, padding: "24px 24px 20px" }
    : styles.loginLeft;
  const loginRightStyle = isMobile
    ? { ...styles.loginRight, padding: "24px 22px 28px" }
    : styles.loginRight;

  return (
    <div style={loginShellStyle}>
      <div style={loginLeftStyle}>
        <LoginScene />
        <div style={styles.loginLeftContent}>
          <LogoLockup size={32} tone="reversed" />
          {!isMobile && <div style={styles.loginTagline}>{t.tagline}</div>}
        </div>
        {!isMobile && <div style={styles.loginLeftFoot}>Servix · {t.footNote}</div>}
      </div>
      <div style={loginRightStyle}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
        <div style={styles.loginFields}>
          <div style={styles.loginCompanyName}>{company.name}</div>

          {isSupabaseConfigured ? (
            <form onSubmit={submitRealLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder} style={styles.loginInput} type="email" autoComplete="username"
              />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder} style={styles.loginInput} autoComplete="current-password"
              />
              {authError && (
                <div style={{ background: COLORS.extraTint, color: COLORS.extra, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>
                  {t[ERROR_KEY_BY_CODE[authError]] || t.errorGeneric}
                </div>
              )}
              <div style={styles.forgotRow}>
                <button type="button" style={styles.forgotLink} onClick={() => setShowForgotHelp((v) => !v)}>
                  {t.forgotPassword}
                </button>
              </div>
              {showForgotHelp && (
                <div style={{ ...styles.defSettingHint, background: COLORS.primaryTint, borderRadius: 8, padding: "8px 12px" }}>
                  {t.forgotPasswordHelp}
                </div>
              )}
              <button type="submit" style={{ ...styles.enterButton, opacity: authLoading ? 0.7 : 1 }} disabled={authLoading}>
                {authLoading ? t.entering : t.enter}
              </button>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <button
                  style={{ ...styles.avTypeToggle, ...(mode === "gerencia" ? styles.avTypeActiveNotice : {}) }}
                  onClick={() => setMode("gerencia")}
                >
                  {t.isManagement}
                </button>
                <button
                  style={{ ...styles.avTypeToggle, ...(mode === "funcionario" ? styles.avTypeActiveNotice : {}) }}
                  onClick={() => setMode("funcionario")}
                >
                  {t.isEmployee}
                </button>
              </div>

              {mode === "gerencia" ? (
                <>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} style={styles.loginInput} />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} style={styles.loginInput} />
                  <div style={styles.forgotRow}>
                    <button style={styles.forgotLink}>{t.forgotPassword}</button>
                  </div>
                  <button style={styles.enterButton} onClick={onEnterManagement}>{t.enter}</button>
                </>
              ) : (
                <>
                  <div style={{ ...styles.defSettingHint, marginBottom: 4 }}>{t.chooseWho}</div>
                  {staff.map((s) => (
                    <button key={s.id} style={{ ...styles.cancelButton, textAlign: "left" }} onClick={() => onEnterEmployee(s.id)}>
                      {s.name}
                      {s.role === "supervisor" && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: COLORS.primaryDark }}>{t.supervisorTag}</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        <InstallAppButton lang={lang} />
      </div>
    </div>
  );
}

export default LoginScreen;