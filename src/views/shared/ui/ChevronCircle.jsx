// Seta de "abrir" no fim de uma linha de lista — Verde vivo (documento do
// Tomás): círculo menta (#D4E8DF) com a seta em verde-vivo, em vez da seta
// cinzenta solta.
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";

function ChevronCircle({ size = 28 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: COLORS.mint, color: COLORS.vivo,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <ChevronRight size={Math.round(size * 0.6)} strokeWidth={2.5} />
    </span>
  );
}

export { ChevronCircle };
