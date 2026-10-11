// Seletor de semana/período — Verde vivo (documento do Tomás, "seletor de
// semana"): pílula branca com contorno de 1,5px (#B6D4C8), setas dentro de
// círculos menta (#D4E8DF) com a seta em verde-vivo (#1F7A5F). Substitui as
// cinco versões soltas que cada ecrã tinha (círculos brancos de 40px, pílula
// cinzenta sem contorno, etc.), para o gesto ser igual em todo o app.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";

// Seta redonda sozinha (também usada no seletor de mês do calendário).
function RoundArrow({ dir, onClick, disabled, ariaLabel, size = 36 }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: size, height: size, borderRadius: "50%", border: "none", flexShrink: 0,
        background: COLORS.mint, color: COLORS.vivo,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.5} />
    </button>
  );
}

function PeriodNav({
  label, onPrev, onNext, prevLabel, nextLabel, prevDisabled, nextDisabled,
  size = 36, labelStyle, style,
}) {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: 4,
        background: COLORS.card, border: `1.5px solid ${COLORS.iconBorder}`, borderRadius: 999,
        maxWidth: "100%", boxSizing: "border-box",
        ...style,
      }}
    >
      <RoundArrow dir="prev" onClick={onPrev} disabled={prevDisabled} ariaLabel={prevLabel} size={size} />
      <span
        style={{
          fontSize: 15, fontWeight: 700, color: COLORS.ink, textAlign: "center",
          padding: "0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          ...labelStyle,
        }}
      >
        {label}
      </span>
      <RoundArrow dir="next" onClick={onNext} disabled={nextDisabled} ariaLabel={nextLabel} size={size} />
    </div>
  );
}

export { PeriodNav, RoundArrow };
