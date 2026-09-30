import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";

function KpiCard({ label, value, icon: Icon, tint, iconColor }) {
  return (
    <div style={styles.kpiCard}>
      {Icon ? (
        <div style={styles.kpiTopRow}>
          <div style={{ ...styles.kpiIconBadge, background: tint || COLORS.primaryTint }}>
            <Icon size={16} color={iconColor || COLORS.primary} />
          </div>
          <div style={{ ...styles.kpiLabel, marginBottom: 0 }}>{label}</div>
        </div>
      ) : (
        <div style={styles.kpiLabel}>{label}</div>
      )}
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function PendingRow({ label, count, last, onClick }) {
  return (
    <button style={{ ...styles.dashPendingRow, borderBottom: last ? "none" : `1px solid ${COLORS.border}` }} onClick={onClick}>
      <span style={styles.dashPendingLabel}>{label}</span>
      <span style={styles.dashPendingRight}>
        <span style={styles.dashPendingCount}>{count}</span>
        <ChevronRight size={14} color={COLORS.textSoft} />
      </span>
    </button>
  );
}

function ComplaintsGauge({ current, excelenteThreshold, razoavelThreshold, t, complaintsThisMonthLabel }) {
  const cx = 90, cy = 96, r = 80, innerR = 42;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const polar = (radius, deg) => ({ x: cx + radius * Math.cos(toRad(deg)), y: cy + radius * Math.sin(toRad(deg)) });
  function wedgePath(startDeg, endDeg) {
    const outerStart = polar(r, startDeg), outerEnd = polar(r, endDeg);
    const innerEnd = polar(innerR, endDeg), innerStart = polar(innerR, startDeg);
    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${outerStart.x} ${outerStart.y} A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
  }
  // 3 faixas iguais no visual (verde/amarelo/vermelho); o ponteiro se move
  // dentro delas de forma proporcional aos limiares configurados em Definições.
  // -180° = esquerda (0 reclamações), -90° = topo, 0° = direita (crítico).
  const zones = [
    { color: "#6EBE4A", from: -180, to: -120 },
    { color: "#F4C542", from: -120, to: -60 },
    { color: "#E14B3D", from: -60, to: 0 },
  ];
  // Excelente/Razoável agora vêm de Definições (escalam com nº de clientes);
  // acima do limite razoável já é crítico — não é mais um 3º valor configurado.
  const excelente = Math.max(0, excelenteThreshold ?? 0);
  const razoavel = Math.max(excelente + 1, razoavelThreshold || excelente + 1);
  const maxValue = razoavel * 1.5;
  function angleFor(value) {
    if (value <= 0) return -180;
    if (excelente > 0 && value <= excelente) return -180 + (value / excelente) * 60;
    if (value <= razoavel) return -120 + ((value - excelente) / (razoavel - excelente || 1)) * 60;
    const over = Math.min(value, maxValue);
    return -60 + ((over - razoavel) / (maxValue - razoavel || 1)) * 60;
  }
  const zoneLabel = current <= excelente ? t.excelente : current <= razoavel ? t.razoavel : t.critico;
  const zoneColor = current <= excelente ? "#2F9E64" : current <= razoavel ? "#C99A1E" : "#C1432B";
  const needleAngle = angleFor(current);
  const needleLen = r - 4;
  const needleTip = polar(needleLen, needleAngle);
  const needleBaseL = polar(10, needleAngle - 90), needleBaseR = polar(10, needleAngle + 90);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="180" height="118" viewBox="0 0 180 118">
        {zones.map((z, i) => <path key={i} d={wedgePath(z.from, z.to)} fill={z.color} />)}
        <polygon points={`${needleTip.x},${needleTip.y} ${needleBaseL.x},${needleBaseL.y} ${needleBaseR.x},${needleBaseR.y}`} fill="#1A1A1A" />
        <circle cx={cx} cy={cy} r="13" fill="#1A1A1A" />
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: zoneColor, marginTop: 2 }}>{zoneLabel}</div>
      <div style={styles.gaugeLegend}>
        <div style={styles.gaugeLegendItem}><div style={styles.gaugeLegendLabel}>{complaintsThisMonthLabel}</div><div style={{ ...styles.gaugeLegendValue, color: COLORS.primary }}>{current}</div></div>
      </div>
    </div>
  );
}

