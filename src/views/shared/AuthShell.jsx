// Casca dos ecrãs de antes do login (código da empresa, login, assinatura
// vencida). Desktop: layout dividido — painel esquerdo 520 px com gradiente
// verde, blobs SVG animados e grelha de pontos; painel direito (#ECEEE9)
// com formulário centrado. Telemóvel: coluna única, fundo #ECEEE9, logo
// centrado no topo.
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW, FONT } from "../../styles/tokens.js";
import { LangSwitcher } from "./Layout.jsx";
import { LogoBadge, LogoLockup } from "./Logo.jsx";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";

// Logótipo do ecrã de início de sessão.
export function LoginLogo({ size = "default" }) {
  return <LogoLockup size={size === "large" ? 28 : 22} />;
}

// Campo de texto dos ecrãs de antes do login.
export const authInputStyle = {
  width: "100%", height: 48, borderRadius: 14, border: `1.5px solid ${COLORS.lineInput}`,
  padding: "0 16px", fontSize: 15, color: COLORS.ink, background: "#fff", boxSizing: "border-box",
  fontFamily: "inherit", outline: "none",
};

// ── Blobs animados SVG ──
const BLOB_KEYFRAMES = `
@keyframes sx-drift1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.05); } 66% { transform: translate(-15px,25px) scale(.97); } }
@keyframes sx-drift2 { 0%,100% { transform: translate(0,0) scale(1); } 40% { transform: translate(-25px,15px) scale(1.04); } 70% { transform: translate(20px,-10px) scale(.96); } }
@keyframes sx-drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(15px,20px) scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .sx-blob { animation: none !important; } }
`;

function BlobPanel({ tagline, subtitle }) {
  return (
    <div style={{
      width: 520, flexShrink: 0, position: "relative", overflow: "hidden",
      background: "linear-gradient(170deg, var(--p1) 0%, var(--p2) 100%)",
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      padding: "60px 48px", boxSizing: "border-box",
    }}>
      <style>{BLOB_KEYFRAMES}</style>
      {/* grelha de pontos */}
      <svg aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}>
        <pattern id="sx-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#fff" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#sx-dots)" />
      </svg>
      {/* blobs */}
      <svg aria-hidden="true" viewBox="0 0 520 600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <ellipse className="sx-blob" cx="130" cy="140" rx="150" ry="130" fill="rgba(255,255,255,.07)"
          style={{ animation: "sx-drift1 10s ease-in-out infinite" }} />
        <ellipse className="sx-blob" cx="380" cy="400" rx="170" ry="140" fill="rgba(255,255,255,.06)"
          style={{ animation: "sx-drift2 12s ease-in-out infinite" }} />
        <ellipse className="sx-blob" cx="250" cy="300" rx="120" ry="100" fill="rgba(255,255,255,.05)"
          style={{ animation: "sx-drift3 8s ease-in-out infinite" }} />
      </svg>
      {/* conteúdo */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "#fff", maxWidth: 360 }}>
        <LogoBadge size={56} tone="light" />
        <div style={{ marginTop: 28, fontFamily: FONT.heading, fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
          {tagline}
        </div>
        {subtitle && (
          <div style={{ marginTop: 12, fontSize: 15, opacity: 0.8, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthShell({ lang, setLang, children, tagline, subtitle, cardStyle }) {
  const tier = useBreakpoint();
  const isDesktop = tier === "desktop";
  const showPanel = isDesktop && tagline;

  if (showPanel) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", width: "100%",
      }}>
        <BlobPanel tagline={tagline} subtitle={subtitle} />
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "#ECEEE9", position: "relative", padding: 40, boxSizing: "border-box",
          minHeight: "100dvh",
        }}>
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <LangSwitcher lang={lang} setLang={setLang} />
          </div>
          <div style={{ width: 400, maxWidth: "100%", ...cardStyle }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Telemóvel / tablet / sem painel: coluna única
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center",
      background: "#ECEEE9", padding: "40px 20px", boxSizing: "border-box",
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      {tagline && (
        <div style={{ marginBottom: 32 }}>
          <LogoBadge size={48} />
        </div>
      )}
      <div style={{ width: 400, maxWidth: "100%", ...cardStyle }}>
        {children}
      </div>
    </div>
  );
}
