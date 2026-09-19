import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";

function KpiCard({ label, value }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
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

function ComplaintsGauge({ current, razoavelThreshold, criticoThreshold, t }) {
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
  const razoavel = razoavelThreshold || 1;
  const critico = criticoThreshold || razoavel * 2;
  const maxValue = critico * 1.5;
  function angleFor(value) {
    if (value <= 0) return -180;
    if (value <= razoavel) return -180 + (value / razoavel) * 60;
    if (value <= critico) return -120 + ((value - razoavel) / (critico - razoavel || 1)) * 60;
    const over = Math.min(value, maxValue);
    return -60 + ((over - critico) / (maxValue - critico || 1)) * 60;
  }
  const zoneLabel = current <= 0 ? t.excelente : current <= razoavel ? t.razoavel : t.critico;
  const zoneColor = current <= 0 ? "#2F9E64" : current <= razoavel ? "#C99A1E" : "#C1432B";
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
        <div style={styles.gaugeLegendItem}><div style={styles.gaugeLegendLabel}>Reclamações este mês</div><div style={{ ...styles.gaugeLegendValue, color: COLORS.primary }}>{current}</div></div>
      </div>
    </div>
  );
}

function BarChart({ data, labels }) {
  const w = 320, h = 140, pad = 8, barGap = 10;
  const max = Math.max(...data);
  const barW = (w - pad * 2 - barGap * (data.length - 1)) / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: 340 }}>
      {data.map((v, i) => {
        const barH = (v / max) * (h - 24), x = pad + i * (barW + barGap), y = h - 20 - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="4" fill={COLORS.primary} />
            <text x={x + barW / 2} y={h - 6} fontSize="9" fill={COLORS.textSoft} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, labels }) {
  const w = 320, h = 140, pad = 10;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => ({ x: pad + i * stepX, y: 16 + (1 - (v - min) / range) * (h - 40) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: 340 }}>
      <path d={path} fill="none" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={COLORS.primary} />)}
      {labels.map((l, i) => <text key={i} x={points[i].x} y={h - 4} fontSize="9" fill={COLORS.textSoft} textAnchor="middle">{l}</text>)}
    </svg>
  );
}

export { KpiCard, PendingRow, ComplaintsGauge, BarChart, LineChart };
