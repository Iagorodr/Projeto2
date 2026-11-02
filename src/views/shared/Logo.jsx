// Marca Servix — o visto (✓) partido em dois traços: o curto e quente é o
// cuidado humano (quem faz a visita), o longo e verde é a operação
// verificada (hora registada, período fechado). Ver a identidade visual
// completa para o racional de cores e tipografia.
import { COLORS } from "../../styles/colors.js";

const TONES = {
  default: { a: "var(--p1)", b: "var(--p2)" },
  reversed: { a: "#FFFFFF", b: "#FFFFFF" },
  mono: { a: COLORS.primaryDark, b: COLORS.primaryDark },
};

// Nome da marca num só sítio: quando o nome definitivo chegar, muda-se aqui.
export const BRAND_NAME = "Servix";

// Símbolo PROVISÓRIO (redesign B1): duas fitas cruzadas (o "s"). É o único sítio
// onde o desenho vive — menu, login, carregamento e ícones usam este componente.
function LogoMark({ size = 32, tone = "default", style, draw = false, gapColor }) {
  const { a, b } = TONES[tone] || TONES.default;
  const gap = gapColor || (tone === "reversed" ? "var(--p1)" : "#fff");
  const anim = draw ? { strokeDasharray: 60, strokeDashoffset: 60, animation: "sx-draw 1.1s var(--ease) infinite alternate" } : null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={style}>
      <path d="M14 13C35 19 29 45 50 51" fill="none" stroke={a} strokeWidth="10" strokeLinecap="round" style={anim || undefined} />
      <path d="M50 13C29 19 35 45 14 51" fill="none" stroke={gap} strokeWidth="16" strokeLinecap="round" style={anim ? { ...anim, animationDelay: ".25s" } : undefined} />
      <path d="M50 13C29 19 35 45 14 51" fill="none" stroke={b} strokeWidth="10" strokeLinecap="round" style={anim ? { ...anim, animationDelay: ".25s" } : undefined} />
    </svg>
  );
}

// Componente único da marca: variant "mark" (só o símbolo), "badge" (símbolo
// numa caixa) ou "lockup" (símbolo + nome).
function Logo({ variant = "mark", size, tone, ...rest }) {
  if (variant === "badge") return <LogoBadge size={size || 44} tone={tone || "dark"} {...rest} />;
  if (variant === "lockup") return <LogoLockup size={size || 28} tone={tone || "default"} {...rest} />;
  return <LogoMark size={size || 32} tone={tone || "default"} {...rest} />;
}

function LogoBadge({ size = 44, tone = "dark" }) {
  const bg = tone === "dark" ? "var(--p1)" : "#fff";
  const inner = tone === "dark" ? "reversed" : "default";
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.24, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <LogoMark size={size * 0.7} tone={inner} gapColor={tone === "dark" ? "var(--p1)" : "#fff"} />
    </div>
  );
}

function LogoLockup({ size = 28, tone = "default", textColor, gap }) {
  const color = textColor || (tone === "reversed" ? "#FFFFFF" : COLORS.primaryDark);
  const accent = tone === "reversed" ? "rgba(255,255,255,.7)" : "var(--p1)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: gap ?? size * 0.34 }}>
      <LogoMark size={size} tone={tone} />
      <span style={{ fontFamily: "'Archivo Variable', 'Archivo Display', sans-serif", fontWeight: 600, fontSize: size * 0.82, color, letterSpacing: "0.1px", lineHeight: 1 }}>
        {BRAND_NAME}
      </span>
    </div>
  );
}

export { Logo, LogoMark, LogoBadge, LogoLockup };
