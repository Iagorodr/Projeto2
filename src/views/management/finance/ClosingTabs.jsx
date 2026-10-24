// Contratantes · abas "Relatórios de horas" e "Documentos" de um contratante.
//  - Relatórios: um mês por linha com o estado (Em curso / Por fechar / Fechado / Reaberto),
//    "Fechar mês" (assistente), "Ver relatório" (+ PDF), "Reabrir" (motivo obrigatório) e, depois
//    de fechado, as marcas Faturado / Recebido com data.
//  - Documentos: tudo o que foi anexado nos fechos, mês a mês, e o histórico (quem/quando/porquê).
import { useState } from "react";
import { FileDown, Eye, RotateCcw, Lock } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { fmtHoursScreen, fmtHoursNum, fmtEuro, isoDateStr, clientById } from "../../../models/utils.js";
import { FIN } from "../../../models/i18nFin.js";
import { T } from "../../../models/i18n.js";
import { findClosing, isClosed, reopenClosing, markStage, paymentDueFromInvoice } from "../../../models/contractorClosings.js";
import { exportGenericTablePdf } from "../../../models/pdfExport.js";
import { Card, Pill, Button, Drawer, StoredFile } from "../../shared/ui/index.js";
import { styles } from "../../../styles/styles.js";
import { fmtDay } from "./financeUi.jsx";
import { buildContractorReport } from "../../../models/contractorReport.js";
import { ReportDetail, reportPdfRows } from "./ReportDetail.jsx";

const th = { fontSize: 12, fontWeight: 600, color: COLORS.ink3 };

// Estado de um mês deste contratante.
export function monthState(period, row, today, hasHours) {
  if (row && row.status === "closed") return "closed";
  if (row && row.status === "reopened") return "reopened";
  if (!hasHours) return "noHours";
  return isoDateStr(today) > period.iso ? "toClose" : "inProgress";
}
const STATE_PILL = { closed: "paid", reopened: "reopened", toClose: "pending", inProgress: "neutral", noHours: "neutral" };
const STATE_KEY = { closed: "stClosed", reopened: "stReopened", toClose: "stToClose", inProgress: "stInProgress", noHours: "stNoHours" };

function stamp(at, lang) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "pt" ? "pt-PT" : lang, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function History({ lang, row }) {
  const f = FIN[lang];
  const items = [...(row.history || [])].reverse();
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((h, i) => (
        <div key={i} style={{ fontSize: 13, color: COLORS.ink2, borderLeft: `3px solid ${COLORS.line}`, paddingLeft: 10 }}>
          <div><strong style={{ color: COLORS.ink }}>{f.ev[h.event] || h.event}</strong>{h.event === "invoiced" || h.event === "received" ? ` · ${h.note || ""}` : ""}</div>
          <div style={{ fontSize: 12, color: COLORS.ink3 }}>{stamp(h.at, lang)}{h.by ? ` · ${f.by} ${h.by}` : ""}</div>
          {h.note && h.event === "reopened" && <div style={{ marginTop: 2 }}><span style={{ color: COLORS.ink3 }}>{f.reasonLabel}:</span> {h.note}</div>}
          {h.note && h.event === "closed" && <div style={{ marginTop: 2 }}><span style={{ color: COLORS.ink3 }}>{f.pendNoteLabel}:</span> {h.note}</div>}
        </div>
      ))}
    </div>
  );
}

