import { useEffect, useMemo, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { TODAY } from "../../models/data.js";
import { DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import {
  acceptExtra, ackMissing, applyHoursChanges, applySuggestion, assignPendingEntry, clientById, confirmHoursOk, fmtEuro, fmtHoursScreen, hoursImpact, isoDateStr,
  keepSeparate, reconcileVisits, resolveConflict, voidExtra, weekLabelPT,
} from "../../models/utils.js";
import { Button, Pill } from "../shared/ui/index.js";

// "Revisões de horas" (gerência): UMA lista, por cliente, do que não bate certo
// entre as visitas que a agenda previa e as que a equipa registou (ver
// `reconcileVisits` em utils.js). Cada ponto mostra as provas (quem marcou, em
// que dia, quantas horas, o que a agenda previa), o efeito nas horas e uma
// sugestão. Nada muda sem a gerência aplicar.
// `onChange(nextHorasData, toastMsg)` recebe o novo horasData.
const SUGGESTED = new Set(["join", "extra", "missing", "leftover"]); // têm caixa de seleção
const PRESELECT = new Set(["join"]); // vêm marcados à partida (provas claras); o resto marca-se à mão
const TAB_ORDER = ["hours", "join", "extra", "missing", "leftover", "conflict", "pending"]; // separadores (+ "clients")

function isoToDate(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }

export default function HoursReviewDialog({ open, onClose, onChange, horasData, clients, staff, period, ctx, lang, t }) {
  const isMobile = useIsMobile();
  const todayIso = isoDateStr(TODAY);
  const rec = useMemo(() => (open ? reconcileVisits(horasData, clients, period, ctx, todayIso) : null), [open, horasData, clients, period, ctx, todayIso]);
  const issues = useMemo(() => (rec ? rec.issues : []), [rec]);
  const [selected, setSelected] = useState(() => new Set());
  const [tab, setTab] = useState(null);
  const [hoursSel, setHoursSel] = useState(() => new Set()); // lançamentos de "Horas diferentes" ("funcionário|posição")
  const [openClient, setOpenClient] = useState(null);
  const [pick, setPick] = useState({});
  const seen = useRef(new Set());

  // Marca à partida os "juntar" (a primeira vez que aparecem) e limpa o que já não existe.
  useEffect(() => {
    const keys = new Set(issues.map((i) => i.key));
    setSelected((prev) => {
      const next = new Set([...prev].filter((k) => keys.has(k)));
      issues.forEach((i) => { if (PRESELECT.has(i.kind) && !i.paid && !seen.current.has(i.key)) next.add(i.key); });
      return next.size === prev.size && [...next].every((k) => prev.has(k)) ? prev : next;
    });
    issues.forEach((i) => seen.current.add(i.key));
  }, [issues]);

  useEffect(() => {
    const valid = new Set(issues.filter((i) => i.kind === "hours").flatMap((i) => i.items.filter((x) => !x.paid).map((x) => `${x.staffId}|${x.idx}`)));
    setHoursSel((prev) => { const next = new Set([...prev].filter((k) => valid.has(k))); return next.size === prev.size ? prev : next; });
  }, [issues]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang] || DAY_ABBR_SUN0_BY_LANG.pt;
  const dayLabel = (iso) => { const d = isoToDate(iso); return `${dayAbbr[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`; };
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const nameOf = (sid) => { const s = staff.find((x) => String(x.id) === String(sid)); return s ? s.name : "—"; };
  const firstOf = (sid) => nameOf(sid).split(" ")[0];
  const namesOf = (ids) => [...new Set(ids.map(String))].map(firstOf).join(", ");
  const clientName = (id) => { const c = clientById(clients, id); return c ? c.name : "—"; };
  const markText = (m) => `${firstOf(m.staffId)} ${dayLabel(m.workDate)} ${fmtHoursScreen(m.hours)}`;
  const signed = (v, f) => `${v < 0 ? "−" : "+"}${f(Math.abs(v))}`;

  // Efeito (horas e euros por pessoa) de aplicar a sugestão de cada ponto.
  const effects = useMemo(() => {
    const map = new Map();
    if (!open) return map;
    issues.forEach((i) => {
      if (i.kind !== "join" && i.kind !== "leftover") return;
      map.set(i.key, hoursImpact(horasData, applySuggestion(horasData, clients, i, ctx), clients, period));
    });
    return map;
  }, [open, issues, horasData, clients, ctx, period]);
  const effectText = (key) => {
    const list = effects.get(key) || [];
    if (list.length === 0) return "";
    return list.map((x) => `${firstOf(x.staffId)} ${signed(x.hours, fmtHoursScreen)} (${signed(x.euros, fmtEuro)})`).join(" · ");
  };

  const chosen = issues.filter((i) => selected.has(i.key) && SUGGESTED.has(i.kind) && !(i.kind === "join" && i.paid));
  const nChosen = chosen.length + hoursSel.size;
  // Aplica o que está marcado (primeiro as sugestões, depois os lançamentos de "Horas diferentes").
  const buildNext = () => {
    let next = horasData;
    chosen.forEach((i) => { next = applySuggestion(next, clients, i, ctx); });
    if (hoursSel.size > 0) next = applyHoursChanges(next, clients, period, ctx, [...hoursSel]);
    return next;
  };
  const totalEffect = useMemo(() => {
    if (!open || nChosen === 0) return null;
    const list = hoursImpact(horasData, buildNext(), clients, period);
    return { hours: list.reduce((s, x) => s + x.hours, 0), euros: list.reduce((s, x) => s + x.euros, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chosen, hoursSel, horasData, clients, ctx, period]);

  if (!open || !rec) return null;

  const counts = {};
  issues.forEach((i) => { counts[i.kind] = (counts[i.kind] || 0) + 1; });
  const tabs = [...TAB_ORDER.filter((k) => counts[k] > 0), "clients"];
  const curTab = tab && tabs.includes(tab) ? tab : tabs[0];
  const tabIssues = issues.filter((i) => i.kind === curTab);
  const selectable = tabIssues.filter((i) => SUGGESTED.has(i.kind) && !(i.kind === "join" && i.paid));
  const hoursKeysInTab = curTab === "hours" ? tabIssues.flatMap((i) => i.items.filter((x) => !x.paid).map((x) => `${x.staffId}|${x.idx}`)) : [];
  const allSelected = curTab === "hours"
    ? hoursKeysInTab.length > 0 && hoursKeysInTab.every((k) => hoursSel.has(k))
    : selectable.length > 0 && selectable.every((i) => selected.has(i.key));
  const toggle = (key) => setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleHours = (keys, on) => setHoursSel((prev) => { const next = new Set(prev); keys.forEach((k) => (on ? next.delete(k) : next.add(k))); return next; });
  const toggleAllInTab = () => {
    if (curTab === "hours") { setHoursSel((prev) => { const next = new Set(prev); hoursKeysInTab.forEach((k) => (allSelected ? next.delete(k) : next.add(k))); return next; }); return; }
    setSelected((prev) => { const next = new Set(prev); selectable.forEach((x) => (allSelected ? next.delete(x.key) : next.add(x.key))); return next; });
  };
  const applyChosen = () => {
    if (nChosen === 0) return;
    onChange(buildNext(), t.reviewDoneApplied(nChosen));
    setSelected(new Set()); setHoursSel(new Set());
  };
  const act = (fn, msg) => onChange(fn(), msg);

  const sectionTitle = { fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: "0 0 8px" };
  const card = { border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, padding: "10px 12px", background: COLORS.card };
  const line = { fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.45 };
  const rowOf = (cid) => rec.clients.find((c) => c.clientId === cid);
  const pct = rec.totals.expected > 0 ? Math.round((rec.totals.checked / rec.totals.expected) * 100) : 0;

  const kindPill = (i) => {
    const map = { join: ["pending", t.reviewKindJoin], extra: ["neutral", t.reviewKindExtra], missing: ["missing", t.reviewKindMissing], leftover: ["pending", t.reviewKindLeftover], conflict: ["missing", t.reviewKindConflict], pending: ["reopened", t.reviewKindPending], hours: ["pending", t.reviewKindHours] };
    const [variant, label] = map[i.kind];
    return <Pill variant={variant}>{label}</Pill>;
  };
  const weekTag = (i) => (i.weekStart ? t.reviewWeekOf(weekLabelPT(isoToDate(i.weekStart), lang)) : "");

  function suggestRow(i, label, disabled) {
    return (
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }}>
        <input type="checkbox" checked={selected.has(i.key) && !disabled} disabled={disabled} onChange={() => toggle(i.key)} style={{ marginTop: 3 }} aria-label={label} data-testid={`review-check-${i.kind}`} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{label}</span>
      </label>
    );
  }
  const effectLine = (i) => (effectText(i.key) ? <div style={{ ...line, marginTop: 4, fontVariantNumeric: "tabular-nums" }} data-testid="review-effect">{t.reviewEffect(effectText(i.key))}</div> : null);

  function renderIssue(i) {
    const paidPill = i.paid ? <Pill variant="neutral">{t.reviewPaidShort}</Pill> : null;
    const head = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {kindPill(i)}
        <span style={{ ...line, color: COLORS.ink3 }}>{weekTag(i)}</span>
        {paidPill}
      </div>
    );
    if (i.kind === "hours") {
      const keyOf = (x) => `${x.staffId}|${x.idx}`;
      const open_ = i.items.filter((x) => !x.paid).map(keyOf);
      const allOn = open_.length > 0 && open_.every((k) => hoursSel.has(k));
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="hours">
          {head}
          <div style={line}>{t.reviewHoursWhy(i.items.length)}</div>
          {open_.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={allOn} onChange={() => toggleHours(open_, allOn)} aria-label={t.reviewHoursAll} data-testid="review-hours-all" />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{t.reviewHoursAll}</span>
            </label>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {i.items.map((x) => (
              <div key={keyOf(x)} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderTop: `1px solid ${COLORS.lineSoft}`, opacity: x.paid ? 0.6 : 1 }} data-testid="review-hours-row">
                <input type="checkbox" checked={hoursSel.has(keyOf(x)) && !x.paid} disabled={x.paid} onChange={() => toggleHours([keyOf(x)], hoursSel.has(keyOf(x)))} aria-label={`${dayLabel(x.date)} ${nameOf(x.staffId)}`} />
                <span style={{ ...line, flex: "1 1 120px", color: COLORS.ink }}>{dayLabel(x.date)} · {firstOf(x.staffId)}{x.paid ? ` · ${t.reviewHoursPaid}` : ""}</span>
                <span style={{ ...line, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: COLORS.ink }}>{fmtHoursScreen(x.oldHours)} → {fmtHoursScreen(x.newHours)}</span>
                {!x.paid && <Button variant="ghost" onClick={() => act(() => confirmHoursOk(horasData, clients, period, ctx, [keyOf(x)]), t.reviewDoneHoursOk)}>{t.reviewHoursOk}</Button>}
              </div>
            ))}
          </div>
          {open_.length > 1 && (
            <div style={{ marginTop: 6 }}>
              <Button variant="ghost" onClick={() => act(() => confirmHoursOk(horasData, clients, period, ctx, open_), t.reviewDoneHoursOk)}>{t.reviewHoursOkAll}</Button>
            </div>
          )}
          {i.paid && <div style={{ ...line, marginTop: 4 }}>{t.reviewPaidNote}</div>}
        </div>
      );
    }
    if (i.kind === "join") {
      const nobody = i.targetMarks.length === 0;
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="join">
          {head}
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{dayLabel(i.date)}</div>
          <div style={line}>{t.reviewAgenda(dayLabel(i.date), namesOf(i.teamIds))}</div>
          <div style={line}>{t.reviewMarksLabel}: {[...i.targetMarks, ...i.marks].map(markText).join(" · ")}</div>
          <div style={{ ...line, marginTop: 6, color: COLORS.amberInk, background: COLORS.amberBg, borderRadius: RADIUS.control, padding: "6px 10px" }}>
            {t.reviewJoinWhy(namesOf(i.marks.map((m) => m.staffId)), dayLabel(i.fromDate), dayLabel(i.date), nobody)}
          </div>
          {i.paid ? <div style={{ ...line, marginTop: 6 }}>{t.reviewPaidNote}</div> : (
            <>
              {suggestRow(i, t.reviewJoinSuggest(dayLabel(i.date)), false)}
              {effectLine(i)}
              <div style={{ marginTop: 8 }}>
                <Button variant="ghost" onClick={() => act(() => keepSeparate(horasData, clients, i, ctx), t.reviewDoneKeep)}>{t.reviewKeepSeparate}</Button>
              </div>
            </>
          )}
        </div>
      );
    }
    if (i.kind === "extra") {
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="extra">
          {head}
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{dayLabel(i.date)}</div>
          <div style={line}>{t.reviewMarksLabel}: {i.marks.map(markText).join(" · ")}</div>
          <div style={line}>{i.notInAgenda ? t.reviewNotInAgenda : t.reviewAgendaNobody}</div>
          {i.answered && <div style={{ ...line, color: COLORS.amberInk }}>{t.reviewExtraAnswered}</div>}
          {suggestRow(i, t.reviewExtraAccept, false)}
          <div style={{ marginTop: 8 }}>
            <Button variant="ghost" disabled={i.paid} onClick={() => act(() => voidExtra(horasData, clients, i, ctx), t.reviewDoneVoid)}>{t.reviewExtraVoid}</Button>
          </div>
          {i.paid && <div style={{ ...line, marginTop: 4 }}>{t.reviewPaidNote}</div>}
        </div>
      );
    }
    if (i.kind === "missing") {
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="missing">
          {head}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{t.reviewMissingWhy(i.dates.length)}</div>
          <ul style={{ margin: "4px 0 6px", paddingLeft: 18 }}>
            {i.dates.map((x) => <li key={x.date} style={line}>{dayLabel(x.date)} · {namesOf(x.teamIds)}</li>)}
          </ul>
          <div style={line}>{i.firstRecord ? t.reviewMissingFirst(dayLabel(i.firstRecord)) : t.reviewMissingNone}</div>
          <div style={line}>{t.reviewMissingHint}</div>
          {suggestRow(i, t.reviewMissingAck, false)}
        </div>
      );
    }
    if (i.kind === "leftover") {
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="leftover">
          {head}
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{dayLabel(i.date)}</div>
          <div style={line}>{t.reviewMarked}: {i.markerIds.map(firstOf).join(", ")} · {t.reviewNotMarked}: {i.missingIds.map(firstOf).join(", ")}</div>
          <div style={{ ...line, fontVariantNumeric: "tabular-nums" }}>{t.reviewLeftoverGain(fmtHoursScreen(i.leftoverHours), fmtEuro(i.leftoverHours * (clientById(clients, i.clientId)?.valueHour || 0)))}</div>
          <div style={{ ...line, marginTop: 4 }}>{t.reviewLeftoverHint}</div>
          {suggestRow(i, t.reviewLeftoverSuggest, false)}
        </div>
      );
    }
    if (i.kind === "conflict") {
      return (
        <div key={i.key} style={card} data-testid="review-issue" data-kind="conflict">
          {head}
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{dayLabel(i.date)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "4px 0 6px" }}>
            {i.marks.map((m) => (
              <div key={m.staffId} style={line}><b style={{ color: COLORS.ink }}>{nameOf(m.staffId)}</b> {m.solo ? t.reviewSoloSays : t.reviewWentSays}</div>
            ))}
          </div>
          <div style={line}>{t.reviewConflictHint}</div>
          {i.paid ? <div style={{ ...line, marginTop: 6 }}>{t.reviewPaidNote}</div> : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {i.marks.map((m) => (
                <Button key={m.staffId} variant="secondary" onClick={() => act(() => resolveConflict(horasData, clients, i.date, i.clientId, "only", m.staffId, ctx), t.reviewDoneConflict)}>{t.reviewOnlyBtn(firstOf(m.staffId))}</Button>
              ))}
              <Button variant="secondary" onClick={() => act(() => resolveConflict(horasData, clients, i.date, i.clientId, "split", undefined, ctx), t.reviewDoneConflict)}>{t.reviewSplitBtn}</Button>
              <Button variant="secondary" onClick={() => act(() => resolveConflict(horasData, clients, i.date, i.clientId, "both", undefined, ctx), t.reviewDoneConflict)}>{t.reviewBothBtn}</Button>
            </div>
          )}
        </div>
      );
    }
    // pending: cliente escrito à mão
    const choice = pick[i.key] !== undefined ? pick[i.key] : "";
    const cand = i.candidates.map((id) => clientById(clients, id)).filter(Boolean);
    const assign = (cid) => act(() => assignPendingEntry(horasData, clients, i, cid, ctx), t.reviewDonePending);
    return (
      <div key={i.key} style={card} data-testid="review-issue" data-kind="pending">
        {head}
        <div style={line}>{t.reviewPendingWhy(nameOf(i.staffId), i.name, i.city, dayLabel(i.date), fmtHoursScreen(i.hours))}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          {!i.paid && cand.map((c) => <Button key={c.id} variant="secondary" onClick={() => assign(c.id)}>{t.reviewPendingSuggest(c.name)}</Button>)}
          {!i.paid && (
            <>
              <select
                value={choice} onChange={(e) => setPick((p) => ({ ...p, [i.key]: e.target.value }))} aria-label={t.reviewPendingPick}
                style={{ height: 40, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 10px", fontFamily: "inherit", fontSize: 13, background: COLORS.card, color: COLORS.ink, maxWidth: "100%" }}
              >
                <option value="">{t.reviewPendingPick}</option>
                {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <Button variant="secondary" disabled={!choice} onClick={() => { const c = clients.find((x) => String(x.id) === String(choice)); if (c) assign(c.id); }}>{t.reviewPendingAssign}</Button>
            </>
          )}
        </div>
        <div style={{ ...line, marginTop: 6 }}>{i.paid ? t.reviewPaidNote : t.reviewPendingHint}</div>
      </div>
    );
  }

  // Grupos por cliente (clientes fora da lista ficam juntos no fim).
  const groups = [];
  tabIssues.forEach((i) => {
    const key = i.clientId == null ? "__pending" : String(i.clientId);
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, clientId: i.clientId, items: [] }; groups.push(g); }
    g.items.push(i);
  });
  groups.sort((a, b) => (a.clientId == null) - (b.clientId == null));

  const visitLine = (v) => {
    const marks = v.marks.map((m) => `${firstOf(m.staffId)} ${fmtHoursScreen(m.hours)}${m.workDate !== v.date ? ` (${dayLabel(m.workDate)})` : ""}`).join(" · ");
    const state = v.marks.length > 0 ? marks : (v.state === "open" ? t.reviewVisitOpen : v.state === "none" ? t.reviewVisitNone : t.reviewVisitNoRecord);
    const exp = v.expected ? ` · ${t.reviewVisitExpectedBy(namesOf(v.teamIds))}` : "";
    return `${dayLabel(v.date)}${exp} → ${state}`;
  };

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
          background: COLORS.card, width: isMobile ? "100%" : 640, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
          borderRadius: isMobile ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          boxShadow: SHADOW.sh2, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: isMobile ? "18px 18px 10px" : "24px 24px 10px", flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{t.reviewTitle}</div>
          <button
            type="button" onClick={onClose} aria-label={t.reviewClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink3, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        {/* Resumo + separadores: ficam fixos; só a lista rola */}
        <div style={{ padding: isMobile ? "0 18px" : "0 24px", flexShrink: 0 }}>
          <div style={{ ...card, background: COLORS.lineSoft, border: "none", padding: "8px 12px", marginBottom: 10 }} data-testid="review-summary">
            {rec.totals.expected > 0 ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{t.reviewSummary(rec.totals.checked, rec.totals.expected)}</div>
                <div style={{ height: 6, borderRadius: 999, background: COLORS.line, margin: "6px 0", overflow: "hidden" }} aria-hidden="true">
                  <div style={{ width: `${pct}%`, height: "100%", background: COLORS.ok }} />
                </div>
                <div style={line}>{t.reviewClientsOk(rec.totals.clientsOk, rec.totals.clientsTotal)}{rec.totals.checkedUntil ? ` · ${t.reviewCheckedUntil(dm(rec.totals.checkedUntil))}` : ""}</div>
              </>
            ) : <div style={{ fontSize: 13.5, color: COLORS.ink }}>{t.reviewSummaryNone}</div>}
          </div>
          <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, WebkitOverflowScrolling: "touch" }} data-testid="review-tabs">
            {tabs.map((k) => {
              const on = k === curTab;
              const label = k === "clients" ? t.reviewTabClients : ({ hours: t.reviewKindHours, join: t.reviewKindJoin, extra: t.reviewKindExtra, missing: t.reviewKindMissing, leftover: t.reviewKindLeftover, conflict: t.reviewKindConflict, pending: t.reviewKindPending })[k];
              const n = k === "clients" ? rec.clients.length : counts[k];
              return (
                <button
                  key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)} data-testid={`review-tab-${k}`}
                  style={{
                    flexShrink: 0, whiteSpace: "nowrap", height: 34, padding: "0 12px", borderRadius: 999, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${on ? COLORS.vivo : COLORS.line}`, background: on ? COLORS.vivo : COLORS.card, color: on ? "#fff" : COLORS.ink2,
                  }}
                >
                  {label} <span style={{ opacity: on ? 0.9 : 0.7 }}>({n})</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: isMobile ? "4px 18px 14px" : "4px 24px 14px", borderTop: `1px solid ${COLORS.lineSoft}` }} data-testid="review-body">
          {issues.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: COLORS.okInk, background: COLORS.okTint, borderRadius: RADIUS.control, padding: "12px 14px", margin: "10px 0" }} data-testid="review-allgood">
              <Check size={16} /> {t.reviewAllGood}
            </div>
          )}
          {curTab !== "clients" && tabIssues.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", margin: "6px 0" }}>
                {(selectable.length > 0 || hoursKeysInTab.length > 0) && (
                  <button
                    type="button" onClick={toggleAllInTab}
                    style={{ border: "none", background: "transparent", color: COLORS.vivo, fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  >
                    {allSelected ? t.reviewSelectNone : t.reviewSelectAll}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {groups.map((g) => {
                  const row = g.clientId == null ? null : rowOf(g.clientId);
                  return (
                    <div key={g.key} data-testid="review-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink }}>{g.clientId == null ? t.reviewKindPending : clientName(g.clientId)}</div>
                        {row && row.expected > 0 && <div style={{ ...line, fontVariantNumeric: "tabular-nums" }}>{t.reviewClientTally(row.checked, row.expected)}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{g.items.map(renderIssue)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {curTab === "clients" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }} data-testid="review-clients">
              <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.45, marginBottom: 4 }}>{t.reviewIntro}</div>
              {rec.clients.map((c) => {
                const isOpen = openClient === c.clientId;
                const ok = c.expected > 0 && c.checked === c.expected;
                return (
                  <div key={c.clientId} style={{ ...card, padding: "8px 12px" }}>
                    <button
                      type="button" onClick={() => setOpenClient(isOpen ? null : c.clientId)}
                      style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{c.name}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...line, fontVariantNumeric: "tabular-nums" }}>
                        {c.expected > 0 ? t.reviewClientTally(c.checked, c.expected) : ""}
                        {ok && <Check size={14} color={COLORS.ok} />}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                        {c.weeks.filter((w) => w.visits.length > 0).map((w) => (
                          <div key={w.start}>
                            <div style={{ ...line, fontWeight: 600, color: COLORS.ink3 }}>{t.reviewWeekOf(weekLabelPT(isoToDate(w.start), lang))}</div>
                            {w.visits.map((v) => (
                              <div key={v.date} style={{ ...line, color: v.state === "issue" ? COLORS.amberInk : COLORS.ink2 }}>{visitLine(v)}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé fixo: efeito total das sugestões marcadas + aplicar */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${COLORS.line}`, padding: isMobile ? "12px 18px 16px" : "14px 24px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: COLORS.card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, fontVariantNumeric: "tabular-nums", flex: "1 1 180px" }} data-testid="review-total">
            {issues.length === 0 ? "" : nChosen === 0 ? t.reviewApplyNone
              : totalEffect && (Math.abs(totalEffect.hours) > 1e-9 || Math.abs(totalEffect.euros) > 1e-9)
                ? t.reviewTotalEffect(signed(totalEffect.hours, fmtHoursScreen), signed(totalEffect.euros, fmtEuro))
                : t.reviewApplyN(nChosen)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>{t.reviewClose}</Button>
            {issues.length > 0 && <Button variant="primary" onClick={applyChosen} disabled={nChosen === 0}>{t.reviewApplyN(nChosen)}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
