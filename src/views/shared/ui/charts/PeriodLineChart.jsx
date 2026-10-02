// Gráfico de linha de 6 períodos (documento de design, 2.14) — usado para
// "Total de horas". SVG próprio, sem biblioteca.
// `data`: [{ label (ex.: "Jul"), value, dateRangeLabel (ex.: "20 jun – 19 jul") }]
// `averageLabel`: ex.: (avg) => `média ${avg} h` — se omitido, usa um
// formato genérico "média {valor}".
//
// Introduzido na Etapa 2 (componentes); já ligado ao Dashboard da
// gerência desde a Etapa 4 — comentário antigo corrigido aqui, varredura
// de QA pós-Etapa 4, sem mudança de comportamento.
import { useState } from "react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";
import { ChartHeader } from "./ChartHeader.jsx";
import { niceCeiling } from "./chartMath.js";

function PeriodLineChart({ data, valueFormatter = (v) => `${v}`, averageLabel, title, currentValueLabel, comparisonLabel }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 340, h = 170, padL = 8, padR = 8, padTop = 28, padBottom = 24;
  const n = data.length;
  const max = niceCeiling(Math.max(1, ...data.map((d) => d.value)));
  const innerW = w - padL - padR;
  const innerH = h - padTop - padBottom;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const scaleY = (v) => padTop + innerH - innerH * (v / max);
  const points = data.map((d, i) => ({ x: padL + i * stepX, y: scaleY(d.value) }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + innerH} L ${points[0].x} ${padTop + innerH} Z`;

  const avg = data.reduce((s, d) => s + d.value, 0) / (n || 1);
  const avgY = scaleY(avg);
  const avgText = averageLabel ? averageLabel(Math.round(avg)) : `média ${Math.round(avg)}`;

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
        <defs>
          <linearGradient id="servix-line-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.forest600} stopOpacity={0.32} />
            <stop offset="100%" stopColor={COLORS.forest600} stopOpacity={0} />
          </linearGradient>
        </defs>

        <line x1={padL} y1={padTop + innerH} x2={w - padR} y2={padTop + innerH} stroke="#CBD8D2" strokeWidth={1} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padL} y1={padTop + innerH * (1 - f)} x2={w - padR} y2={padTop + innerH * (1 - f)} stroke={COLORS.line} strokeDasharray="3 4" strokeWidth={1} />
        ))}

        {/* linha tracejada laranja da média, com etiqueta */}
        <line x1={padL} y1={avgY} x2={w - padR} y2={avgY} stroke={COLORS.clay} strokeDasharray="5 4" strokeWidth={1.5} />
        <text x={w - padR} y={avgY - 5} textAnchor="end" fontSize={11} fill={COLORS.clay} fontWeight={600}>
          {avgText}
        </text>

        <path d={areaPath} fill="url(#servix-line-area)" stroke="none" />
        <path d={linePath} fill="none" stroke={COLORS.forest600} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* guia vertical + ponto no hover */}
        {hoverIdx != null && (
          <line x1={points[hoverIdx].x} y1={padTop} x2={points[hoverIdx].x} y2={padTop + innerH} stroke={COLORS.line} strokeWidth={1} />
        )}

        {points.map((p, i) => {
          const isLast = i === n - 1;
          const isHover = hoverIdx === i;
          return (
            <g key={i}>
              {/* alvo de hover maior, invisível */}
              <rect
                x={p.x - stepX / 2} y={padTop} width={stepX || innerW} height={innerH} fill="transparent"
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))}
                style={{ cursor: "default" }}
              />
              {(isLast || isHover) && (
                <circle cx={p.x} cy={p.y} r={isHover ? 5 : 4} fill={COLORS.forest600} stroke="#fff" strokeWidth={2} />
              )}
              <text x={p.x} y={h - 6} textAnchor="middle" fontSize={12} fill={COLORS.ink3}>
                {data[i].label}
              </text>
            </g>
          );
        })}
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

export { PeriodLineChart };