// Mostra o relatório de um mês (valores congelados se fechado, na hora se não) + PDF + estados.
function ReportDrawer({ lang, open, onClose, contractor: c, period, row, entry, clients, who, onSave, companyName, ctx }) {
  const f = FIN[lang];
  const [invDate, setInvDate] = useState(isoDateStr(new Date()));
  const [recDate, setRecDate] = useState(isoDateStr(new Date()));
  const [busy, setBusy] = useState(false);
  if (!period) return null;
  const closed = isClosed(row);
  const rows = closed
    ? (row.byClient || []).map((r) => ({ id: r.clientId, name: r.name, hours: r.hours }))
    : [...((entry && entry.byClient) || new Map()).entries()].map(([id, hours]) => ({ id, name: (clientById(clients, id) || {}).name || "—", hours }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const detail = ctx ? buildContractorReport({ contractor: c, clients, ...ctx, period }) : null;
  const hours = closed ? row.hours : (entry ? entry.hours : 0);
  const value = closed ? row.receivable : (entry ? entry.value : null);

  async function stage(which, iso) {
    setBusy(true);
    await onSave(markStage(row, which, iso, who));
    setBusy(false);
  }
  function pdf() {
    exportGenericTablePdf({
      companyName, reportTitle: `${f.reportTitle} · ${c.name}`, subtitle: period.rangeLabel,
      columns: detail ? [f.reportClient, f.reportVisitsCol, f.reportDetailCol, f.reportHours] : [f.reportClient, f.reportHours],
      rows: detail ? reportPdfRows(detail, lang) : rows.map((r) => [r.name, `${fmtHoursNum(r.hours)}h`]),
      columnStyles: detail ? { 0: { cellWidth: 90 }, 1: { cellWidth: 70 }, 3: { halign: "right", cellWidth: 50 } } : { 1: { halign: "right" } },
      totals: [...(detail ? [{ label: f.reportTotalVisits, value: String(detail.totals.visits) }] : []), { label: f.reportTotalHours, value: `${fmtHoursNum(hours)}h` }, { label: f.reportToInvoice, value: value != null ? fmtEuro(value) : "—" }],
      pdfT: T[lang].pdf, fileName: f.pdfFile(c.name, period.iso),
    });
  }
  const due = closed && row.invoicedOn ? paymentDueFromInvoice(c, row.invoicedOn) : null;
  const dateIn = { ...styles.input, width: "auto", display: "inline-block" };

  return (
    <Drawer
      open={open} onClose={onClose} width={620} closeLabel={f.close} title={`${f.reportTitle} · ${c.name}`}
      pill={closed ? <Pill variant="paid">{f.stClosed}</Pill> : null}
      footer={<><Button variant="secondary" icon={FileDown} onClick={pdf} disabled={rows.length === 0}>{f.downloadPdf}</Button><div style={{ flex: 1 }} /><Button variant="secondary" onClick={onClose}>{f.close}</Button></>}
    >
      <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 14 }}>{f.reportPeriod(period.rangeLabel)}</div>
      {rows.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.reportEmpty}</div> : (
        <>
          {detail ? <ReportDetail lang={lang} report={detail} /> : (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, overflow: "hidden" }}>
              {rows.map((r) => (
                <div key={r.id} style={{ display: "flex", padding: "9px 14px", fontSize: 13.5, borderTop: `1px solid ${COLORS.lineSoft}` }}><span style={{ flex: 1, minWidth: 0 }}>{r.name}</span><span style={{ fontWeight: 600 }}>{fmtHoursScreen(r.hours)}</span></div>
              ))}
            </div>
          )}
          <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, overflow: "hidden", marginTop: 10 }}>
            {detail && <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, background: COLORS.headerTint }}><span style={{ flex: 1 }}>{f.reportTotalVisits}</span><span>{detail.totals.visits}</span></div>}
            <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, borderTop: detail ? `1px solid ${COLORS.line}` : "none", background: COLORS.headerTint }}><span style={{ flex: 1 }}>{f.reportTotalHours}</span><span>{fmtHoursScreen(hours)}</span></div>
            <div style={{ display: "flex", padding: "11px 14px", fontSize: 14, fontWeight: 700, background: COLORS.headerTint }}><span style={{ flex: 1 }}>{f.reportToInvoice}</span><span>{value != null ? fmtEuro(value) : "—"}</span></div>
          </div>
        </>
      )}
      <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 12 }}>{detail ? f.reportNoteDetail : f.reportNote}</div>

      {closed && (
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: COLORS.ink3, display: "flex", alignItems: "center", gap: 6 }}><Lock size={13} /> {f.frozenNote}</div>
          {row.pending && (
            <div style={{ padding: "10px 12px", background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: RADIUS.control, fontSize: 13 }}>
              <strong>{f.pendNoteLabel}:</strong> {row.pending.note}
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{(row.pending.items || []).map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{f.invoiced}</strong>
              {row.invoicedOn ? (
                <>
                  <Pill variant="paid">{row.invoicedOn}</Pill>
                  {due && <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{f.payment} {fmtDay(due, lang)}</span>}
                  <Button variant="secondary" onClick={() => stage("invoiced", null)} disabled={busy}>{f.undo}</Button>
                </>
              ) : (
                <>
                  <input type="date" aria-label={f.dateLabel} value={invDate} onChange={(e) => setInvDate(e.target.value)} style={dateIn} />
                  <Button variant="primary" onClick={() => stage("invoiced", invDate)} disabled={busy || !invDate}>{f.markInvoiced}</Button>
                </>
              )}
            </div>
          </div>
          {row.invoicedOn && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{f.received}</strong>
              {row.receivedOn ? (
                <>
                  <Pill variant="paid">{row.receivedOn}</Pill>
                  <Button variant="secondary" onClick={() => stage("received", null)} disabled={busy}>{f.undo}</Button>
                </>
              ) : (
                <>
                  <input type="date" aria-label={f.dateLabel} value={recDate} onChange={(e) => setRecDate(e.target.value)} style={dateIn} />
                  <Button variant="primary" onClick={() => stage("received", recDate)} disabled={busy || !recDate}>{f.markReceived}</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {row && (row.history || []).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{f.histTitle}</div>
          <History lang={lang} row={row} />
        </div>
      )}
    </Drawer>
  );
}

function ReopenDrawer({ lang, open, onClose, onConfirm }) {
  const f = FIN[lang];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= 3;
  async function go() {
    if (!ok || busy) return;
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
    setReason("");
  }
  return (
    <Drawer
      open={open} onClose={() => { setReason(""); onClose(); }} width={480} closeLabel={f.close} title={f.reopenTitle}
      footer={<><Button variant="secondary" onClick={() => { setReason(""); onClose(); }}>{f.cancel}</Button><div style={{ flex: 1 }} /><Button variant="primary" onClick={go} disabled={!ok || busy}>{f.reopenConfirm}</Button></>}
    >
      <div style={{ fontSize: 13.5, color: COLORS.ink2, marginBottom: 14 }}>{f.reopenBody}</div>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }} htmlFor="reopen-reason">{f.reopenReason}</label>
      <textarea id="reopen-reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-required="true" style={{ ...styles.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} />
      {!ok && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 4 }}>{f.reopenRequired}</div>}
    </Drawer>
  );
}

