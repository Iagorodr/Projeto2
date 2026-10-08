import { useState } from "react";
import { Trash2 } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY } from "../../models/data.js";
import { isoDateStr, isoDatesBetween, fmtNoteDate } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { Field } from "./Layout.jsx";
import { Drawer, Button, Toast } from "./ui/index.js";

// Aviso de falta do funcionário: escolhe um dia (ou um intervalo) e, se
// quiser, um motivo. Grava uma linha por dia em `absences`; a gerência vê no
// Dashboard e na Agenda e decide quem cobre. Só dias de hoje em diante.
function AbsenceSheet({ lang, open, onClose, staffId, absences, setAbsences }) {
  const t = T[lang].absences;
  const c0 = T[lang].common;
  const todayIso = isoDateStr(TODAY);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [note, setNote] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  const mine = (absences || [])
    .filter((a) => a.staffId === staffId && a.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));

  function handleSend() {
    const end = to < from ? from : to;
    const days = isoDatesBetween(from, end).filter((d) => d >= todayIso);
    if (days.length === 0) return;
    const now = new Date().toISOString();
    setAbsences((prev) => {
      const keep = (prev || []).filter((a) => !(a.staffId === staffId && days.includes(a.date)));
      const added = days.map((d) => ({
        id: `${staffId}-${d}-${Date.now()}`, staffId, date: d, note: note.trim(), createdAt: now, handled: false,
      }));
      return [...keep, ...added];
    });
    setNote("");
    setToastMsg(t.sentToast(days.length));
  }
  function handleRemove(id) { setAbsences((prev) => (prev || []).filter((a) => a.id !== id)); }

  return (
    <>
      <Drawer
        open={open} onClose={onClose} title={t.sheetTitle} closeLabel={c0.close}
        footer={<Button size="mobile" style={{ width: "100%" }} onClick={handleSend} disabled={!from}>{t.send}</Button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>{t.intro}</div>
          <Field label={t.from}>
            <input type="date" style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} value={from} min={todayIso}
              onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
          </Field>
          <Field label={t.to}>
            <input type="date" style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} value={to} min={from || todayIso}
              onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={t.note}>
            <textarea style={styles.textarea} rows={3} placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>{t.mine}</div>
            {mine.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.ink3 }}>{t.none}</div>
            ) : mine.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <span style={{ fontSize: 13, color: COLORS.ink }}>
                  {fmtNoteDate(a.date)}{a.note ? ` · ${a.note}` : ""}{a.handled ? ` · ${t.coveredTag}` : ""}
                </span>
                <button type="button" onClick={() => handleRemove(a.id)} aria-label={t.cancel}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, display: "flex", padding: 6 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} closeLabel={c0.close} />}
    </>
  );
}

export default AbsenceSheet;
