// Contratantes · visão geral (versão ajustada do Tomás):
//  · cartão do topo: título + filtros (Horas | Receita, 6 | 12 meses); à esquerda o período atual
//    (total grande, barra com a fatia de cada contratante e legenda); à direita "Mês a mês"
//    (gráfico baixo, períodos ainda sem dados em marcador tracejado);
//  · lista: uma linha por contratante com o período ATUAL, ordenada por valor a receber.
//    "Variação" e "Tendência" só aparecem quando já há 3 períodos fechados com horas.
//    Faturação/Pagamento sem data mostram "Definir dia" (nunca "—").
import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, FONT } from "../../../styles/tokens.js";
import { fmtHoursScreen, compactEuro, monthAbbr } from "../../../models/utils.js";
import { clientsOfContractor } from "../../../models/contractors.js";
import { contractorDates, changePct } from "../../../models/contractorStats.js";
import { FIN } from "../../../models/i18nFin.js";
import { T } from "../../../models/i18n.js";
import { Card, Pill, SegmentedControl } from "../../shared/ui/index.js";
import { StackedBars } from "./StackedBars.jsx";
import { Dot, DateChip, eur0, fmtDay } from "./financeUi.jsx";

const hoursAxis = (v) => `${Math.round(v)}h`;

export function Sparkline({ values, color, width = 74, height = 24 }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${2 + i * step},${height - 3 - ((height - 6) * v) / max}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={2 + (values.length - 1) * step} cy={height - 3 - ((height - 6) * values[values.length - 1]) / max} r={2.6} fill={color} stroke={COLORS.card} strokeWidth={1.5} />
    </svg>
  );
}

export function ChangeBadge({ pct }) {
  if (pct == null) return <span style={{ color: COLORS.ink3 }}>—</span>;
  const up = pct >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 700, color: up ? COLORS.okInk : COLORS.clayInk }}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(pct)}%
    </span>
  );
}

// Filtros do gráfico: métrica e janela. `has12` = já há 12 períodos de histórico.
export function WindowFilter({ lang, has12, months, setMonths }) {
  const f = FIN[lang];
  if (!has12) return null;
  return <SegmentedControl options={[{ value: 6, label: f.months6 }, { value: 12, label: f.months12 }]} value={months} onChange={setMonths} />;
}

