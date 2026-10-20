import { useEffect, useMemo, useState } from "react";
import { X, ArrowRight, CalendarClock } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { TODAY } from "../../models/data.js";
import { DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import {
  addDays, isoDateStr, clientById, isStaffActive, fmtNoteDate, coverOverlaps,
} from "../../models/utils.js";
import { Button } from "../shared/ui/index.js";

// Cobertura de férias (ver utils.js, `agendaClientIdsOn`): troca, por um
// período, QUEM faz um cliente. A agenda semanal não é tocada, por isso a
// volta ao dono é automática. O substituto faz nos MESMOS dias da semana.
//
// Aqui vivem três peças: `CoverDialog` (criar), `CoverEditDialog` (mudar as
// datas de uma cobertura existente) e `CoversPanel` (lista das coberturas em
// curso ou agendadas, mostrada na página Agendas).

const byId = (list, id) => (list || []).find((s) => String(s.id) === String(id));
function newId(clientId) { return `cv-${Date.now().toString(36)}-${clientId}-${Math.random().toString(36).slice(2, 6)}`; }

// Agrupa as coberturas que partilham dono, substituto e datas (foram criadas
// juntas): uma linha no painel, vários clientes.
function groupCovers(covers) {
  const map = new Map();
  (covers || []).forEach((cv) => {
    const key = [cv.fromStaffId, cv.toStaffId, cv.from, cv.to].join("|");
    if (!map.has(key)) map.set(key, { key, fromStaffId: cv.fromStaffId, toStaffId: cv.toStaffId, from: cv.from, to: cv.to, items: [] });
    map.get(key).items.push(cv);
  });
  return [...map.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

function Overlay({ onClose, label, children, width = 560 }) {
  const isMobile = useIsMobile();
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      role="dialog" aria-modal="true" aria-label={label} onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, width: isMobile ? "100%" : width, maxHeight: "90vh", overflowY: "auto",
          borderRadius: isMobile ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ title, onClose, closeLabel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{title}</div>
      <button
        type="button" onClick={onClose} aria-label={closeLabel}
        style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink3, flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink, marginBottom: 5 }}>{children}</div>;
}

function ErrorLine({ children }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ fontSize: 12.5, color: COLORS.alert, background: "#FFF7F3", border: `1px solid ${COLORS.alert}`, borderRadius: RADIUS.control, padding: "8px 12px", marginBottom: 12 }}>
      {children}
    </div>
  );
}

// Dias da semana em que `staffId` faz `clientId` na agenda semanal ("Seg, Qua").
function daysOfClient(assignments, staffId, clientId, labels) {
  const out = [];
  for (let d = 1; d <= 7; d += 1) {
    if (((assignments || {})[`${staffId}-${d}`] || []).includes(clientId)) out.push(labels[d]);
  }
  return out;
}

