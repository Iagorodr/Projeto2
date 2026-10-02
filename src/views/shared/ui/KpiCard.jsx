// Cartão de KPI (documento de design, 2.2): bloco de ícone, rótulo, número
// grande. A variante herói (`variant="hero"`) mostra também uma barra
// segmentada com legenda — usada quando o KPI é composto por partes (ex.:
// "41 clientes" = "32 fixos + 9 replacement").
//
// Introduzido na Etapa 2 (componentes); já ligado ao Dashboard e ao
// Histórico da gerência desde a Etapa 4 — não tem relação com o `KpiCard`
// antigo que existia em `DashboardWidgets.jsx`, ficheiro removido do
// projeto na limpeza pós-Etapa 4 (estava inteiro órfão, sem import).
import { COLORS } from "../../../styles/colors.js";
import { FONT } from "../../../styles/tokens.js";
import { Card } from "./Card.jsx";

// `segments`: [{ label, value, color }] — só usado quando variant="hero".
function SegmentedBar({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,.25)" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ width: `${(seg.value / total) * 100}%`, background: seg.color || "#fff" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 10 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color || "#fff", flexShrink: 0 }} />
            <span style={{ opacity: 0.9 }}>{seg.label}</span>
            <span style={{ fontWeight: 600 }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// `iconBg`/`iconColor`: só pro caso não-herói (o Dashboard, 4.1, pede o
// ícone do KPI "Replacement" em clay-tint, diferente do forest-tint por
// defeito dos outros); omitidos, mantém exatamente o visual de sempre.
// `children`: conteúdo extra por baixo do número (o Dashboard usa isto
// pros "5 avatares empilhados e '+8'" do KPI "Funcionários ativos") — sem
// `children`, o cartão fica exatamente como já estava.
function KpiCard({ icon: Icon, label, value, variant = "default", segments, iconBg, iconColor, children, style }) {
  const isHero = variant === "hero";
  return (
    <Card variant={isHero ? "hero" : "default"} style={{ minHeight: 172, display: "flex", flexDirection: "column", ...style }}>
      {Icon && (
        <div
          style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isHero ? "rgba(255,255,255,.16)" : (iconBg || COLORS.forest50),
            color: isHero ? "#fff" : (iconColor || COLORS.forest600),
            marginBottom: 14,
          }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      )}
      <div style={{ fontSize: 13, color: isHero ? "rgba(255,255,255,.85)" : COLORS.ink2, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 36, lineHeight: 1.1, color: isHero ? "#fff" : COLORS.ink }}>
        {value}
      </div>
      {isHero && segments && segments.length > 0 && <SegmentedBar segments={segments} />}
      {children}
    </Card>
  );
}

export { KpiCard };
