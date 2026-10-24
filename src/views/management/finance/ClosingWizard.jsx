// Assistente de fecho do mês de um contratante, em 4 passos:
//   1 Rever   — pendências só deste contratante + horas por cliente
//   2 Cruzar  — horas registadas × previstas pela agenda, só dos clientes dele
//   3 Anexar  — documentos do mês (propostas, comprovativos…), opcional, no cofre
//   4 Fechar  — relatório que o contratante recebe; com pendências a justificativa é obrigatória
// Ao fechar, os valores ficam guardados e deixam de ser recalculados (ver contractorClosings.js).
import { useMemo, useRef, useState } from "react";
import { Check, AlertTriangle, Paperclip } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { fmtHoursScreen, fmtEuro, isoDateStr } from "../../../models/utils.js";
import { FIN } from "../../../models/i18nFin.js";
import { T } from "../../../models/i18n.js";
import { closingPendencies, crossCheck, buildClosing } from "../../../models/contractorClosings.js";
import { uploadFile, removeFile, KINDS, uploadErrorKey } from "../../../models/fileStorage.js";
import { Drawer, Button, StoredFile } from "../../shared/ui/index.js";
import { styles } from "../../../styles/styles.js";
import { fmtDay, Dot } from "./financeUi.jsx";
import { changePct } from "../../../models/contractorStats.js";

const STEPS = 4;