function CoverDialog({ open, onClose, t, lang, staff, clients, assignments, covers, setCovers, onDone }) {
  const todayIso = isoDateStr(TODAY);
  const labels = DAY_LABELS_1_7_BY_LANG[lang];
  const [ownerId, setOwnerId] = useState("");
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(isoDateStr(addDays(TODAY, 13)));
  const [choice, setChoice] = useState({});
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOwnerId(""); setFrom(todayIso); setTo(isoDateStr(addDays(TODAY, 13))); setChoice({}); setBulk(""); setError("");
  }, [open, todayIso]);

  const activeStaff = useMemo(() => (staff || []).filter((s) => isStaffActive(s, TODAY)), [staff]);
  const ownerClients = useMemo(() => {
    if (!ownerId) return [];
    const ids = new Set();
    Object.entries(assignments || {}).forEach(([key, list]) => {
      if (!/^\d+-\d+$/.test(key) || !key.startsWith(`${ownerId}-`)) return;
      (list || []).forEach((id) => ids.add(id));
    });
    return [...ids].map((id) => clientById(clients, id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }, [ownerId, assignments, clients]);
  const substitutes = activeStaff.filter((s) => String(s.id) !== String(ownerId));

  if (!open) return null;

  function pickOwner(v) { setOwnerId(v); setChoice({}); setBulk(""); setError(""); }
  function pickBulk(v) {
    setBulk(v);
    const next = {};
    if (v) ownerClients.forEach((c) => { next[c.id] = v; });
    setChoice(next);
    setError("");
  }
  function setOne(clientId, v) { setBulk(""); setChoice((prev) => ({ ...prev, [clientId]: v })); setError(""); }

  function save() {
    if (!ownerId) return;
    if (!from || !to || to < from) { setError(t.errRange); return; }
    const chosen = ownerClients.filter((c) => choice[c.id]);
    if (chosen.length === 0) { setError(t.errNone); return; }
    const clash = chosen.filter((c) => coverOverlaps(covers, c.id, from, to).length > 0);
    if (clash.length > 0) { setError(t.errOverlap(clash.map((c) => c.name).join(", "))); return; }
    const owner = byId(staff, ownerId);
    const now = new Date().toISOString();
    const created = chosen.map((c) => {
      const sub = byId(staff, choice[c.id]);
      return { id: newId(c.id), clientId: c.id, fromStaffId: owner.id, toStaffId: sub.id, from, to, createdAt: now };
    });
    setCovers((prev) => [...(prev || []), ...created]);
    onDone?.(t.created(created.length, fmtNoteDate(to)));
    onClose();
  }

  const selectStyle = { ...styles.input, width: "100%", boxSizing: "border-box" };
  const nChosen = ownerClients.filter((c) => choice[c.id]).length;

  return (
    <Overlay onClose={onClose} label={t.title}>
      <DialogHeader title={t.title} onClose={onClose} closeLabel={t.cancel} />
      <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 14 }}>{t.intro}</div>

      <div style={{ marginBottom: 12 }}>
        <FieldLabel>{t.whoLeaves}</FieldLabel>
        <select aria-label={t.whoLeaves} style={selectStyle} value={ownerId} onChange={(e) => pickOwner(e.target.value)}>
          <option value="">{t.choosePerson}</option>
          {activeStaff.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px" }}>
          <FieldLabel>{t.from}</FieldLabel>
          <input type="date" aria-label={t.from} style={selectStyle} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); setError(""); }} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <FieldLabel>{t.to}</FieldLabel>
          <input type="date" aria-label={t.to} style={selectStyle} value={to} min={from} onChange={(e) => { setTo(e.target.value); setError(""); }} />
        </div>
      </div>

      {!ownerId ? (
        <div style={{ fontSize: 13, color: COLORS.ink3, marginBottom: 14 }}>{t.pickStaffFirst}</div>
      ) : ownerClients.length === 0 ? (
        <div style={{ fontSize: 13.5, color: COLORS.ink, background: COLORS.lineSoft, borderRadius: RADIUS.control, padding: "12px 14px", marginBottom: 14 }}>{t.noClients}</div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>{t.clientsTitle((byId(staff, ownerId) || { name: "" }).name.split(" ")[0])}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: COLORS.ink2 }}>
              {t.everyoneTo}
              <select aria-label={t.everyoneTo} style={{ ...styles.input, width: "auto", minWidth: 130 }} value={bulk} onChange={(e) => pickBulk(e.target.value)}>
                <option value="">{t.perClient}</option>
                {substitutes.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ownerClients.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: "8px 12px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.ink, overflowWrap: "anywhere" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.ink3 }}>{daysOfClient(assignments, ownerId, c.id, labels).join(", ")}</div>
                </div>
                <select aria-label={`${t.coveredBy}: ${c.name}`} style={{ ...styles.input, width: 170 }} value={choice[c.id] || ""} onChange={(e) => setOne(c.id, e.target.value)}>
                  <option value="">{t.nobody}</option>
                  {substitutes.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <ErrorLine>{error}</ErrorLine>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
        <Button variant="primary" onClick={save} disabled={!ownerId || nChosen === 0} disabledReason={!ownerId ? t.errNoOwner : nChosen === 0 ? t.errNone : undefined} disabledReasonBelow>{t.save}</Button>
      </div>
    </Overlay>
  );
}

