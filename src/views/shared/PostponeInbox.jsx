import { Check, X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { POSTPONE_T } from "../../models/i18nPostpone.js";
import { postponeInbox, staffById, clientById } from "../../models/utils.js";
import { Card, Button } from "./ui/index.js";

// Gerência (Notas): adiamentos de clientes feitos pela equipa.
// - aceites na hora: só aviso ("Visto");
// - 2.ª vez no mesmo período: precisam de Aprovar/Recusar (até lá o cliente fica na agenda).
function PostponeInbox({ lang, absences, setAbsences, staff, clients, onToast }) {
  const t = POSTPONE_T[lang] || POSTPONE_T.pt;
  const items = postponeInbox(absences);
  if (items.length === 0) return null;
  function patch(id, fields) { setAbsences((prev) => (prev || []).map((a) => (a.id === id ? { ...a, ...fields } : a))); }
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{t.inboxTitle}</div>
      <div style={{ fontSize: 12, color: COLORS.ink3, margin: "2px 0 10px" }}>{t.inboxHint}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => {
          const who = (staffById(staff, it.byStaffId)?.name || "").split(" ")[0] || "—";
          const cname = clientById(clients, it.clientId)?.name || "—";
          return (
            <Card key={it.id} style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13.5, color: COLORS.ink }}>{it.waiting ? t.pendingLine(who, cname, dm(it.from)) : t.autoLine(who, cname, dm(it.from))}</div>
              {it.cycleShift && <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.cycleNote}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                {it.waiting ? (
                  <>
                    <Button variant="primary" icon={Check} onClick={() => { patch(it.id, { status: "approved", seen: true, decidedAt: new Date().toISOString() }); onToast?.(t.approvedToast); }}>{t.approve}</Button>
                    <Button variant="secondary" icon={X} onClick={() => { patch(it.id, { status: "declined", seen: true, decidedAt: new Date().toISOString() }); onToast?.(t.declinedToast); }}>{t.decline}</Button>
                  </>
                ) : (
                  <Button variant="secondary" icon={Check} onClick={() => patch(it.id, { seen: true })}>{t.seen}</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default PostponeInbox;
