// Barras empilhadas por período (uma cor por contratante) — usado na visão geral de
// Contratantes (várias séries) e no detalhe (uma série). SVG próprio, sem biblioteca.
//
// periods: [{ key, label, rangeLabel, isCurrent, values: { [serieId]: número } }]
// series:  [{ id, name, color }]  — a ordem é a ordem da pilha (de baixo para cima)
//
// Regras do dataviz: marcas finas, 2px de intervalo entre segmentos, cantos arredondados só
// no topo da pilha, legenda sempre que há ≥ 2 séries, tooltip ao passar/tocar, tabela alternativa.
import { useState } from "react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";
import { niceCeiling, roundedTopBarPath } from "../../shared/ui/charts/chartMath.js";

const GAP = 2;

function StackedBars({ periods, series, valueFormatter, axisFormatter, ariaLabel, compact = false, width, height = 190, totalLabel = "Total", tableLabel = "Ver como tabela", emptyLabel = "Sem dados.", showTable = true }) {
  const [hover, setHover] = useState(null);
  const axisFmt = axisFormatter || valueFormatter;
  const w = width || (compact ? 340 : 640), h = height, padL = 40, padR = 6, padTop = 22, padBottom = 24;
  const n = periods.length;
  const totals = periods.map((p) => series.reduce((s, se) => s + (p.values[se.id] || 0), 0));
  const rawMax = Math.max(0, ...totals);
  const max = niceCeiling(Math.max(1, rawMax));
  const plotH = h - padTop - padBottom;
  const baseY = h - padBottom;
  const slot = (w - padL - padR) / Math.max(1, n);
  const barW = Math.min(compact && n > 8 ? 18 : 44, slot * 0.62);
  const y = (v) => plotH * (v / max);
  // Com 12 barras no telemóvel só mostra algumas etiquetas, para não se sobreporem.
  const labelEvery = slot < 26 ? 2 : 1;

  if (rawMax === 0) {
    return <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: COLORS.ink3 }}>{emptyLabel}</div>;
  }
  const active = hover != null ? periods[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      {series.length >= 2 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 8 }}>
          {series.map((se) => (
            <span key={se.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.ink2 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: se.color, flexShrink: 0 }} />{se.name}
            </span>
          ))}
        </div>
      )}
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
        <line x1={padL} y1={baseY} x2={w - padR} y2={baseY} stroke="#CBD8D2" strokeWidth={1} />
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} y1={baseY - plotH * f} x2={w - padR} y2={baseY - plotH * f} stroke={COLORS.line} strokeDasharray="3 4" strokeWidth={1} />
            <text x={padL - 6} y={baseY - plotH * f + 4} textAnchor="end" fontSize={10.5} fill={COLORS.ink3}>{axisFmt(max * f)}</text>
          </g>
        ))}
        <text x={padL - 6} y={baseY + 4} textAnchor="end" fontSize={10.5} fill={COLORS.ink3}>0</text>

        {periods.map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const x = cx - barW / 2;
          let acc = 0;
          const present = series.filter((se) => (p.values[se.id] || 0) > 0);
          const topId = present.length ? present[present.length - 1].id : null;
          return (
            <g key={p.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((v) => (v === i ? null : v))} onClick={() => setHover((v) => (v === i ? null : i))} style={{ cursor: "default" }}>
              <rect x={cx - slot / 2} y={padTop - 14} width={slot} height={plotH + 14 + padBottom} fill={hover === i ? COLORS.lineSoft : "transparent"} opacity={hover === i ? 0.7 : 1} rx={6} />
              {present.map((se) => {
                const v = p.values[se.id];
                const segH = y(v);
                const top = baseY - y(acc + v);
                acc += v;
                const drawH = Math.max(0.5, segH - (se.id === present[0].id ? 0 : GAP));
                return se.id === topId
                  ? <path key={se.id} d={roundedTopBarPath(x, top, barW, drawH, 4)} fill={se.color} />
                  : <rect key={se.id} x={x} y={top} width={barW} height={drawH} fill={se.color} />;
              })}
              {p.isCurrent && totals[i] > 0 && (
                <text x={cx} y={baseY - y(totals[i]) - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={COLORS.ink}>{valueFormatter(totals[i])}</text>
              )}
              {(i % labelEvery === (n - 1) % labelEvery) && (
                <text x={cx} y={h - 7} textAnchor="middle" fontSize={11.5} fontWeight={p.isCurrent ? 700 : 400} fill={p.isCurrent ? COLORS.ink : COLORS.ink3}>{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>

      {active && (() => {
        const cxPct = ((padL + slot * hover + slot / 2) / w) * 100;
        const left = Math.max(22, Math.min(78, cxPct));
        return (
          <div style={{ position: "absolute", left: `${left}%`, top: series.length >= 2 ? 34 : 6, transform: "translateX(-50%)", pointerEvents: "none", zIndex: 5, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, padding: "8px 12px", fontSize: 12, maxWidth: "90%", minWidth: 130 }}>
            <div style={{ color: COLORS.ink3, marginBottom: 4 }}>{active.rangeLabel}</div>
            {series.filter((se) => (active.values[se.id] || 0) > 0).map((se) => (
              <div key={se.id} style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.ink }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: se.color }} />
                <span style={{ flex: 1 }}>{se.name}</span>
                <strong>{valueFormatter(active.values[se.id])}</strong>
              </div>
            ))}
            {series.length >= 2 && (
              <div style={{ display: "flex", gap: 6, marginTop: 4, paddingTop: 4, borderTop: `1px solid ${COLORS.lineSoft}`, color: COLORS.ink, fontWeight: 700 }}>
                <span style={{ flex: 1 }}>{totalLabel}</span><span>{valueFormatter(totals[hover])}</span>
              </div>
            )}
          </div>
        );
      })()}

      {showTable && (
        <details style={{ fontSize: 12, color: COLORS.ink3 }}>
          <summary style={{ cursor: "pointer", padding: "4px 0" }}>{tableLabel}</summary>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, color: COLORS.ink, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 8px 4px 0", color: COLORS.ink3, fontWeight: 600 }} />
                  {series.map((se) => <th key={se.id} style={{ textAlign: "right", padding: "4px 8px", color: COLORS.ink3, fontWeight: 600, whiteSpace: "nowrap" }}>{se.name}</th>)}
                  {series.length >= 2 && <th style={{ textAlign: "right", padding: "4px 0 4px 8px", color: COLORS.ink3, fontWeight: 600 }}>{totalLabel}</th>}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p.key} style={{ borderTop: `1px solid ${COLORS.lineSoft}` }}>
                    <td style={{ padding: "4px 8px 4px 0", whiteSpace: "nowrap" }}>{p.rangeLabel}</td>
                    {series.map((se) => <td key={se.id} style={{ textAlign: "right", padding: "4px 8px" }}>{valueFormatter(p.values[se.id] || 0)}</td>)}
                    {series.length >= 2 && <td style={{ textAlign: "right", padding: "4px 0 4px 8px", fontWeight: 700 }}>{valueFormatter(totals[i])}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export { StackedBars };
