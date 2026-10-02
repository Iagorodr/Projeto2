// Cabeçalho comum aos dois gráficos de período (documento, 2.14): valor
// atual grande + pílula de variação (seta + %, ok-tint) + legenda "face
// ao período anterior".
import { ArrowUp, ArrowDown } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { FONT } from "../../../../styles/tokens.js";
import { Pill } from "../Pill.jsx";

function ChartHeader({ title, currentValueLabel, previousValueRaw, currentValueRaw, comparisonLabel = "face ao período anterior" }) {
  const hasComparison = previousValueRaw != null && previousValueRaw !== 0 && currentValueRaw != null;
  const pct = hasComparison ? Math.round(((currentValueRaw - previousValueRaw) / previousValueRaw) * 100) : null;
  const up = pct != null && pct >= 0;

  return (
    <div style={{ marginBottom: 14 }}>
      {title && <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 4 }}>{title}</div>}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 28, color: COLORS.ink }}>
          {currentValueLabel}
        </div>
        {pct != null && (
          <Pill variant="paid" icon={up ? ArrowUp : ArrowDown}>
            {Math.abs(pct)}%
          </Pill>
        )}
      </div>
      {pct != null && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{comparisonLabel}</div>}
    </div>
  );
}

export { ChartHeader };
