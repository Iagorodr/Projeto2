// Botões (documento de design, 2.5).
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs
// redesenhados na Etapa 4 — comentário antigo (dizia "ainda não ligado a
// nenhum ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem mudança
// de comportamento.
import { useState } from "react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, MOTION } from "../../../styles/tokens.js";

// size: "gerencia" (44, por defeito) · "mobile" (56, dentro do intervalo
// 52-58 do documento; supervisor/mobile usam a mesma).
const HEIGHTS = { gerencia: 44, mobile: 56 };

const BASE = {
  border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "0 18px", transition: `background ${MOTION.fast} ease, opacity ${MOTION.fast} ease`,
  fontFamily: "inherit",
};

// `hover` só se aplica onde o documento pede (secundário e fantasma);
// os outros variantes ignoram o argumento.
function variantStyle(variant, hover) {
  switch (variant) {
    case "secondary":
      return {
        background: hover ? COLORS.forest50 : COLORS.card,
        color: COLORS.forest700, border: `1.5px solid #9FB8AE`,
      };
    case "ghost":
      return {
        background: "transparent", color: COLORS.forest700, padding: "0 6px",
        textDecoration: hover ? "underline" : "none",
      };
    case "dangerSoft":
      return { background: COLORS.alertTint, color: COLORS.alert };
    case "dangerSolid":
      return { background: COLORS.alert, color: "#fff" };
    case "primary":
    default:
      return {
        background: `linear-gradient(140deg, #2A8A73, ${COLORS.forest600})`,
        color: "#fff",
        boxShadow: "0 8px 18px -8px rgba(31,111,92,.7)",
      };
  }
}

// `disabled` esconde a forma normal com 45% de opacidade; o documento
// exige que NUNCA fique só "cinzento" — por isso, quando há
// `disabledReason`, mostramos essa frase ao lado (desktop) ou por baixo
// (quando `disabledReasonBelow`) do botão, nunca só a opacidade sozinha.
function Button({
  variant = "primary", size = "gerencia", icon: Icon, disabled, disabledReason,
  disabledReasonBelow, onClick, type = "button", children, style,
}) {
  const [hover, setHover] = useState(false);
  const height = HEIGHTS[size] || HEIGHTS.gerencia;
  const radius = size === "mobile" ? RADIUS.controlMobile : RADIUS.control;
  const btn = (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...BASE,
        ...variantStyle(variant, hover && !disabled),
        height: variant === "ghost" ? "auto" : height,
        borderRadius: variant === "ghost" ? 0 : radius,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {Icon && <Icon size={14} strokeWidth={1.8} />}
      {children}
    </button>
  );

  if (!disabled || !disabledReason) return btn;

  return (
    <div style={{ display: "flex", flexDirection: disabledReasonBelow ? "column" : "row", alignItems: disabledReasonBelow ? "flex-start" : "center", gap: 8 }}>
      {btn}
      <span style={{ fontSize: 12, color: COLORS.ink3 }}>{disabledReason}</span>
    </div>
  );
}

// Botão de ícone isolado: 40×40 (48 no mobile), raio 12, contorno line.
// O documento exige `aria-label` em ícones sozinhos (secção 1.7).
function IconButton({ icon: Icon, size = "gerencia", onClick, ariaLabel, disabled, style }) {
  const [hover, setHover] = useState(false);
  const dim = size === "mobile" ? 48 : 40;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim, height: dim, borderRadius: RADIUS.control,
        border: `1px solid ${COLORS.line}`, background: hover && !disabled ? COLORS.forest50 : COLORS.card,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
        color: COLORS.forest700, transition: `background ${MOTION.fast} ease`,
        ...style,
      }}
    >
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}

export { Button, IconButton };
