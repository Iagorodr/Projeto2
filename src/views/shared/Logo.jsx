// Marca Servix — o visto (✓) partido em dois traços: o curto e quente é o
// cuidado humano (quem faz a visita), o longo e verde é a operação
// verificada (hora registada, período fechado). Ver a identidade visual
// completa para o racional de cores e tipografia.
import { COLORS } from "../../styles/colors.js";

const TONES = {
  default: { a: COLORS.extra, b: COLORS.primary },
  reversed: { a: "#E28A65", b: "#FFFFFF" },
  mono: { a: COLORS.primaryDark, b: COLORS.primaryDark },
};

function LogoMark({ size = 32, tone = "default", style }) {
  const { a, b } = TONES[tone] || TONES.default;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" style={style}>
      <path d="M26 50 Q34 62 42 66" fill="none" stroke={a} strokeWidth="10" strokeLinecap="round" />
      <path d="M42 66 Q58 56 76 24" fill="none" stroke={b} strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

function LogoBadge({ size = 44, tone = "dark" }) {
  const bg = tone === "dark" ? COLORS.primaryDark : COLORS.primaryTint;
  const inner = tone === "dark" ? "reversed" : "default";
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.24, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <LogoMark size={size * 0.58} tone={inner} />
    </div>
  );
}

function LogoLockup({ size = 28, tone = "default", textColor, gap }) {
  const color = textColor || (tone === "reversed" ? "#FFFFFF" : COLORS.primaryDark);
  const accent = tone === "reversed" ? "#E28A65" : COLORS.extra;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: gap ?? size * 0.34 }}>
      <LogoMark size={size} tone={tone} />
      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: size * 0.82, color, letterSpacing: "0.1px", lineHeight: 1 }}>
        Servi<span style={{ color: accent }}>x</span>
      </span>
    </div>
  );
}

export { LogoMark, LogoBadge, LogoLockup };
