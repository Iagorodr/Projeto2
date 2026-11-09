import { useState } from "react";
import { Check, X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { TODAY } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { isoDateStr, fmtNoteDate, pendingAbsenceRequests, staffById, clientById } from "../../models/utils.js";
import { Card, Button, Toast } from "./ui/index.js";

// Pedidos de folga por decidir (Notas e lembretes da gerência). Os clientes
// ficam na agenda até aprovar; ao aprovar, passam a "sem cobertura" em Agendas.
// Aprovar/recusar tem "Desfazer" (volta a pendente) em vez de pop-up.
function AbsenceRequests({ lang, absences, setAbsences, staff, clients }) {
  const t = T[lang].absences;
  const c0 = T[lang].common;
  const [toast, setToast] = useState(null);
  const requests = pendingAbsenceRequests(absences, isoDateStr(TODAY));
  if (requests.length === 0 && !toast) return null;

  function decide(req, status) {
    const ids = new Set(req.ids);
    const now = new Date().toISOString();
    setAbsences((prev) => (prev || []).map((a) => (ids.has(a.id) ? { ...a, status, decidedAt: now } : a)));
    const name = (staffById(staff, req.staffId)?.name || "").split(" ")[0];
    setToast({
      message: status === "approved" ? t.approvedToast(name) : t.declinedToast(name),
      onUndo: () => setAbsences((prev) => (prev || []).map((a) => (ids.has(a.id) ? { ...a, status: "pending", decidedAt: undefined } : a))),
    });
  }

  return (
    <>
      {requests.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{t.reqTitle}</div>
          <div style={{ fontSize: 12, color: COLORS.ink3, margin: "2px 0 10px" }}>{t.reqHint}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((r) => {
              const person = staffById(staff, r.staffId);
              const first = fmtNoteDate(r.dates[0]);
              const last = fmtNoteDate(r.dates[r.dates.length - 1]);
              const kindLabel = r.kind === "vacation" ? t.kindVacation : r.kind === "client" ? t.kindClient : t.kindAbsence;
              const clientNames = r.clientIds.map((id) => clientById(clients, id)?.name).filter(Boolean);
              return (
                <Card key={r.id} style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: COLORS.ink }}>{person?.name || "—"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, background: COLORS.clayTint, color: COLORS.clayInk, borderRadius: RADIUS.chip, padding: "2px 10px" }}>{kindLabel}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.ink2 }}>
                    {t.reqDates(first, last, r.dates.length)} · {clientNames.length > 0 ? clientNames.join(", ") : t.reqAllClients}
                  </div>
                  {r.note && <div style={{ fontSize: 13, color: COLORS.ink2 }}>“{r.note}”</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="primary" icon={Check} onClick={() => decide(r, "approved")}>{t.approve}</Button>
                    <Button variant="secondary" icon={X} onClick={() => decide(r, "declined")}>{t.decline}</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} actionLabel={t.undo} onAction={() => { toast.onUndo(); setToast(null); }} onDismiss={() => setToast(null)} closeLabel={c0.close} />}
    </>
  );
}

export default AbsenceRequests;