function ReportsTab({ lang, tier, contractor: c, periods, closings, clients, today, who, companyName, onCloseMonth, onSave, onNotice, ctx }) {
  const f = FIN[lang];
  const isPhone = tier === "mobile";
  const [viewIso, setViewIso] = useState(null);
  const [reopenIso, setReopenIso] = useState(null);

  const list = [...periods].reverse().map((p) => {
    const entry = p.contractors.get(c.id) || null;
    const row = findClosing(closings, c.id, p.iso);
    const hasHours = !!(entry && entry.hours > 0);
    return { p, entry, row, hasHours, state: monthState(p, row, today, hasHours) };
  }).filter((r) => r.hasHours || r.row);

  const viewing = viewIso ? list.find((r) => r.p.iso === viewIso) : null;
  const reopening = reopenIso ? list.find((r) => r.p.iso === reopenIso) : null;

  async function doReopen(reason) {
    const res = await onSave(reopenClosing(reopening.row, reason, who));
    if (res && res.ok) { onNotice(res.saved ? f.reopenedOk : f.notSaved); setReopenIso(null); } else onNotice(f.saveFail, true);
  }

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.monthsTitle}</div>
      {list.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.reportEmpty}</div> : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {!isPhone && (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.9fr 1.1fr 2fr", gap: 10, padding: "6px 4px" }}>
              <span style={th}>{f.colPeriod}</span><span style={th}>{f.colHours}</span><span style={th}>{f.colToInvoice}</span><span style={th}>{f.colState}</span><span />
            </div>
          )}
          {list.map(({ p, entry, row, state }) => {
            const closed = isClosed(row);
            const value = closed ? row.receivable : entry ? entry.value : null;
            const hours = closed ? row.hours : entry ? entry.hours : 0;
            const actions = (
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: isPhone ? "flex-start" : "flex-end" }}>
                {(state === "toClose" || state === "reopened") && <Button variant="primary" onClick={() => onCloseMonth(p)}>{f.closeMonth}</Button>}
                {(closed || state === "reopened" || state === "toClose") && <Button variant="secondary" icon={Eye} onClick={() => setViewIso(p.iso)}>{f.viewReport}</Button>}
                {closed && <Button variant="secondary" icon={RotateCcw} onClick={() => setReopenIso(p.iso)}>{f.reopen}</Button>}
              </span>
            );
            const pills = (
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Pill variant={STATE_PILL[state]}>{f[STATE_KEY[state]]}</Pill>
                {closed && row.invoicedOn && <Pill variant="paid">{row.receivedOn ? f.received : f.invoiced}</Pill>}
              </span>
            );
            return isPhone ? (
              <div key={p.iso} style={{ borderTop: `1px solid ${COLORS.lineSoft}`, padding: "12px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ flex: 1 }}>{p.rangeLabel}</strong>{pills}</div>
                <div style={{ fontSize: 13, color: COLORS.ink2 }}>{fmtHoursScreen(hours)} · {value != null ? fmtEuro(value).replace(/,00$/, "") : "—"}</div>
                {actions}
              </div>
            ) : (
              <div key={p.iso} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.9fr 1.1fr 2fr", gap: 10, alignItems: "center", padding: "12px 4px", borderTop: `1px solid ${COLORS.lineSoft}`, fontSize: 13.5 }}>
                <span style={{ fontWeight: 600 }}>{p.rangeLabel}</span>
                <span>{fmtHoursScreen(hours)}</span>
                <span style={{ fontWeight: 700 }}>{value != null ? fmtEuro(value).replace(/,00$/, "") : "—"}</span>
                {pills}
                {actions}
              </div>
            );
          })}
        </div>
      )}

      <ReportDrawer
        lang={lang} open={!!viewing} onClose={() => setViewIso(null)} contractor={c} period={viewing && viewing.p}
        row={viewing && viewing.row} entry={viewing && viewing.entry} clients={clients} who={who} onSave={onSave} companyName={companyName} ctx={ctx}
      />
      <ReopenDrawer lang={lang} open={!!reopening} onClose={() => setReopenIso(null)} onConfirm={doReopen} />
    </Card>
  );
}

function DocsTab({ lang, contractor: c, periods, closings }) {
  const f = FIN[lang];
  const tFiles = T[lang].files;
  const mine = (closings || []).filter((r) => String(r.contractorId) === String(c.id)).sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1));
  const label = (r) => (periods.find((p) => p.iso === r.periodEnd) || {}).rangeLabel || r.periodLabel || r.periodEnd;
  const withDocs = mine.filter((r) => (r.docs || []).length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.docsTitle}</div>
        {withDocs.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.docsEmpty}</div> : withDocs.map((r) => (
          <div key={r.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 6 }}>{f.docsFromMonth(label(r))}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.docs.map((d, i) => <StoredFile key={d.path || i} file={d} labels={tFiles} size={40} />)}
            </div>
          </div>
        ))}
      </Card>
      {mine.filter((r) => (r.history || []).length > 0).length > 0 && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{f.histTitle}</div>
          {mine.map((r) => (r.history || []).length > 0 && (
            <div key={r.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 6 }}>{label(r)}</div>
              <History lang={lang} row={r} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export { ReportsTab, DocsTab };
