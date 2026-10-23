// Contratantes · visão geral: gráfico de barras empilhadas (Horas | Receita, 6 | 12 meses)
// e, por baixo, uma linha por contratante com o período ATUAL (a lista não muda com o filtro).
// O filtro 6 | 12 meses só aparece quando já há 12 períodos de histórico; começa sempre em 6.
import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, FONT } from "../../../styles/tokens.js";
import { fmtHoursScreen, fmtEuro, compactEuro } from "../../../models/utils.js";
import { clientsOfContractor } from "../../../models/contractors.js";
import { contractorDates, changePct } from "../../../models/contractorStats.js";
import { FIN } from "../../../models/i18nFin.js";
import { T } from "../../../models/i18n.js";
import { Card, Pill, SegmentedControl } from "../../shared/ui/index.js";
import { StackedBars } from "./StackedBars.jsx";
import { Dot, fmtDay } from "./financeUi.jsx";

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

function ContractorsOverview({ lang, tier, contractors, clients, periods, has12, today, onOpen }) {
  const f = FIN[lang];
  const isPhone = tier === "mobile";
  const [metric, setMetric] = useState("hours");
  const [months, setMonths] = useState(6);
  const win = periods.slice(-(has12 ? months : 6));
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];

  const valueOf = (d) => (metric === "hours" ? d.hours : d.value || 0);
  const series = contractors
    .filter((c) => win.some((p) => (p.contractors.get(c.id) ? valueOf(p.contractors.get(c.id)) : 0) > 0))
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));
  const chartPeriods = win.map((p) => ({
    key: p.key, label: p.label, rangeLabel: p.rangeLabel, isCurrent: p.isCurrent,
    values: Object.fromEntries(series.map((se) => [se.id, p.contractors.get(se.id) ? valueOf(p.contractors.get(se.id)) : 0])),
  }));
  const hasDirectHours = metric === "eur" && contractors.some((c) => (c.isDirect || !(Number(c.rate) > 0)) && win.some((p) => (p.contractors.get(c.id)?.hours || 0) > 0));

  const rows = contractors.map((c) => {
    const d = current.contractors.get(c.id);
    const pd = previous ? previous.contractors.get(c.id) : null;
    const dates = contractorDates(c, current.end, today);
    return {
      c, hours: d ? d.hours : 0, value: d ? d.value : null, dates,
      change: changePct(d ? d.hours : 0, pd ? pd.hours : 0),
      trend: periods.slice(-6).map((p) => (p.contractors.get(c.id) ? p.contractors.get(c.id).hours : 0)),
      clientsN: clientsOfContractor(clients, c).length,
    };
  });

  const datesLines = (r) => (r.dates ? [`${f.billing} ${fmtDay(r.dates.billing, lang)}`, ...(r.dates.payment ? [`${f.payment} ${fmtDay(r.dates.payment, lang)}`] : [])] : ["—"]);
  const datesText = (r) => datesLines(r).join(" · ");
  const hdr = { fontSize: 12, fontWeight: 600, color: COLORS.ink3 };
  const cols = "minmax(150px, 2.2fr) 0.9fr 1fr 1.1fr 1fr 0.9fr minmax(180px, 2fr)";

  return (
    <>
      <Card style={{ marginBottom: isPhone ? 12 : 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{f.overviewTitle}</div>
            <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{f.overviewHint}</div>
          </div>
          <div className="chip-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SegmentedControl options={[{ value: "hours", label: f.hours }, { value: "eur", label: f.revenue }]} value={metric} onChange={setMetric} />
            <WindowFilter lang={lang} has12={has12} months={months} setMonths={setMonths} />
          </div>
        </div>
        <StackedBars
          periods={chartPeriods} series={series} compact={isPhone || win.length > 8 && tier !== "desktop"}
          valueFormatter={metric === "hours" ? fmtHoursScreen : compactEuro} axisFormatter={metric === "hours" ? hoursAxis : compactEuro}
          ariaLabel={f.overviewTitle} totalLabel={f.total} tableLabel={f.tableView} emptyLabel={f.noData}
        />
        {hasDirectHours && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 6 }}>{f.directNoRevenue}</div>}
      </Card>

      {contractors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: isPhone ? 10 : 0, background: isPhone ? "transparent" : COLORS.card, border: isPhone ? "none" : `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden" }}>
          {!isPhone && (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "12px 18px", background: COLORS.headerTint, borderBottom: `1px solid ${COLORS.line}` }}>
              <span style={hdr}>{T[lang].contratantes.colName}</span><span style={hdr}>{f.colClients}</span><span style={hdr}>{f.colHours}</span><span style={hdr}>{f.colReceive}</span>
              <span style={hdr}>{f.colTrend}</span><span style={hdr}>{f.colChange}</span><span style={hdr}>{f.colDates}</span>
            </div>
          )}
          {rows.map((r, i) => (
            isPhone ? (
              <button key={r.c.id} type="button" onClick={() => onOpen(r.c)} style={{ textAlign: "left", fontFamily: "inherit", cursor: "pointer", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Dot color={r.c.color} size={11} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.c.name}</span>
                  {r.c.isDirect && <Pill variant="neutral">{T[lang].contratantes.direct}</Pill>}
                  <ChangeBadge pct={r.change} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12, color: COLORS.ink3 }}>
                  <div>{f.colHours}<div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtHoursScreen(r.hours)}</div></div>
                  <div>{f.colReceive}<div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{r.value != null ? fmtEuro(r.value).replace(/,00$/, "") : "—"}</div></div>
                  <div>{f.colTrend}<div style={{ marginTop: 3 }}><Sparkline values={r.trend} color={r.c.color} /></div></div>
                </div>
                <div style={{ fontSize: 12, color: COLORS.ink2 }}>{f.clientsN(r.clientsN)} · {datesText(r)}</div>
              </button>
            ) : (
              <button
                key={r.c.id} type="button" onClick={() => onOpen(r.c)}
                style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", textAlign: "left", fontFamily: "inherit", cursor: "pointer", border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.lineSoft}`, background: COLORS.card, padding: "14px 18px", fontSize: 13.5, color: COLORS.ink }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Dot color={r.c.color} size={11} />
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.c.name}</span>
                  {r.c.isDirect && <Pill variant="neutral">{T[lang].contratantes.direct}</Pill>}
                </span>
                <span>{r.clientsN}</span>
                <span style={{ fontWeight: 600 }}>{fmtHoursScreen(r.hours)}</span>
                <span style={{ fontFamily: FONT.heading, fontWeight: 700 }}>{r.value != null ? fmtEuro(r.value).replace(/,00$/, "") : <span style={{ color: COLORS.ink3, fontFamily: "inherit", fontWeight: 400 }}>—</span>}</span>
                <span><Sparkline values={r.trend} color={r.c.color} /></span>
                <span><ChangeBadge pct={r.change} /></span>
                <span style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.45 }}>{datesLines(r).map((l) => <span key={l} style={{ display: "block" }}>{l}</span>)}</span>
              </button>
            )
          ))}
        </div>
      )}
    </>
  );
}

export { ContractorsOverview };