// Escolhe um "topo" arredondado (0 / 5 / 10 / 25 / 50 / 100 ...) pra grade do
// eixo Y ficar em números limpos, em vez de usar o valor máximo cru.
function niceCeiling(max) {
  if (max <= 0) return 1;
  // Passos mais finos que o 1/2/5/10 clássico — com só 1/2/5 um valor como
  // 11276 salta pra 20000 e desperdiça metade da altura do gráfico; com esses
  // degraus intermediários ele para em 12000, aproveitando o espaço de verdade.
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  for (const s of steps) {
    const candidate = s * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

function roundedTopBarPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h);
  if (h <= 0) return "";
  return `M ${x} ${y + h} L ${x} ${y + rad} Q ${x} ${y} ${x + rad} ${y} L ${x + w - rad} ${y} Q ${x + w} ${y} ${x + w} ${y + rad} L ${x + w} ${y + h} Z`;
}

function BarChart({ data, labels, tooltipLabels, valueFormatter, tooltipValueFormatter }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 150, padL = 26, padR = 6, padTop = 20, padBottom = 20, barGap = 10;
  const fmt = valueFormatter || ((v) => `${v}`);
  // Rótulo em cima da barra usa `fmt` (compacto, cabe no slot); o tooltip no
  // hover usa a versão completa quando informada, senão cai no mesmo `fmt`.
  const fmtTooltip = tooltipValueFormatter || fmt;
  const plotW = w - padL - padR;
  const plotH = h - padTop - padBottom;
  const ceiling = niceCeiling(Math.max(...data, 1));
  const gridSteps = [0, 0.5, 1];
  const barW = (plotW - barGap * (data.length - 1)) / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: 340, overflow: "visible" }}>
      {gridSteps.map((s, i) => {
        const y = padTop + plotH * (1 - s);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke={COLORS.border} strokeWidth="1" />
            <text x={padL - 6} y={y + 3} fontSize="8" fill={COLORS.textSoft} textAnchor="end">{Math.round(ceiling * s)}</text>
          </g>
        );
      })}
      {data.map((v, i) => {
        const barH = ceiling > 0 ? (v / ceiling) * plotH : 0;
        const x = padL + i * (barW + barGap);
        const y = padTop + plotH - barH;
        const isHover = hoverIdx === i;
        return (
          <g
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: "default" }}
          >
            <rect x={x} y={padTop} width={barW} height={plotH} fill="transparent" />
            <path d={roundedTopBarPath(x, y, barW, barH, 4)} fill={isHover ? COLORS.primaryDark : COLORS.primary}>
              <title>{`${(tooltipLabels && tooltipLabels[i]) || labels[i]}: ${fmtTooltip(v)}`}</title>
            </path>
            <text x={x + barW / 2} y={Math.max(y - 5, 10)} fontSize="10" fontWeight="700" fill={COLORS.text} textAnchor="middle">{fmt(v)}</text>
            <text x={x + barW / 2} y={h - 6} fontSize="9" fill={COLORS.textSoft} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, labels, tooltipLabels, valueFormatter }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 150, padL = 26, padR = 10, padTop = 22, padBottom = 20;
  const fmt = valueFormatter || ((v) => `${v}`);
  const plotW = w - padL - padR;
  const plotH = h - padTop - padBottom;
  const ceiling = niceCeiling(Math.max(...data, 1));
  const gridSteps = [0, 0.5, 1];
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const points = data.map((v, i) => ({
    x: padL + i * stepX,
    y: padTop + plotH * (1 - (ceiling > 0 ? v / ceiling : 0)),
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: 340, overflow: "visible" }}>
      {gridSteps.map((s, i) => {
        const y = padTop + plotH * (1 - s);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke={COLORS.border} strokeWidth="1" />
            <text x={padL - 6} y={y + 3} fontSize="8" fill={COLORS.textSoft} textAnchor="end">{Math.round(ceiling * s)}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const isHover = hoverIdx === i;
        return (
          <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "default" }}>
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={isHover ? 5.5 : 4} fill={COLORS.primary} stroke={COLORS.surface} strokeWidth="2">
              <title>{`${(tooltipLabels && tooltipLabels[i]) || labels[i]}: ${fmt(data[i])}`}</title>
            </circle>
            <text x={p.x} y={Math.max(p.y - 9, 10)} fontSize="10" fontWeight="700" fill={COLORS.text} textAnchor="middle">{fmt(data[i])}</text>
            <text x={p.x} y={h - 6} fontSize="9" fill={COLORS.textSoft} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export { KpiCard, PendingRow, ComplaintsGauge, BarChart, LineChart };