function Stepper({ step, labels }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18 }} role="list">
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, on = n === step;
        return (
          <div key={l} role="listitem" aria-current={on ? "step" : undefined} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 4, borderRadius: 99, background: done || on ? COLORS.vivo : COLORS.line, marginBottom: 6 }} />
            <div style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? COLORS.ink : COLORS.ink3, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              {done ? <Check size={12} color={COLORS.vivo} /> : <span>{n}</span>} {l}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClosingWizard({
  lang, open, onClose, contractor: c, period, existing, clients, horasData, staff, assignments, covers, absences,
  periods, today, openPeriodIso, openPeriodStartIso, who, onSave, onNavigate,
}) {
  const f = FIN[lang];
  const tFiles = T[lang].files;
  const [step, setStep] = useState(1);
  const [docs, setDocs] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const pend = useMemo(
    () => closingPendencies({ contractor: c, period, clients, horasData, staff, assignments, covers, absences, today, openPeriodIso, openPeriodStartIso }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, period, clients, horasData, staff, assignments, covers, absences, openPeriodIso],
  );
  const cross = useMemo(
    () => crossCheck({ contractor: c, period, clients, horasData, staff, assignments, covers, absences, today }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, period, clients, horasData, staff, assignments, covers, absences],
  );

  const d = period.contractors.get(c.id) || { hours: 0, value: null, byClient: new Map() };
  const priced = d.value != null;
  const rows = [...d.byClient.entries()].map(([id, hours]) => ({ id, name: (clients.find((x) => x.id === id) || {}).name || "—", hours })).sort((a, b) => a.name.localeCompare(b.name));
  const idx = periods.findIndex((p) => p.iso === period.iso);
  const prev = idx > 0 ? periods[idx - 1].contractors.get(c.id) : null;
  const variation = prev ? changePct(d.hours, prev.hours) : null;
  const ended = isoDateStr(today) > period.iso;
  const pendTexts = pend.map((p) => f.pend[p.key](p.count));
  const needNote = pend.length > 0;
  const noteOk = !needNote || note.trim().length >= 3;

  async function addFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setError(""); setUploading(true);
    for (const file of files) {
      try {
        const ref = await uploadFile(file, { kind: KINDS.docsContractors, ownerId: c.id });
        setDocs((prev) => [...prev, ref]);
      } catch (e) {
        const k = uploadErrorKey(e);
        setError(k === "tooBig" ? f.sizeErr : k === "badType" ? f.typeErr : f.uploadErr);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function dropDoc(ref) {
    setDocs((prev) => prev.filter((x) => x !== ref));
    await removeFile(ref);
  }

  async function confirm() {
    if (!ended || !noteOk || busy) return;
    setBusy(true); setError("");
    const record = buildClosing({ contractor: c, period, existing, clients, pendingItems: pendTexts, note: note.trim(), docs: [...((existing && existing.docs) || []), ...docs], who });
    const res = await onSave(record);
    setBusy(false);
    if (!res || !res.ok) { setError(f.saveFail); return; }
    onClose(res.saved ? "closed" : "closedLocal");
  }

  const dueDate = fmtDay(new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() + 1), lang);
  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));
  const th = { fontSize: 12, fontWeight: 600, color: COLORS.ink3 };

  const table = (head, body) => <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, overflow: "hidden" }}>{head}{body}</div>;
  const line = (children, key, strong) => (
    <div key={key} style={{ display: "flex", gap: 8, padding: "9px 14px", fontSize: 13.5, borderTop: `1px solid ${COLORS.lineSoft}`, fontWeight: strong ? 700 : 400, background: strong ? COLORS.headerTint : "transparent" }}>{children}</div>
  );

  return (
    <Drawer
      open={open} onClose={() => onClose(null)} width={640} closeLabel={T[lang].common.close}
      title={f.wizTitle(c.name, period.rangeLabel)}
      pill={null}
      footer={
        <>
          {step > 1 ? <Button variant="secondary" onClick={prevStep} disabled={busy}>{f.prev}</Button> : <Button variant="secondary" onClick={() => onClose(null)}>{f.cancel}</Button>}
          <div style={{ flex: 1 }} />
          {step < STEPS
            ? <Button variant="primary" onClick={next}>{f.next}</Button>
            : <Button variant="primary" onClick={confirm} disabled={!ended || !noteOk || busy}>{busy ? f.closing : f.closeConfirm}</Button>}
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, color: COLORS.ink2 }}>
        <Dot color={c.color} size={11} /><strong style={{ color: COLORS.ink }}>{c.name}</strong> · {f.stepOf(step, STEPS)}
      </div>
      <Stepper step={step} labels={[f.step1, f.step2, f.step3, f.step4]} />

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{f.pendTitle}</div>
            {pend.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: COLORS.okInk, fontWeight: 600 }}><Check size={16} /> {f.allClear}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pend.map((p) => (
                  <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: RADIUS.control, fontSize: 13.5 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} /><span style={{ flex: 1 }}>{f.pend[p.key](p.count)}</span>
                  </div>
                ))}
                {onNavigate && <div><button type="button" onClick={() => { onClose(null); onNavigate("horas"); }} style={{ border: "none", background: "transparent", color: COLORS.vivo, fontWeight: 700, fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: "6px 0" }}>{f.openHoras} →</button></div>}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{f.chartHoursClient}</div>
            {rows.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.reportEmpty}</div> : table(
              <div style={{ display: "flex", padding: "9px 14px", background: COLORS.headerTint }}><span style={{ ...th, flex: 1 }}>{f.reportClient}</span><span style={th}>{f.reportHours}</span></div>,
              <>
                {rows.map((r) => line(<><span style={{ flex: 1, minWidth: 0 }}>{r.name}</span><span style={{ fontWeight: 600 }}>{fmtHoursScreen(r.hours)}</span></>, r.id))}
                {line(<><span style={{ flex: 1 }}>{f.reportTotalHours}</span><span>{fmtHoursScreen(d.hours)}</span></>, "t", true)}
              </>,
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.crossHint}</div>
          {variation != null && <div style={{ fontSize: 13.5 }}><strong>{fmtHoursScreen(d.hours)}</strong> · {f.vsPrevPeriod(variation)}</div>}
          {cross.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.reportEmpty}</div> : table(
            <div style={{ display: "flex", gap: 8, padding: "9px 14px", background: COLORS.headerTint }}>
              <span style={{ ...th, flex: 2 }}>{f.colClient}</span><span style={{ ...th, flex: 1, textAlign: "right" }}>{f.colRegistered}</span><span style={{ ...th, flex: 1, textAlign: "right" }}>{f.colExpected}</span><span style={{ ...th, flex: 1, textAlign: "right" }}>{f.colDiff}</span>
            </div>,
            <>
              {cross.map((r) => {
                const off = Math.abs(r.diff) > 0.5;
                return line(<>
                  <span style={{ flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ flex: 1, textAlign: "right" }}>{fmtHoursScreen(r.registered)}</span>
                  <span style={{ flex: 1, textAlign: "right", color: COLORS.ink2 }}>{fmtHoursScreen(r.expected)}</span>
                  <span style={{ flex: 1, textAlign: "right", fontWeight: 700, color: off ? COLORS.amberInk : COLORS.ink3 }}>{`${r.diff > 0 ? "+" : r.diff < 0 ? "−" : ""}${fmtHoursScreen(Math.abs(r.diff))}`.replace("+0h", "0h")}</span>
                </>, r.clientId);
              })}
            </>,
          )}
          {cross.length > 0 && cross.every((r) => Math.abs(r.diff) <= 0.5) && <div style={{ fontSize: 13, color: COLORS.okInk, fontWeight: 600 }}>{f.crossOk}</div>}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{f.attachTitle}</div>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.attachHint}</div>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(e) => addFiles(e.target.files)} />
          <div><Button variant="secondary" icon={Paperclip} onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>{uploading ? f.uploading : f.addFile}</Button></div>
          {error && <div role="alert" style={{ fontSize: 13, color: COLORS.dangerInk }}>{error}</div>}
          {docs.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink3 }}>{f.noDocs}</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((ref, i) => <StoredFile key={ref.path || i} file={ref} labels={tFiles} size={40} onRemove={() => dropDoc(ref)} removeLabel={f.removeDoc} />)}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{f.finalTitle}</div>
            <div style={{ fontSize: 12.5, color: COLORS.ink3, marginTop: 2 }}>{f.finalHint}</div>
          </div>
          {table(
            <div style={{ display: "flex", padding: "9px 14px", background: COLORS.headerTint }}><span style={{ ...th, flex: 1 }}>{f.reportClient}</span><span style={th}>{f.reportHours}</span></div>,
            <>
              {rows.map((r) => line(<><span style={{ flex: 1, minWidth: 0 }}>{r.name}</span><span style={{ fontWeight: 600 }}>{fmtHoursScreen(r.hours)}</span></>, r.id))}
              {line(<><span style={{ flex: 1 }}>{f.reportTotalHours}</span><span>{fmtHoursScreen(d.hours)}</span></>, "th", true)}
              {line(<><span style={{ flex: 1 }}>{f.reportToInvoice}</span><span>{priced ? fmtEuro(d.value) : "—"}</span></>, "tv", true)}
            </>,
          )}
          {!ended && <div role="alert" style={{ padding: "9px 12px", background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: RADIUS.control, fontSize: 13.5 }}>{f.notEnded(dueDate)}</div>}
          {needNote && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.justTitle}</div>
              <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 8 }}>{f.justHint}</div>
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13, color: COLORS.amberInk }}>{pendTexts.map((t) => <li key={t}>{t}</li>)}</ul>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.justPlaceholder} aria-label={f.justTitle} aria-required="true"
                style={{ ...styles.input, minHeight: 84, resize: "vertical", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
              />
              {note.trim().length < 3 && <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 4 }}>{f.justRequired}</div>}
            </div>
          )}
          {docs.length > 0 && <div style={{ fontSize: 12.5, color: COLORS.ink2 }}><Paperclip size={12} /> {docs.length}</div>}
          {error && <div role="alert" style={{ fontSize: 13, color: COLORS.dangerInk }}>{error}</div>}
        </div>
      )}
    </Drawer>
  );
}

export { ClosingWizard };
