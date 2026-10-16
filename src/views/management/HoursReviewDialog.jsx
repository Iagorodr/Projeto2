import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { TODAY } from "../../models/data.js";
import {
  applyLeftovers, clientById, fmtEuro, fmtHoursScreen, fmtNoteDate, isoDateStr, joinVisit, listConflicts, planLeftovers, resolveConflict,
} from "../../models/utils.js";
import { Button, Pill } from "../shared/ui/index.js";

// "Revisões de horas" (gerência): duas listas, ambas decididas à mão.
//  1) CONFLITOS — um funcionário marcou "trabalhei sozinho" e outro marcou o
//     mesmo cliente no mesmo dia: a gerência escolhe quem fez (só um, dividiram
//     ou os dois fizeram tudo). Entretanto cada um fica com a sua parte dividida.
//  2) HORAS SOLTAS — a agenda esperava mais gente do que a que marcou; a
//     sobra só passa para quem marcou quando a gerência confirma (o colega
//     provavelmente não foi). Pode confirmar um a um ou vários de uma vez.
// `onChange(nextHorasData, toastMsg)` recebe o novo horasData.
export default function HoursReviewDialog({ open, onClose, onChange, horasData, clients, staff, period, ctx, t }) {
  const isMobile = useIsMobile();
  const todayIso = isoDateStr(TODAY);
  const conflicts = useMemo(() => (open ? listConflicts(horasData) : []), [open, horasData]);
  const leftovers = useMemo(() => (open ? planLeftovers(horasData, clients, period, ctx, todayIso) : []), [open, horasData, clients, period, ctx, todayIso]);
  const [selected, setSelected] = useState(() => new Set());
  // Mantém só os dias que ainda existem na lista (depois de aplicar alguns).
  useEffect(() => {
    setSelected((prev) => {
      const keys = new Set(leftovers.map((x) => x.key));
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [leftovers]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const nameOf = (sid) => { const s = staff.find((x) => String(x.id) === String(sid)); return s ? s.name : "—"; };
  const firstOf = (sid) => nameOf(sid).split(" ")[0];
  const clientName = (id) => { const c = clientById(clients, id); return c ? c.name : "—"; };
  const isPaid = (sid) => !!(horasData[sid] && horasData[sid].paid);

  const chosen = leftovers.filter((x) => selected.has(x.key));
  const gain = (x) => { const c = clientById(clients, x.clientId); return x.leftoverHours * (c ? c.valueHour || 0 : 0); };
  const chosenHours = chosen.reduce((s, x) => s + x.leftoverHours, 0);
  const chosenEuros = chosen.reduce((s, x) => s + gain(x), 0);

  function toggle(key) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  function decide(c, action, winnerId) {
    onChange(resolveConflict(horasData, clients, c.date, c.clientId, action, winnerId, ctx), t.reviewDoneConflict);
  }
  function join(x, o) {
    onChange(joinVisit(horasData, clients, o.staffId, o.date, x.clientId, x.date, ctx), t.reviewDoneJoin);
  }
  function applyChosen() {
    if (chosen.length === 0) return;
    onChange(applyLeftovers(horasData, clients, chosen, ctx), t.reviewDoneLeftovers(chosen.length));
    setSelected(new Set());
  }

  const empty = conflicts.length === 0 && leftovers.length === 0;
  const sectionTitle = { fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 4 };
  const hint = { fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.45, marginBottom: 10 };
  const card = { border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: "10px 12px" };

  return (
    <div
      role="dialog" aria-modal="true" aria-label={t.reviewTitle}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, width: isMobile ? "100%" : 600, maxHeight: "88vh", overflowY: "auto",
          borderRadius: isMobile ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{t.reviewTitle}</div>
          <button
            type="button" onClick={onClose} aria-label={t.reviewClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink3, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 16 }}>{t.reviewIntro}</div>

        {empty && (
          <div style={{ fontSize: 13.5, color: COLORS.ink, background: COLORS.lineSoft, borderRadius: RADIUS.control, padding: "12px 14px", marginBottom: 14 }}>
            {t.reviewNothing}
          </div>
        )}

        {conflicts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={sectionTitle}>{t.reviewConflictsTitle(conflicts.length)}</div>
            <div style={hint}>{t.reviewConflictHint}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {conflicts.map((c) => {
                const anyPaid = c.marks.some((m) => isPaid(m.staffId));
                return (
                  <div key={c.key} style={card} data-testid="review-conflict">
                    <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{fmtNoteDate(c.date)} · {clientName(c.clientId)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "6px 0 10px" }}>
                      {c.marks.map((m) => (
                        <div key={m.staffId} style={{ fontSize: 12.5, color: COLORS.ink2 }}>
                          <b style={{ color: COLORS.ink }}>{nameOf(m.staffId)}</b> {m.solo ? t.reviewSoloSays : t.reviewWentSays}
                        </div>
                      ))}
                    </div>
                    {anyPaid ? (
                      <Pill variant="pending">{t.reviewPaidNote}</Pill>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.marks.map((m) => (
                          <Button key={m.staffId} variant="secondary" onClick={() => decide(c, "only", m.staffId)}>{t.reviewOnlyBtn(firstOf(m.staffId))}</Button>
                        ))}
                        <Button variant="secondary" onClick={() => decide(c, "split")}>{t.reviewSplitBtn}</Button>
                        <Button variant="secondary" onClick={() => decide(c, "both")}>{t.reviewBothBtn}</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {leftovers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={sectionTitle}>{t.reviewLeftoversTitle(leftovers.length)}</div>
              <button
                type="button"
                onClick={() => setSelected(selected.size === leftovers.length ? new Set() : new Set(leftovers.map((x) => x.key)))}
                style={{ border: "none", background: "transparent", color: COLORS.vivo, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                {selected.size === leftovers.length ? t.reviewSelectNone : t.reviewSelectAll}
              </button>
            </div>
            <div style={hint}>{t.reviewLeftoverHint}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leftovers.map((x) => (
                <label key={x.key} style={{ ...card, display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} data-testid="review-leftover">
                  <input type="checkbox" checked={selected.has(x.key)} onChange={() => toggle(x.key)} style={{ marginTop: 3 }} aria-label={`${fmtNoteDate(x.date)} ${clientName(x.clientId)}`} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{fmtNoteDate(x.date)} · {clientName(x.clientId)}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: COLORS.ink2 }}>
                      {t.reviewMarked}: {x.markerIds.map(firstOf).join(", ")} · {t.reviewNotMarked}: {x.missingIds.map(firstOf).join(", ")}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }}>
                      {t.reviewLeftoverGain(fmtHoursScreen(x.leftoverHours), fmtEuro(gain(x)))}
                    </span>
                    {(x.otherDay || []).map((o) => (
                      <span key={`${o.staffId}-${o.date}`} style={{ display: "block", marginTop: 6, fontSize: 12.5, color: COLORS.amberInk, background: COLORS.amberBg, borderRadius: RADIUS.control, padding: "6px 10px" }}>
                        {t.reviewOtherDay(firstOf(o.staffId), fmtNoteDate(o.date), fmtHoursScreen(o.hours))}
                        <span style={{ display: "block", marginTop: 6 }}>
                          <Button variant="secondary" onClick={(ev) => { ev.preventDefault(); join(x, o); }}>{t.reviewJoinBtn(firstOf(o.staffId), fmtNoteDate(x.date))}</Button>
                        </span>
                      </span>
                    ))}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, margin: "12px 0" }}>
              {chosen.length === 0 ? t.reviewApplyNone : t.reviewTotal(chosen.length, fmtHoursScreen(chosenHours), fmtEuro(chosenEuros))}
            </div>
            <Button variant="primary" onClick={applyChosen} disabled={chosen.length === 0}>{t.reviewApply(chosen.length)}</Button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" onClick={onClose}>{t.reviewClose}</Button>
        </div>
      </div>
    </div>
  );
}