// Mudar as datas de uma cobertura (do grupo todo).
function CoverEditDialog({ group, onClose, t, covers, setCovers, onDone }) {
  const [from, setFrom] = useState(group ? group.from : "");
  const [to, setTo] = useState(group ? group.to : "");
  const [error, setError] = useState("");
  useEffect(() => { if (group) { setFrom(group.from); setTo(group.to); setError(""); } }, [group]);
  if (!group) return null;

  function save() {
    if (!from || !to || to < from) { setError(t.errRange); return; }
    const own = new Set(group.items.map((cv) => cv.id));
    const clash = group.items.filter((cv) => coverOverlaps((covers || []).filter((x) => !own.has(x.id)), cv.clientId, from, to).length > 0);
    if (clash.length > 0) { setError(t.errOverlap("…")); return; }
    setCovers((prev) => (prev || []).map((cv) => (own.has(cv.id) ? { ...cv, from, to } : cv)));
    onDone?.(t.datesSaved);
    onClose();
  }
  const inputStyle = { ...styles.input, width: "100%", boxSizing: "border-box" };
  return (
    <Overlay onClose={onClose} label={t.editTitle} width={440}>
      <DialogHeader title={t.editTitle} onClose={onClose} closeLabel={t.cancel} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 150px" }}>
          <FieldLabel>{t.from}</FieldLabel>
          <input type="date" aria-label={t.from} style={inputStyle} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); setError(""); }} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <FieldLabel>{t.to}</FieldLabel>
          <input type="date" aria-label={t.to} style={inputStyle} value={to} min={from} onChange={(e) => { setTo(e.target.value); setError(""); }} />
        </div>
      </div>
      <ErrorLine>{error}</ErrorLine>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
        <Button variant="primary" onClick={save}>{t.saveDates}</Button>
      </div>
    </Overlay>
  );
}

// Lista das coberturas em curso ou agendadas (as já terminadas ficam de fora).
function CoversPanel({ t, covers, staff, clients, onEdit, onRemove }) {
  const todayIso = isoDateStr(TODAY);
  const groups = groupCovers((covers || []).filter((cv) => cv.to >= todayIso));
  if (groups.length === 0) return null;
  const first = (id) => (byId(staff, id) || { name: "—" }).name.split(" ")[0];
  return (
    <div style={{ border: `1px solid ${COLORS.vivoLight}`, background: COLORS.mintBg, borderRadius: RADIUS.card, padding: "10px 14px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>{t.panelTitle}</div>
      <div style={{ fontSize: 12, color: COLORS.ink2, marginBottom: 6 }}>{t.panelHint}</div>
      {groups.map((g) => {
        const live = g.from <= todayIso && todayIso <= g.to;
        return (
          <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 12.5, color: COLORS.ink }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              {first(g.fromStaffId)} <ArrowRight size={13} /> {first(g.toStaffId)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.ink2 }}>
              <CalendarClock size={13} /> {fmtNoteDate(g.from)} – {fmtNoteDate(g.to)} · {live ? t.statusNow : t.statusSoon}
            </span>
            <span style={{ flex: "1 1 220px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {g.items.map((cv) => {
                const c = clientById(clients, cv.clientId);
                return (
                  <span key={cv.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.chip, padding: "2px 4px 2px 8px" }}>
                    {c ? c.name : "—"}
                    <button
                      type="button" aria-label={`${t.removeOne}: ${c ? c.name : ""}`} title={t.removeOne}
                      onClick={() => onRemove([cv.id], g)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, display: "flex", padding: 2 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => onEdit(g)}
                style={{ border: `2px solid ${COLORS.vivo}`, background: COLORS.card, borderRadius: RADIUS.chip, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "4px 12px", color: COLORS.vivo }}>
                {t.editDates}
              </button>
              <button type="button" onClick={() => onRemove(g.items.map((cv) => cv.id), g)}
                style={{ border: `1px solid ${COLORS.line}`, background: COLORS.card, borderRadius: RADIUS.chip, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "4px 12px", color: COLORS.ink2 }}>
                {t.remove}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { CoverDialog, CoverEditDialog, CoversPanel, groupCovers };
