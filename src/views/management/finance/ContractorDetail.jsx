// Contratantes · detalhe de um contratante: abas Resumo / Clientes / Relatórios de horas /
// Documentos. Resumo = 3 gráficos (Horas por mês, Horas por cliente, Valor a receber) só com
// os dados deste contratante, filtro 6 | 12 meses (só quando há 12 períodos) e
// "Pré-visualizar relatório". Relatórios e Documentos chegam com o fecho do mês (etapa seguinte).
import { useState, useEffect } from "react";
import { ArrowLeft, Pencil, FileText } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { fmtHoursScreen, fmtEuro, compactEuro, clientById } from "../../../models/utils.js";
import { clientsOfContractor, marginPerHour } from "../../../models/contractors.js";
import { changePct } from "../../../models/contractorStats.js";
import { FIN } from "../../../models/i18nFin.js";
import { T } from "../../../models/i18n.js";
import { Card, Pill, Button, Drawer, ChartHeaderLite } from "./detailParts.jsx";
import { StackedBars } from "./StackedBars.jsx";
import { WindowFilter } from "./ContractorsOverview.jsx";
import { Dot } from "./financeUi.jsx";
import { ReportsTab, DocsTab } from "./ClosingTabs.jsx";
import { ClosingWizard } from "./ClosingWizard.jsx";
import { buildContractorReport } from "../../../models/contractorReport.js";
import { ReportDetail } from "./ReportDetail.jsx";
import { findClosing } from "../../../models/contractorClosings.js";
import { getOpenPeriod, isoDateStr } from "../../../models/utils.js";
import { TODAY } from "../../../models/data.js";

const hoursAxis = (v) => `${Math.round(v)}h`;
const eurCell = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? "—" : `${Number(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

// Campo de preço por cliente (contratante direto): grava ao sair do campo / Enter, não a cada tecla
// (cada gravação envia a tabela de clientes).
function PriceInput({ value, onCommit, label }) {
  const [txt, setTxt] = useState(value === "" || value == null ? "" : String(value));
  useEffect(() => { setTxt(value === "" || value == null ? "" : String(value)); }, [value]);
  const commit = () => {
    const raw = txt.trim().replace(",", ".");
    const n = raw === "" ? "" : Number(raw);
    if (raw !== "" && !(n >= 0)) { setTxt(value === "" || value == null ? "" : String(value)); return; }
    if (n !== value) onCommit(n);
  };
  return (
    <input
      type="text" inputMode="decimal" aria-label={label} placeholder="—" value={txt}
      onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={{ width: 78, textAlign: "right", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: "6px 8px", fontSize: 13.5, fontFamily: "inherit", background: COLORS.card, color: COLORS.ink }}
    />
  );
}

function ClientHoursBars({ rows, color, lang }) {
  const f = FIN[lang];
  const max = Math.max(1, ...rows.map((r) => r.hours));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
          <span style={{ flex: "0 0 38%", minWidth: 0, color: r.other ? COLORS.ink3 : COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.other ? f.others(r.count) : r.name}</span>
          <span style={{ flex: 1, height: 8, background: COLORS.lineSoft, borderRadius: 99, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(r.hours / max) * 100}%`, background: r.other ? COLORS.forest200 : color, borderRadius: 99 }} />
          </span>
          <span style={{ width: 52, textAlign: "right", fontWeight: 600, color: COLORS.ink }}>{fmtHoursScreen(r.hours)}</span>
        </div>
      ))}
    </div>
  );
}

