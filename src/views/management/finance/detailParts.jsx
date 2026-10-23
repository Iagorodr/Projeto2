// Re-exporta os componentes de UI usados no detalhe e acrescenta o cabeçalho de gráfico
// pequeno (título + valor atual + variação), para os 3 gráficos do Resumo.
import { ArrowUp, ArrowDown } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { FONT } from "../../../styles/tokens.js";
export { Card, Pill, Button, Drawer } from "../../shared/ui/index.js";

export function ChartHeaderLite({ title, value, pct, compareLabel, badge }) {
  const up = pct != null && pct >= 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink2, marginBottom: 4 }}>{title}{badge}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 24, color: COLORS.ink }}>{value}</span>
        {pct != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12.5, fontWeight: 700, color: up ? COLORS.okInk : COLORS.clayInk }}>
            {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(pct)}%
          </span>
        )}
      </div>
      {pct != null && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{compareLabel}</div>}
    </div>
  );
}
