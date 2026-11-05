// Casca dos ecrãs de antes do login (código da empresa, login, assinatura
// vencida). Desktop: layout dividido — painel esquerdo 520 px com gradiente
// verde, blobs SVG animados e grelha de pontos; painel direito (#ECEEE9)
// com formulário centrado. Telemóvel: coluna única, fundo #ECEEE9, logo
// centrado no topo.
import { useEffect, useState } from "react";
import { COLORS } from "../../styles/colors.js";
import { T } from "../../models/i18n.js";
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

// ── Painel animado (computador) ──
// Bolas de fundo a flutuar, o símbolo com anéis que "respiram" e um rodopio de
// vez em quando, frases a rodar por baixo do slogan e uma faixa de temas a
// passar em loop. Tudo para quem prefere menos movimento.
const PANEL_CSS = `
@keyframes sx-drift1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(70px,-50px) scale(1.12); } 66% { transform: translate(-40px,60px) scale(.94); } }
@keyframes sx-drift2 { 0%,100% { transform: translate(0,0) scale(1); } 40% { transform: translate(-80px,40px) scale(1.1); } 70% { transform: translate(50px,-40px) scale(.92); } }
@keyframes sx-drift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,70px) scale(1.15); } }
@keyframes sx-drift4 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-60px,-80px); } }
@keyframes sx-spin { 0%, 82% { transform: rotateY(0deg) scale(1); } 88% { transform: rotateY(180deg) scale(1.08); } 94%,100% { transform: rotateY(360deg) scale(1); } }
@keyframes sx-ring { 0% { transform: scale(.85); opacity: .55; } 100% { transform: scale(1.9); opacity: 0; } }
@keyframes sx-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes sx-line-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.sx-blob { transform-box: fill-box; transform-origin: center; }
.sx-ring { position: absolute; inset: 0; border-radius: 22px; border: 1.5px solid rgba(255,255,255,.55); animation: sx-ring 3.6s cubic-bezier(.2,.6,.3,1) infinite; }
.sx-line { animation: sx-line-in .55s cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) {
  .sx-blob, .sx-ring, .sx-spin, .sx-marquee-track, .sx-line { animation: none !important; }
}
`;

function FeatureRotator({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!lines || lines.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), 3400);
    return () => clearInterval(id);
  }, [lines]);
  if (!lines || lines.length === 0) return null;
  return (
    <div aria-live="off" style={{ marginTop: 22, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div key={i} className="sx-line" style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, color: "#fff" }}>{lines[i]}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {lines.map((_, k) => (
          <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, background: k === i ? "#fff" : "rgba(255,255,255,.35)", transition: "width .35s ease, background .35s ease" }} />
        ))}
      </div>
    </div>
  );
}

function Marquee({ items }) {
  if (!items || items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div aria-hidden="true" style={{
      position: "absolute", left: 0, right: 0, bottom: 34, overflow: "hidden",
      WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
      maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
    }}>
      <div className="sx-marquee-track" style={{ display: "flex", gap: 10, width: "max-content", animation: "sx-marquee 32s linear infinite" }}>
        {row.map((label, k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", color: "rgba(255,255,255,.92)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,.75)" }} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BlobPanel({ tagline, subtitle, features, chips }) {
  return (
    <div style={{
      width: 520, flexShrink: 0, position: "relative", overflow: "hidden",
      background: "linear-gradient(170deg, var(--p1) 0%, var(--p2) 100%)",
      display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      padding: "60px 48px 110px", boxSizing: "border-box",
    }}>
      <style>{PANEL_CSS}</style>
      {/* grelha de pontos */}
      <svg aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}>
        <pattern id="sx-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#fff" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#sx-dots)" />
      </svg>
      {/* bolas */}
      <svg aria-hidden="true" viewBox="0 0 520 600" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <ellipse className="sx-blob" cx="110" cy="130" rx="160" ry="140" fill="rgba(255,255,255,.08)" style={{ animation: "sx-drift1 16s ease-in-out infinite" }} />
        <ellipse className="sx-blob" cx="400" cy="440" rx="180" ry="150" fill="rgba(255,255,255,.07)" style={{ animation: "sx-drift2 19s ease-in-out infinite" }} />
        <ellipse className="sx-blob" cx="260" cy="300" rx="120" ry="105" fill="rgba(255,255,255,.05)" style={{ animation: "sx-drift3 13s ease-in-out infinite" }} />
        <circle className="sx-blob" cx="450" cy="110" r="46" fill="rgba(255,255,255,.09)" style={{ animation: "sx-drift4 11s ease-in-out infinite" }} />
      </svg>
      {/* conteúdo */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", color: "#fff", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: 76, height: 76, perspective: 400 }}>
          <span className="sx-ring" />
          <span className="sx-ring" style={{ animationDelay: "1.8s" }} />
          <div className="sx-spin" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "sx-spin 9s cubic-bezier(.5,0,.3,1) 1.5s infinite", transformStyle: "preserve-3d" }}>
            <div style={{ boxShadow: "0 14px 34px rgba(0,0,0,.18)", borderRadius: 18 }}><LogoBadge size={76} tone="light" /></div>
          </div>
        </div>
        <div style={{ marginTop: 30, fontFamily: FONT.heading, fontSize: 30, fontWeight: 800, lineHeight: 1.18 }}>
          {tagline}
        </div>
        {subtitle && (
          <div style={{ marginTop: 10, fontSize: 14.5, opacity: 0.78, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
        <FeatureRotator lines={features} />
      </div>
      <Marquee items={chips} />
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
        <BlobPanel tagline={tagline} subtitle={subtitle} features={(T[lang] || T.pt).company?.gateFeatures} chips={(T[lang] || T.pt).company?.gateChips} />
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
