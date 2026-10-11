// Botões (documento de design, 2.5).
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs
// redesenhados na Etapa 4 — comentário antigo (dizia "ainda não ligado a
// nenhum ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem mudança
// de comportamento.
import { useState } from "react";
import { Lock } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { MOTION } from "../../../styles/tokens.js";
import { useControlSize } from "../../../hooks/useBreakpoint.js";

// Lote 4, 4.4 (achado da Marta): altura/raio deixam de ser fixos por
// `size` e passam a vir de `useControlSize` — 40 no desktop (mouse), 48
// no tablet e no celular (ou no desktop com ponteiro grosso, ex.: iPad
// na horizontal); raio 12 no desktop/tablet, 16 só no celular. Era
// `HEIGHTS = { gerencia: 44, mobile: 56 }` fixo — "gerencia" virava 44
// sempre (mesmo num celular), e "mobile" forçava 56 em QUALQUER botão
// mobile, não só no principal da barra de ação fixa (documento: "56 só
// no botão principal"). `size="mobile"` continua aceito nos chamadores
// existentes (histórico, em telas só-celular) mas agora é só um sinônimo
// do tamanho automático — na prática já dava 48/56 ali por estar sempre
// dentro de uma tela mobile; o 56 fixo sai, exceto para quem passar
// `size="actionBarPrimary"` (só o botão principal da BottomActionBar).
const FIXED_HEIGHTS = { actionBarPrimary: 56 };

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
        background: hover ? COLORS.mintBg : COLORS.card,
        color: COLORS.vivo, border: `2px solid ${COLORS.vivo}`,
      };
    case "ghost":
      // Lote 4, 4.4 (achado da Marta, itens "Redefinir" 88×16 e "Tive um
      // cliente mesmo assim" 198×16): sem fundo nem contorno, então a
      // altura mínima de toque fica "invisível" — o texto continua do
      // mesmo tamanho, só a área clicável (centrada por `alignItems:
      // center` do BASE) cresce para 40/48.
      return {
        background: "transparent", color: COLORS.vivo, padding: "0 6px",
        textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 4,
        opacity: hover ? 0.85 : 1,
      };
    case "dangerSoft":
      return { background: COLORS.dangerBg, color: COLORS.dangerInk };
    case "dangerSolid":
      return { background: COLORS.dangerSolid, color: "#fff" };
    case "add":
      // "Adicionar": tracejado verde, fundo menta, círculo verde cheio com "+".
      return { background: COLORS.mintBg, color: COLORS.vivo, border: `2px dashed ${COLORS.vivoLight}` };
    case "primary":
    default:
      return {
        background: `linear-gradient(180deg, ${COLORS.vivoBtnTop}, ${COLORS.vivoBtnBottom})`,
        color: "#fff",
        boxShadow: "0 10px 20px -8px rgba(31,122,95,.7), inset 0 1px 0 rgba(255,255,255,.3)",
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
  const { height: autoHeight, radius: autoRadius } = useControlSize();
  const height = FIXED_HEIGHTS[size] || autoHeight;
  const radius = autoRadius;
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
        height,
        borderRadius: variant === "ghost" ? 0 : radius,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        // Principal desativado: verde-menta apagado com cadeado (nunca só
        // "cinzento a 45%"), sem sombra.
        ...(disabled && variant === "primary" ? { background: COLORS.disabledBg, color: COLORS.disabledInk, boxShadow: "none", opacity: 1 } : null),
        ...style,
      }}
    >
      {disabled && variant === "primary" && !Icon && <Lock size={14} strokeWidth={2} />}
      {variant === "add" && !Icon && (
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: COLORS.vivo, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1, fontWeight: 700 }}>+</span>
      )}
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

// Botão de ícone isolado: 40×40 no desktop, 48×48 no tablet/celular (ou
// no desktop com ponteiro grosso), raio 12/12/16 — mesma régua de
// `useControlSize` usada pelo `Button` (Lote 4, 4.4). `size="mobile"`
// continua aceito (sinônimo do automático, já dava 48 por estar sempre
// numa tela mobile). O documento exige `aria-label` em ícones sozinhos
// (secção 1.7).
function IconButton({ icon: Icon, size = "gerencia", onClick, ariaLabel, disabled, style }) {
  const [hover, setHover] = useState(false);
  const { minTap: dim, radius } = useControlSize();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim, height: dim, borderRadius: radius,
        border: `1.5px solid ${COLORS.iconBorder}`, background: hover && !disabled ? COLORS.mintBg : COLORS.card,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
        color: COLORS.vivo, transition: `background ${MOTION.fast} ease`,
        ...style,
      }}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  );
}

export { Button, IconButton };