const linkBtn = { border: "none", background: "transparent", color: COLORS.vivo, fontWeight: 700, fontSize: 13, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit", padding: 0 };

function ContractorsOverview({ lang, tier, contractors, clients, periods, today, onOpen, onDefineDay }) {
  const f = FIN[lang];
  const isPhone = tier === "mobile";
  const [metric, setMetric] = useState("hours");
  const [months, setMonths] = useState(6);
  const eurMode = metric === "eur";
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];

  const valueOf = (d) => (!d ? 0 : eurMode ? d.value || 0 : d.hours);
  const fmtVal = (v) => (eurMode ? eur0(v) : fmtHoursScreen(v));

  // Janela do gráfico: sempre 6 ou 12 posições; as que ainda não têm período ficam vazias (tracejado).
  const real = periods.slice(-months);
  const firstEnd = real[0].end;
  const empties = Array.from({ length: months - real.length }, (_, i) => {
    const k = months - real.length - i;
    const d = new Date(firstEnd.getFullYear(), firstEnd.getMonth() - k, 1);
    return { key: `empty-${k}`, label: monthAbbr(lang, d.getMonth()), rangeLabel: "", isCurrent: false, empty: true, values: {} };
  });
  const series = contractors
    .filter((c) => real.some((p) => valueOf(p.contractors.get(c.id)) > 0))
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));
  const chartPeriods = [
    ...empties,
    ...real.map((p) => ({
      key: p.key, label: p.label, rangeLabel: p.rangeLabel, isCurrent: p.isCurrent,
      values: Object.fromEntries(series.map((se) => [se.id, valueOf(p.contractors.get(se.id))])),
    })),
  ];
  const hasDirectHours = eurMode && contractors.some((c) => real.some((p) => { const e = p.contractors.get(c.id); return e && e.hours > 0 && (e.value == null || e.missingPrice > 0); }));

  // Linhas (período atual), do maior valor a receber para o menor; sem valor vão para o fim.
  const rows = contractors.map((c) => {
    const d = current.contractors.get(c.id);
    const pd = previous ? previous.contractors.get(c.id) : null;
    return {
      c, hours: d ? d.hours : 0, value: d ? d.value : null, dates: contractorDates(c, current.end, today),
      change: changePct(d ? d.hours : 0, pd ? pd.hours : 0),
      trend: periods.slice(-6).map((p) => (p.contractors.get(c.id) ? p.contractors.get(c.id).hours : 0)),
      clientsN: clientsOfContractor(clients, c).length,
    };
  }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || b.hours - a.hours);

  // Variação e Tendência só quando houver 3 períodos fechados com horas.
  const closedWithHours = periods.filter((p) => !p.isCurrent && Array.from(p.contractors.values()).some((e) => e.hours > 0)).length;
  const showTrend = closedWithHours >= 3;

  // Fatias do período atual (só quem tem valor > 0 na métrica escolhida).
  const slices = rows.map((r) => ({ r, v: eurMode ? r.value || 0 : r.hours })).filter((s) => s.v > 0).sort((a, b) => b.v - a.v);
  const total = slices.reduce((s, x) => s + x.v, 0);
  const noPrice = eurMode ? rows.filter((r) => r.value == null && r.hours > 0) : [];
  const pctOf = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const hdr = { fontSize: 12, fontWeight: 600, color: COLORS.ink3 };
  const cols = showTrend
    ? "minmax(150px, 2fr) 0.7fr 0.9fr 1fr 0.8fr 0.9fr 1.3fr 1.3fr 24px"
    : "minmax(160px, 2fr) 0.8fr 1fr 1.1fr 1.4fr 1.4fr 24px";

  const stage = (r, key) => {
    const date = r.dates ? (key === "billing" ? r.dates.billing : r.dates.payment) : null;
    if (!date) return <button type="button" onClick={(e) => { e.stopPropagation(); onDefineDay(r.c); }} style={linkBtn}>{f.defineDay}</button>;
    const days = key === "billing" ? r.dates.billingIn : r.dates.paymentIn;
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><strong style={{ fontWeight: 600 }}>{fmtDay(date, lang)}</strong><DateChip days={days} next={false} lang={lang} /></span>;
  };
  const stageShort = (r, key) => {
    const date = r.dates ? (key === "billing" ? r.dates.billing : r.dates.payment) : null;
    const label = key === "billing" ? f.billing : f.payment;
    if (!date) return <button type="button" onClick={(e) => { e.stopPropagation(); onDefineDay(r.c); }} style={{ ...linkBtn, fontSize: 12.5 }}>{label}: {f.defineDay.toLowerCase()}</button>;
    return <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{label}: <strong style={{ fontWeight: 600, color: COLORS.ink }}>{fmtDay(date, lang)}</strong></span>;
  };
  const rowKey = (e, r) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onOpen(r.c); } };
  const directPill = (r) => r.c.isDirect && <Pill variant="neutral">{T[lang].contratantes.direct}</Pill>;

  const left = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.curPeriod} · {current.rangeLabel}</div>
      <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: isPhone ? 28 : 32, color: COLORS.ink, lineHeight: 1.15, margin: "4px 0 10px" }}>{total > 0 ? fmtVal(total) : "—"}</div>
      {total > 0 && (
        <div style={{ display: "flex", height: 26, borderRadius: 99, overflow: "hidden", gap: 2 }} role="img" aria-label={slices.map((s) => `${s.r.c.name} ${pctOf(s.v)}%`).join(", ")}>
          {slices.map((s) => (
            <div key={s.r.c.id} style={{ flex: `${s.v} 1 0`, background: s.r.c.color, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
              {pctOf(s.v) >= 8 ? `${pctOf(s.v)}%` : ""}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
        {slices.map((s) => (
          <div key={s.r.c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <Dot color={s.r.c.color} size={10} />
            <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.r.c.name}</span>
            <span style={{ color: COLORS.ink2 }}>{fmtVal(s.v)}</span>
            <span style={{ width: 38, textAlign: "right", color: COLORS.ink3 }}>{pctOf(s.v)}%</span>
          </div>
        ))}
        {noPrice.map((r) => (
          <div key={r.c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "repeating-linear-gradient(135deg, #D9DEDB 0 3px, #EEF1EF 3px 6px)", flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{r.c.name}</span><span>{f.noPriceShort}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const right = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 2 }}>{f.monthly}</div>
      <StackedBars
        periods={chartPeriods} series={series} compact={isPhone || months > 8 && tier !== "desktop"} height={150} showLegend={false}
        valueFormatter={eurMode ? compactEuro : fmtHoursScreen} axisFormatter={eurMode ? compactEuro : hoursAxis}
        ariaLabel={f.overviewTitle} totalLabel={f.total} tableLabel={f.tableView} emptyLabel={f.noData}
      />
      {periods.length < 2 && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{f.histNote(monthAbbr(lang, real[0].end.getMonth()))}</div>}
      {hasDirectHours && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 6 }}>{f.directNoRevenue}</div>}
    </div>
  );

  return (
    <>
      <Card style={{ marginBottom: isPhone ? 12 : 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "1 1 200px", fontFamily: FONT.heading, fontWeight: 700, fontSize: 17, color: COLORS.ink }}>{f.overviewTitle}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SegmentedControl options={[{ value: "hours", label: f.hours }, { value: "eur", label: f.revenue }]} value={metric} onChange={setMetric} />
            <SegmentedControl options={[{ value: 6, label: f.months6 }, { value: 12, label: f.months12 }]} value={months} onChange={setMonths} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "minmax(0, 1fr) minmax(0, 1.15fr)", gap: isPhone ? 18 : 36, alignItems: "start" }}>
          {left}{right}
        </div>
      </Card>

      {rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: isPhone ? 10 : 0, background: isPhone ? "transparent" : COLORS.card, border: isPhone ? "none" : `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden" }}>
          {!isPhone && (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "12px 18px", background: COLORS.headerTint, borderBottom: `1px solid ${COLORS.line}` }}>
              <span style={hdr}>{T[lang].contratantes.colName}</span><span style={hdr}>{f.colClients}</span><span style={hdr}>{f.colHours}</span><span style={hdr}>{f.colReceive}</span>
              {showTrend && <><span style={hdr}>{f.colTrend}</span><span style={hdr}>{f.colChange}</span></>}
              <span style={hdr}>{f.billing}</span><span style={hdr}>{f.payment}</span><span />
            </div>
          )}
          {rows.map((r, i) => (
            isPhone ? (
              <div key={r.c.id} role="button" tabIndex={0} onClick={() => onOpen(r.c)} onKeyDown={(e) => rowKey(e, r)} style={{ cursor: "pointer", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Dot color={r.c.color} size={11} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.c.name}</span>
                  {directPill(r)}
                  <span style={{ flex: 1 }} />
                  {showTrend && <ChangeBadge pct={r.change} />}
                  <ChevronRight size={16} color={COLORS.ink3} aria-hidden="true" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: showTrend ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 8, fontSize: 12, color: COLORS.ink3 }}>
                  <div>{f.colHours}<div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtHoursScreen(r.hours)}</div></div>
                  <div>{f.colReceive}<div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{r.value != null ? eur0(r.value) : "—"}</div></div>
                  <div>{f.colClients}<div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{r.clientsN}</div></div>
                  {showTrend && <div>{f.colTrend}<div style={{ marginTop: 3 }}><Sparkline values={r.trend} color={r.c.color} width={60} /></div></div>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", paddingTop: 8, borderTop: `1px solid ${COLORS.lineSoft}` }}>
                  {stageShort(r, "billing")}{stageShort(r, "payment")}
                </div>
              </div>
            ) : (
              <div
                key={r.c.id} role="button" tabIndex={0} onClick={() => onOpen(r.c)} onKeyDown={(e) => rowKey(e, r)}
                style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", cursor: "pointer", borderTop: i === 0 ? "none" : `1px solid ${COLORS.lineSoft}`, background: COLORS.card, padding: "14px 18px", fontSize: 13.5, color: COLORS.ink }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Dot color={r.c.color} size={11} />
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.c.name}</span>
                  {directPill(r)}
                </span>
                <span>{r.clientsN}</span>
                <span style={{ fontWeight: 600 }}>{fmtHoursScreen(r.hours)}</span>
                <span style={{ fontFamily: FONT.heading, fontWeight: 700 }}>{r.value != null ? eur0(r.value) : <span style={{ color: COLORS.ink3, fontFamily: "inherit", fontWeight: 400 }}>—</span>}</span>
                {showTrend && <><span><Sparkline values={r.trend} color={r.c.color} /></span><span><ChangeBadge pct={r.change} /></span></>}
                <span>{stage(r, "billing")}</span>
                <span>{stage(r, "payment")}</span>
                <ChevronRight size={16} color={COLORS.ink3} aria-hidden="true" />
              </div>
            )
          ))}
        </div>
      )}
    </>
  );
}

export { ContractorsOverview };
