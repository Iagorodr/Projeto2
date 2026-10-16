import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { clientById, fmtEuro, fmtHoursScreen, fmtNoteDate, planHoursRecalc } from "../../models/utils.js";
import { Button } from "../shared/ui/index.js";

// "Recalcular horas": acerta as horas JÁ LANÇADAS do período aberto com a
// duração ATUAL dos clientes. Mostra primeiro o que vai mudar, por cliente, e
// só aplica os clientes marcados. Funcionários já pagos ficam de fora.
// `onApply(nextHorasData, nLinhas)` recebe o novo horasData.
function signed(n, fmt) {
  const v = Math.abs(n) < 1e-9 ? 0 : n;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt(Math.abs(v))}`;
}

export default function RecalcHoursDialog({ open, onClose, onApply, horasData, clients, staff, period, t, ctx }) {
  const isMobile = useIsMobile();
  const paidIds = useMemo(() => Object.keys(horasData || {}).filter((sid) => horasData[sid] && horasData[sid].paid), [horasData]);
  const plan = useMemo(() => (open ? planHoursRecalc(horasData, clients, period, { skipStaffIds: paidIds, ctx }) : null), [open, horasData, clients, period, paidIds, ctx]);
  const skippedPaid = useMemo(() => {
    if (!open || paidIds.length === 0) return 0;
    const all = planHoursRecalc(horasData, clients, period, { ctx });
    return all.changes.filter((c) => paidIds.includes(String(c.staffId))).length;
  }, [open, horasData, clients, period, paidIds, ctx]);

  // Agrupa por cliente.
  const groups = useMemo(() => {
    if (!plan) return [];
    const map = new Map();
    plan.changes.forEach((c) => {
      const client = clientById(clients, c.clientId);
      if (!map.has(c.clientId)) map.set(c.clientId, { clientId: c.clientId, name: client ? client.name : "—", rate: client ? client.valueHour : 0, items: [] });
      map.get(c.clientId).items.push(c);
    });
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        deltaHours: g.items.reduce((s, c) => s + (c.newHours - c.oldHours), 0),
        deltaEuros: g.items.reduce((s, c) => s + (c.newHours - c.oldHours) * g.rate, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plan, clients]);

  // Guarda os clientes que o utilizador DESMARCOU (por defeito vêm todos marcados).
  // Antes guardava os marcados e voltava a marcar tudo sempre que a lista era
  // recalculada (qualquer atualização do ecrã) — por isso o que ele desmarcava
  // voltava a ficar marcado sozinho. Só volta ao "tudo marcado" ao abrir.
  const [unchecked, setUnchecked] = useState(() => new Set());
  useEffect(() => { if (open) setUnchecked(new Set()); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !plan) return null;

  const chosen = groups.filter((g) => !unchecked.has(g.clientId));
  const nLines = chosen.reduce((s, g) => s + g.items.length, 0);
  const dH = chosen.reduce((s, g) => s + g.deltaHours, 0);
  const dE = chosen.reduce((s, g) => s + g.deltaEuros, 0);
  const staffName = (sid) => { const s = staff.find((x) => String(x.id) === String(sid)); return s ? s.name : "—"; };

  function toggle(id) {
    setUnchecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function apply() {
    if (nLines === 0) return;
    const { next } = planHoursRecalc(horasData, clients, period, { skipStaffIds: paidIds, clientIds: chosen.map((g) => g.clientId), ctx });
    onApply(next, nLines);
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={t.recalcTitle}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, width: isMobile ? "100%" : 560, maxHeight: "88vh", overflowY: "auto",
          borderRadius: isMobile ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{t.recalcTitle}</div>
          <button
            type="button" onClick={onClose} aria-label={t.recalcClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink3, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 14 }}>{t.recalcIntro}</div>

        {groups.length === 0 ? (
          <div style={{ fontSize: 13.5, color: COLORS.ink, background: COLORS.lineSoft, borderRadius: RADIUS.control, padding: "12px 14px", marginBottom: 14 }}>
            {t.recalcNothing}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {groups.map((g) => (
              <div key={g.clientId} style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: "10px 12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={!unchecked.has(g.clientId)} onChange={() => toggle(g.clientId)} aria-label={g.name} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{g.name}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: COLORS.ink2 }}>
                      {t.recalcLines(g.items.length)} · {signed(g.deltaHours, fmtHoursScreen)} · {signed(g.deltaEuros, fmtEuro)}
                    </span>
                  </span>
                </label>
                <details style={{ marginTop: 6, marginLeft: 26 }}>
                  <summary style={{ fontSize: 12, color: COLORS.ink3, cursor: "pointer" }}>{t.recalcLines(g.items.length)}</summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                    {g.items.slice().sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
                      <div key={`${c.staffId}-${c.idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: COLORS.ink2 }}>
                        <span>{fmtNoteDate(c.date)} · {staffName(c.staffId)}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtHoursScreen(c.oldHours)} → {fmtHoursScreen(c.newHours)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}

        {skippedPaid > 0 && (
          <div style={{ fontSize: 12.5, color: COLORS.amberInk, background: COLORS.amberBg, borderRadius: RADIUS.control, padding: "8px 12px", marginBottom: 14 }}>
            {t.recalcSkippedPaid(skippedPaid)}
          </div>
        )}

        {groups.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>
            {nLines === 0 ? t.recalcNoneSelected : t.recalcTotal(nLines, signed(dH, fmtHoursScreen), signed(dE, fmtEuro))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onClose}>{t.recalcClose}</Button>
          {groups.length > 0 && <Button variant="primary" onClick={apply} disabled={nLines === 0}>{t.recalcApply}</Button>}
        </div>
      </div>
    </div>
  );
}
