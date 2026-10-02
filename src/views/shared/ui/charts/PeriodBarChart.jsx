// Gráfico de barras de 6 períodos (documento de design, 2.14) — usado
// para "Valor pago". SVG próprio, sem biblioteca.
// `data`: [{ label (ex.: "Jul"), value, dateRangeLabel (ex.: "20 jun – 19 jul") }]
// O ÚLTIMO item de `data` é sempre o período atual (destacado); os
// anteriores ficam na cor esbatida #CDE2D9.
//
// Introduzido na Etapa 2 (componentes); já ligado ao Dashboard da
// gerência desde a Etapa 4, no lugar do `BarChart`/`LineChart` antigos
// de `DashboardWidgets.jsx` (ver nota em ReclamacoesCard.jsx) — esse
// ficheiro foi removido do projeto na limpeza pós-Etapa 4.
import { useState } from "react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";
import { ChartHeader } from "./ChartHeader.jsx";
import { niceCeiling, roundedTopBarPath } from "./chartMath.js";

function PeriodBarChart({ data, valueFormatter = (v) => `${v}`, title, currentValueLabel, comparisonLabel }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 340, h = 170, padL = 8, padR = 8, padTop = 28, padBottom = 24, barGap = 12;
  const n = data.length;
  const barW = (w - padL - padR - barGap * (n - 1)) / n;
  const max = niceCeiling(Math.max(1, ...data.map((d) => d.value)));
  const scaleY = (v) => (h - padBottom - padTop) * (v / max);
  const baseY = h - padBottom;

  const current = data[n - 1];
  const previous = data[n - 2];

  return (
    <div>
      <ChartHeader
        title={title}
        currentValueLabel={currentValueLabel ?? valueFormatter(current?.value ?? 0)}
        currentValueRaw={current?.value}
        previousValueRaw={previous?.value}
        comparisonLabel={comparisonLabel}
      />
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        {/* eixos: base sólida, restantes tracejadas */}
        <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} stroke="#CBD8D2" strokeWidth={1} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} y1={baseY - (h - padBottom - padTop) * f} x2={w - padR} y2={baseY - (h - padBottom - padTop) * f} stroke={COLORS.line} strokeDasharray="3 4" strokeWidth={1} />
        ))}

        {data.map((d, i) => {
          const barH = scaleY(d.value);
          const x = padL + i * (barW + barGap);
          const y = baseY - barH;
          const isCurrent = i === n - 1;
          const isHover = hoverIdx === i;
          const fill = isHover
            ? "#7DB5A2"
            : isCurrent
              ? `url(#servix-bar-gradient)`
              : "#CDE2D9";
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))} style={{ cursor: "default" }}>
              <path d={roundedTopBarPath(x, y, barW, barH, 10)} fill={fill} />
              {isCurrent && (
                <g>
                  <rect x={x + barW / 2 - 20} y={y - 22} width={40} height={18} rx={8} fill={COLORS.forest900} />
                  <text x={x + barW / 2} y={y - 9} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">
                    {valueFormatter(d.value)}
                  </text>
                </g>
              )}
              <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize={12} fill={COLORS.ink3}>
                {d.label}
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="servix-bar-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E8570" />
            <stop offset="100%" stopColor="#185A4A" />
          </linearGradient>
        </defs>
      </svg>

      {hoverIdx != null && (
        <div
          style={{
            marginTop: 8, display: "inline-block", background: COLORS.card, border: `1px solid ${COLORS.line}`,
            borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, padding: "8px 12px", fontSize: 12,
          }}
        >
          <div style={{ color: COLORS.ink3, marginBottom: 2 }}>{data[hoverIdx].dateRangeLabel}</div>
          <div style={{ fontWeight: 700, color: COLORS.ink }}>{valueFormatter(data[hoverIdx].value)}</div>
        </div>
      )}
    </div>
  );
}

export { PeriodBarChart };
