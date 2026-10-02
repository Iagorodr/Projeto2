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
  padding: "21px 21px", // 20-22 do documento
  boxSizing: "border-box",
};

// "Herói": degradê + brilho radial branco no canto sup. direito + riscas
// diagonais finas a 4.5% de branco — as três camadas empilhadas num único
// `background` (a primeira listada fica por cima).
const HERO_BACKGROUND =
  "radial-gradient(circle at 88% 12%, rgba(255,255,255,.18), transparent 55%), " +
  "repeating-linear-gradient(45deg, rgba(255,255,255,.045) 0 2px, transparent 2px 10px), " +
  "linear-gradient(140deg, #2A8A73 0%, #1F6F5C 42%, #143F35 100%)";

function variantStyle(variant) {
  switch (variant) {
    case "hero": // um por ecrã, no máximo — quem usa o componente decide isso, não o componente
      return {
        background: HERO_BACKGROUND, color: "#fff",
        boxShadow: SHADOW.sh2, border: "none",
      };
    case "tintOk": // estado positivo
      return {
        background: "linear-gradient(165deg, #EFF9F3, #D3ECDF)",
        border: `1px solid #BCDFCB`, boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
    case "warm": // notas
      return {
        background: "linear-gradient(180deg, #FFF9F4, #FDEEE2)",
        border: `1px solid #F3D9CB`, boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
    case "alert": // aviso de página
      return {
        background: COLORS.alertTint, border: `1px solid #F0CDBF`,
        boxShadow: SHADOW.sh1, color: "#7A3520",
      };
    case "default":
    default:
      return {
        background: COLORS.card, border: `1px solid ${COLORS.line}`,
        boxShadow: SHADOW.sh1, color: COLORS.ink,
      };
  }
}

function Card({ variant = "default", children, style }) {
  return (
    <div style={{ ...BASE, ...variantStyle(variant), ...style }}>
      {children}
    </div>
  );
}

export { Card };
