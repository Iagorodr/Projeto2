import { useMemo, useState } from "react";
import { CalendarOff } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { styles } from "../../styles/styles.js";
import { TODAY } from "../../models/data.js";
import { HOLIDAY_T } from "../../models/i18nHoliday.js";
import { DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { holidayOn } from "../../models/holidays.js";
import { holidayClientsOn, holidayDecisions, isHolidayCover, isVisitCover, isoDateStr, addDays, dowOfIso, pad2 } from "../../models/utils.js";
import { Drawer, SegmentedControl, Button } from "../shared/ui/index.js";
import { newVisitCovers } from "./CoverDialog.jsx";

const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

// Decisão cliente a cliente de um feriado (ver `isHolidayCover` em utils.js). Ao guardar,
// cria/atualiza as decisões e, nos "mudar de dia", uma visita avulsa no dia escolhido.
function HolidayPlanner({ open, onClose, lang, iso, clients, staff, assignments, covers, setCovers, onDone }) {
  const t = HOLIDAY_T[lang] || HOLIDAY_T.pt;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const name = holidayOn(iso, lang) || t.tag;
  const rows = useMemo(() => holidayClientsOn(clients, staff, assignments, iso), [clients, staff, assignments, iso]);
  const existing = useMemo(() => holidayDecisions(covers, iso), [covers, iso]);
  const initial = useMemo(() => {
    const m = {};
    existing.forEach((d, cid) => { m[cid] = d.decision === "keep" ? { decision: "keep" } : d.moveTo ? { decision: "move", moveTo: d.moveTo } : { decision: "skip" }; });
    return m;
  }, [existing]);
  const [choice, setChoice] = useState(initial);

  // Dias possíveis para mudar: de hoje até 6 dias depois do feriado, sem domingos nem o próprio feriado.
  const dayOptions = useMemo(() => {
    const out = [];
    const start = parse(iso);
    for (let i = -6; i <= 6; i++) {
      const d = addDays(start, i);
      const k = isoDateStr(d);
      if (k === iso || k < isoDateStr(TODAY) || d.getDay() === 0 || holidayOn(k, lang)) continue;
      out.push({ iso: k, label: `${dayLabels[dowOfIso(k)]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` });
    }
    return out;
  }, [iso, lang]);

  const firstName = (id) => ((staff || []).find((s) => String(s.id) === String(id))?.name || "").split(" ")[0];
  const same = (a, b) => (a?.decision || null) === (b?.decision || null) && (a?.moveTo || null) === (b?.moveTo || null);
  const changed = rows.filter((r) => choice[r.client.id] && !same(choice[r.client.id], initial[r.client.id]));
  const dirty = changed.length > 0;
  const undecidedLeft = rows.filter((r) => !choice[r.client.id]).length;
  const set = (cid, v) => setChoice((c) => ({ ...c, [cid]: v }));

  function markAll(kind) {
    setChoice((c) => {
      const n = { ...c };
      rows.forEach((r) => {
        if (kind === "skip" && r.perWeek <= 1) return; // 1 visita por semana: tem de ser mudado de dia
        n[r.client.id] = { decision: kind };
      });
      return n;
    });
  }

  function save() {
    if (!dirty) { onClose?.(); return; }
    const ids = new Set(changed.map((r) => r.client.id));
    const oldVisitGroups = new Set();
    (covers || []).forEach((cv) => { if (isHolidayCover(cv) && cv.holiday === iso && ids.has(cv.clientId) && cv.visitGroup) oldVisitGroups.add(cv.visitGroup); });
    let next = (covers || []).filter((cv) => !(isHolidayCover(cv) && cv.holiday === iso && ids.has(cv.clientId)) && !(isVisitCover(cv) && oldVisitGroups.has(cv.groupId)));
    const now = new Date().toISOString();
    const created = [];
    changed.forEach((r) => {
      const ch = choice[r.client.id];
      let visitGroup = null;
      if (ch.decision === "move" && ch.moveTo) {
        const visits = newVisitCovers({ clientId: r.client.id, staffIds: r.staffIds, dates: [ch.moveTo], covers: [...next, ...created], assignments });
        visitGroup = visits[0]?.groupId || null;
        created.push(...visits);
      }
      r.staffIds.forEach((sid) => created.push({
        id: `hd-${iso}-${r.client.id}-${sid}`, kind: "holiday", holiday: iso, clientId: r.client.id,
        decision: ch.decision === "keep" ? "keep" : "skip", moveTo: ch.decision === "move" ? ch.moveTo : null, visitGroup,
        fromStaffId: sid, toStaffId: null, from: iso, to: iso, createdAt: now,
      }));
    });
    next = [...next, ...created];
    setCovers(() => next);
    onDone?.(t.saved(changed.length));
    onClose?.();
  }

  const moveIncomplete = changed.some((r) => choice[r.client.id].decision === "move" && !choice[r.client.id].moveTo);

  return (
    <Drawer
      open={open} onClose={onClose} icon={CalendarOff} title={`${name} · ${dm(iso)}`}
      dirty={dirty} unsavedTitle={t.unsavedTitle} unsavedBody={t.unsavedBody} unsavedCancelLabel={t.unsavedCancel} unsavedConfirmLabel={t.unsavedLeave}
      footer={<Button onClick={save} disabled={moveIncomplete || (!dirty)} style={{ width: "100%" }}>{t.save}</Button>}
    >
      <div style={{ fontSize: 13.5, color: COLORS.ink2, marginBottom: 12 }}>{t.intro}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13.5, color: COLORS.ink3 }}>{t.noClients}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <Button variant="secondary" onClick={() => markAll("skip")}>{t.allSkip}</Button>
            <Button variant="secondary" onClick={() => markAll("keep")}>{t.allKeep}</Button>
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink3, marginBottom: 12 }}>{t.allSkipNote}{undecidedLeft > 0 ? ` · ${t.pendingLeft(undecidedLeft)}` : ""}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((r) => {
              const ch = choice[r.client.id];
              return (
                <div key={r.client.id} style={{ padding: "12px 0", borderTop: `1px solid ${COLORS.line}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 14.5, color: COLORS.ink }}>{r.client.name}</b>
                    <span style={{ fontSize: 12.5, color: COLORS.ink3 }}>{r.staffIds.map(firstName).join(", ")}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2, color: r.perWeek <= 1 ? COLORS.alert : COLORS.ink3, fontWeight: r.perWeek <= 1 ? 700 : 500 }}>
                    {r.perWeek <= 1 ? t.onceWarn : t.twiceHint(r.perWeek)}
                  </div>
                  <div style={{ marginTop: 8, overflowX: "auto" }}>
                    <SegmentedControl
                      value={ch?.decision || ""}
                      onChange={(v) => set(r.client.id, v === "move" ? { decision: "move", moveTo: ch?.moveTo || null } : { decision: v })}
                      options={[{ value: "keep", label: t.keep }, { value: "skip", label: t.skip }, { value: "move", label: t.move }]}
                    />
                  </div>
                  {ch?.decision === "move" && (
                    <select aria-label={t.pickDay} value={ch.moveTo || ""} onChange={(e) => set(r.client.id, { decision: "move", moveTo: e.target.value || null })}
                      style={{ ...styles.input, width: "auto", minWidth: 180, marginTop: 8, borderRadius: RADIUS.control }}>
                      <option value="">{t.pickDay}</option>
                      {dayOptions.map((o) => <option key={o.iso} value={o.iso}>{o.label}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Drawer>
  );
}

export default HolidayPlanner;