function ContractorDetail({ lang, tier, contractor: c, clients, periods, has12, closings, horasData, staff, assignments, covers, absences, cutoffDay, closedPeriods, onSaveClosing, companyName, who, onNavigate, onSetClientPrice, initialTab, onBack, onEdit }) {
  const f = FIN[lang];
  const tc = T[lang].contratantes;
  const isPhone = tier === "mobile";
  const [tab, setTab] = useState(initialTab || "summary");
  const [months, setMonths] = useState(6);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [wizardIso, setWizardIso] = useState(null);
  const [notice, setNotice] = useState(null);
  const showNotice = (text, bad) => { setNotice({ text, bad: !!bad }); setTimeout(() => setNotice(null), 6000); };
  const openPeriodIso = isoDateStr(getOpenPeriod(closedPeriods || [], cutoffDay, TODAY).end);
  const wizardPeriod = wizardIso ? periods.find((p) => p.iso === wizardIso) : null;

  const win = periods.slice(-(has12 ? months : 6));
  const current = periods[periods.length - 1];
  const dataOf = (p) => p.contractors.get(c.id) || { hours: 0, value: c.isDirect ? null : 0, byClient: new Map() };
  const mine = clientsOfContractor(clients, c);
  const priced = c.isDirect ? periods.some((p) => dataOf(p).value != null) : Number(c.rate) > 0;

  const mkPeriods = (get) => win.map((p) => ({ key: p.key, label: p.label, rangeLabel: p.rangeLabel, isCurrent: p.isCurrent, values: { v: get(dataOf(p)) } }));
  const oneSeries = [{ id: "v", name: c.name, color: c.color }];
  const hoursPeriods = mkPeriods((d) => d.hours);
  const valuePeriods = mkPeriods((d) => d.value || 0);

  const cur = dataOf(current);
  const prev = periods.length > 1 ? dataOf(periods[periods.length - 2]) : null;

  // Horas por cliente na janela: 7 maiores + "+ N outros".
  const byClient = new Map();
  win.forEach((p) => dataOf(p).byClient.forEach((h, id) => byClient.set(id, (byClient.get(id) || 0) + h)));
  const sorted = [...byClient.entries()].map(([id, hours]) => ({ key: id, name: (clientById(clients, id) || {}).name || "—", hours })).sort((a, b) => b.hours - a.hours);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7);
  const clientRows = rest.length ? [...top, { key: "other", other: true, count: rest.length, hours: rest.reduce((s, r) => s + r.hours, 0) }] : top;

  const reportCtx = { staff, horasData, closedPeriods, assignments, today: TODAY };
  const detailReport = buildContractorReport({ contractor: c, clients, ...reportCtx, period: current });
  const reportRows = [...cur.byClient.entries()].map(([id, hours]) => ({ id, name: (clientById(clients, id) || {}).name || "—", hours })).sort((a, b) => a.name.localeCompare(b.name));
  const tabs = [["summary", f.tabSummary], ["clients", f.tabClients], ["reports", f.tabReports], ["docs", f.tabDocs]];

  const chartW = tier === "desktop" ? 270 : isPhone ? 340 : 560;
  const chartGrid = { display: "grid", gridTemplateColumns: tier === "desktop" ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: isPhone ? 12 : 20 };
  const cardTitle = (label, extra) => <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink2, marginBottom: 4 }}>{label}{extra}</div>;

  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.vivo, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", padding: "4px 0 10px" }}>
        <ArrowLeft size={16} /> {f.back}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <Dot color={c.color} size={14} />
        <h1 style={{ margin: 0, fontSize: isPhone ? 22 : 26, color: COLORS.ink, flex: "1 1 auto", minWidth: 0 }}>{c.name}</h1>
        {c.isDirect && <Pill variant="neutral">{tc.direct}</Pill>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" icon={Pencil} onClick={onEdit}>{f.edit}</Button>
          <Button variant="primary" icon={FileText} onClick={() => setPreviewOpen(true)}>{f.preview}</Button>
        </div>
      </div>

      {notice && <div role="status" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: RADIUS.control, fontSize: 13.5, fontWeight: 600, background: notice.bad ? COLORS.dangerBg : COLORS.amberBg, color: notice.bad ? COLORS.dangerInk : COLORS.amberInk }}>{notice.text}</div>}

      <div role="tablist" className="chip-row" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.line}`, marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(([k, label]) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, padding: "10px 14px", whiteSpace: "nowrap", color: tab === k ? COLORS.vivo : COLORS.ink2, borderBottom: tab === k ? `3px solid ${COLORS.vivo}` : "3px solid transparent", marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          {has12 && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><WindowFilter lang={lang} has12={has12} months={months} setMonths={setMonths} /></div>}
          <div style={chartGrid}>
            <Card>
              <ChartHeaderLite title={f.chartHoursMonth} value={fmtHoursScreen(cur.hours)} pct={prev ? changePct(cur.hours, prev.hours) : null} compareLabel={f.vsPrev} />
              <StackedBars periods={hoursPeriods} series={oneSeries} width={chartW} valueFormatter={fmtHoursScreen} axisFormatter={hoursAxis} ariaLabel={f.chartHoursMonth} tableLabel={f.tableView} emptyLabel={f.noData} height={170} />
            </Card>
            <Card>
              {cardTitle(f.chartHoursClient)}
              <div style={{ margin: "10px 0 6px" }}>
                {clientRows.length === 0 ? <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: COLORS.ink3 }}>{f.noData}</div> : <ClientHoursBars rows={clientRows} color={c.color} lang={lang} />}
              </div>
            </Card>
            <Card>
              <ChartHeaderLite
                title={f.chartValue} value={priced ? fmtEuro(cur.value || 0).replace(/,00$/, "") : "—"} pct={priced && prev ? changePct(cur.value || 0, prev.value || 0) : null} compareLabel={f.vsPrev}
                badge={<Pill variant="reopened">{f.estimate}</Pill>}
              />
              {priced
                ? <StackedBars periods={valuePeriods} series={oneSeries} width={chartW} valueFormatter={compactEuro} ariaLabel={f.chartValue} tableLabel={f.tableView} emptyLabel={f.noData} height={170} />
                : <div style={{ padding: "24px 0", fontSize: 13, color: COLORS.ink3 }}>{c.isDirect ? f.valueDirect : f.noPriceHint}</div>}
            </Card>
          </div>
        </>
      )}

      {tab === "clients" && (
        <Card>
          {mine.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.clientsEmpty}</div>
          ) : (
            <>
            {c.isDirect && <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 8 }}>{f.directPricesNote}</div>}
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: c.isDirect ? 560 : 420 }}>
                <div style={{ display: "flex", gap: 8, padding: "8px 4px", fontSize: 12, fontWeight: 600, color: COLORS.ink3 }}>
                  <span style={{ flex: 2 }}>{f.colClient}</span><span style={{ flex: 1, textAlign: "right" }}>{f.hours}</span>
                  {c.isDirect && <span style={{ flex: 1.3, textAlign: "right" }}>{f.sellPriceCol}</span>}
                  <span style={{ flex: 1, textAlign: "right" }}>{f.colPaysEmployee}</span><span style={{ flex: 1, textAlign: "right" }}>{f.colMarginHour}</span>
                </div>
                {mine.map((cl) => {
                  const m = marginPerHour(c, cl);
                  return (
                    <div key={cl.id} style={{ display: "flex", gap: 8, padding: "10px 4px", fontSize: 13.5, borderTop: `1px solid ${COLORS.lineSoft}` }}>
                      <span style={{ flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{cl.name}</span>
                      <span style={{ flex: 1, textAlign: "right" }}>{fmtHoursScreen(cur.byClient.get(cl.id) || 0)}</span>
                      {c.isDirect && <span style={{ flex: 1.3, textAlign: "right" }}><PriceInput value={cl.sellPrice} label={`${f.sellPriceCol} · ${cl.name}`} onCommit={(v) => onSetClientPrice && onSetClientPrice(cl.id, v)} /></span>}
                      <span style={{ flex: 1, textAlign: "right" }}>{eurCell(cl.valueHour)}</span>
                      <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: m === null ? COLORS.ink3 : m < 0 ? COLORS.alert : COLORS.forest800 }}>{m === null ? "—" : `${eurCell(m)}/h`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </Card>
      )}

      {tab === "reports" && (
        <ReportsTab
          lang={lang} tier={tier} contractor={c} periods={periods} closings={closings} clients={clients} today={TODAY} who={who} companyName={companyName} ctx={reportCtx}
          onCloseMonth={(p) => setWizardIso(p.iso)} onSave={onSaveClosing} onNotice={showNotice}
        />
      )}
      {tab === "docs" && <DocsTab lang={lang} contractor={c} periods={periods} closings={closings} />}

      {wizardPeriod && (
        <ClosingWizard
          key={wizardPeriod.iso + c.id}
          lang={lang} open onClose={(res) => { setWizardIso(null); if (res === "closed") showNotice(f.closedOk); else if (res === "closedLocal") showNotice(f.notSaved); }}
          contractor={c} period={wizardPeriod} existing={findClosing(closings, c.id, wizardPeriod.iso)} clients={clients} horasData={horasData} staff={staff}
          assignments={assignments} covers={covers} absences={absences} periods={periods} today={TODAY} openPeriodIso={openPeriodIso}
          who={who} onSave={onSaveClosing} onNavigate={onNavigate}
        />
      )}

      <Drawer
        open={previewOpen} onClose={() => setPreviewOpen(false)} width={620} closeLabel={f.close}
        title={`${f.reportTitle} · ${c.name}`}
        footer={<><div style={{ flex: 1 }} /><Button variant="secondary" onClick={() => setPreviewOpen(false)}>{f.close}</Button></>}
      >
        <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 14 }}>{f.reportPeriod(current.rangeLabel)}</div>
        {reportRows.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.reportEmpty}</div>
        ) : (
          <>
            <ReportDetail lang={lang} report={detailReport} />
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, overflow: "hidden", marginTop: 10 }}>
              <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, background: COLORS.headerTint }}>
                <span style={{ flex: 1 }}>{f.reportTotalVisits}</span><span>{detailReport.totals.visits}</span>
              </div>
              <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, borderTop: `1px solid ${COLORS.line}`, background: COLORS.headerTint }}>
                <span style={{ flex: 1 }}>{f.reportTotalHours}</span><span>{fmtHoursScreen(cur.hours)}</span>
              </div>
              <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, background: COLORS.headerTint }}>
                <span style={{ flex: 1 }}>{f.reportToInvoice}</span><span>{priced ? fmtEuro(cur.value || 0) : "—"}</span>
              </div>
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 12 }}>{f.reportNoteDetail}</div>
      </Drawer>
    </div>
  );
}

export { ContractorDetail };
