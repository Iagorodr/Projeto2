// Cartão (documento de design, 2.1): base + 4 variantes.
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs
// redesenhados na Etapa 4 — comentário antigo (dizia "ainda não ligado a
// nenhum ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem mudança
// de comportamento.
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";

const BASE = {
  borderRadius: RADIUS.card,
  // 21px (documento: 20-22) no PC/tablet; desce até 14px em ecrãs estreitos (telemóvel).
  padding: "clamp(14px, 4vw, 21px)",
  boxSizing: "border-box",
};

// "Herói": degradê + brilho radial branco no canto sup. direito + riscas
// diagonais finas a 4.5% de branco — as três camadas empilhadas num único
// `background` (a primeira listada fica por cima).
// Redesign B1: o "herói" passa a ser o cartão ESCURO (tinta #151816), com um
// brilho muito leve da cor da empresa no canto.
const HERO_BACKGROUND =
  "radial-gradient(circle at 92% 0%, var(--p1-shadow), transparent 48%), #151816";

function variantStyle(variant) {
  switch (variant) {
    case "hero": // um por ecrã, no máximo — quem usa o componente decide isso, não o componente
      return {
        background: HERO_BACKGROUND, color: "#fff",
        boxShadow: SHADOW.sh2, border: "none",
      };
    case "tintOk": // estado positivo
      return {
        background: "#E3F4EA",
        border: `1px solid #C7E6D3`, boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
    case "warm": // notas
      return {
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`, boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
    case "alert": // aviso de página
      return {
        background: COLORS.alertTint, border: `1px solid #F5C9CB`,
        boxShadow: SHADOW.sh1, color: "#8E2A2F",
      };
    case "default":
    default:
      return {
        background: COLORS.card, border: `1px solid ${COLORS.line}`,
        boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
  }
}

function Card({ variant = "default", children, style, ...rest }) {
  return (
    <div style={{ ...BASE, ...variantStyle(variant), ...style }} {...rest}>
      {children}
    </div>
  );
}

export { Card };
