import { useState } from "react";
import { Plus, X } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY } from "../../models/data.js";
import { isoDateStr, isOccasionalClient, clientById } from "../../models/utils.js";
import { Button, Pill } from "../shared/ui/index.js";

// Funcionário → "Clientes conhecidos": clientes ocasionais (tipo «Ocasional /
// conhecido» em Clientes) que esta pessoa conhece. Aparecem no celular dela em
// «Adicionar outro cliente», sem estarem na agenda. Cada linha: { clientId,
// from, to } (datas "YYYY-MM-DD"; `to` vazio = sem fim). Remover = pôr uma
// data final: a pessoa ainda pode lançar horas até essa data (inclusive).
const fmt = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; };

function KnownClientsSection({ staffMember, clients, setStaff, t }) {
  const today = isoDateStr(TODAY);
  const list = Array.isArray(staffMember.knownClients) ? staffMember.knownClients : [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ clientId: "", from: today, to: "" });
  const [removeIdx, setRemoveIdx] = useState(null);
  const [removeDate, setRemoveDate] = useState(today);
  const [err, setErr] = useState("");

  const isLive = (k) => !k.to || k.to >= today;
  const takenIds = new Set(list.filter(isLive).map((k) => String(k.clientId)));
  const options = clients.filter((c) => isOccasionalClient(c) && !takenIds.has(String(c.id))).sort((a, b) => a.name.localeCompare(b.name));

  function save(nextList) {
    setStaff((prev) => prev.map((s) => (s.id === staffMember.id ? { ...s, knownClients: nextList } : s)));
  }
  function add() {
    if (!draft.clientId) return;
    if (draft.to && draft.to < draft.from) { setErr(t.knownInvalidRange); return; }
    const entry = { clientId: Number(draft.clientId), from: draft.from || today, to: draft.to || null };
    save([...list, entry]);
    setAdding(false); setErr(""); setDraft({ clientId: "", from: today, to: "" });
  }
  function confirmRemove() {
    const k = list[removeIdx];
    if (!k) return;
    if (removeDate < (k.from || "")) { setErr(t.knownInvalidRange); return; }
    save(list.map((x, i) => (i === removeIdx ? { ...x, to: removeDate } : x)));
    setRemoveIdx(null); setErr("");
  }

  // Mais recentes/ativos primeiro; terminados no fim.
  const rows = list.map((k, i) => ({ k, i })).sort((a, b) => Number(isLive(b.k)) - Number(isLive(a.k)) || String(a.k.from).localeCompare(String(b.k.from)));

  return (
    <div data-testid="known-clients">
      <div style={{ fontSize: 12.5, color: COLORS.ink3, marginBottom: 8 }}>{t.knownClientsHint}</div>
      {rows.length === 0 && <div style={styles.noClientsText}>{t.knownEmpty}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {rows.map(({ k, i }) => {
          const c = clientById(clients, k.clientId);
          const live = isLive(k);
          return (
            <div key={`${k.clientId}-${k.from}-${i}`} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 12px", opacity: live ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{c ? c.name : `#${k.clientId}`}</div>
                  <div style={{ fontSize: 12, color: COLORS.ink3 }}>
                    {k.from ? t.knownSince(fmt(k.from)) : ""}{k.to ? ` · ${t.knownUntil(fmt(k.to))}` : ""}
                  </div>
                </div>
                {!live && <Pill variant="neutral">{t.knownEnded}</Pill>}
                {live && removeIdx !== i && (
                  <Button variant="ghost" onClick={() => { setRemoveIdx(i); setRemoveDate(k.to || today); setErr(""); }}>{k.to ? t.knownRemoveFrom : t.knownRemove}</Button>
                )}
              </div>
              {removeIdx === i && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2 }}>{t.knownRemoveFrom}
                    <input type="date" style={{ ...styles.input, marginTop: 4 }} value={removeDate} onChange={(e) => setRemoveDate(e.target.value)} />
                  </label>
                  <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.knownRemoveNote}</div>
                  {err && <div style={{ fontSize: 12.5, color: COLORS.dangerInk }}>{err}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="primary" onClick={confirmRemove} disabled={!removeDate}>{t.knownRemoveConfirm}</Button>
                    <Button variant="secondary" onClick={() => { setRemoveIdx(null); setErr(""); }}><X size={14} /></Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!adding ? (
        <Button variant="secondary" onClick={() => { setAdding(true); setErr(""); }}><Plus size={14} /> {t.knownAdd}</Button>
      ) : (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {options.length === 0 ? (
            <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.knownNoOptions}</div>
          ) : (
            <>
              <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2 }}>{t.knownPick}
                <select style={{ ...styles.input, marginTop: 4 }} value={draft.clientId} onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}>
                  <option value="">{t.knownPickPlaceholder}</option>
                  {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2, flex: "1 1 140px" }}>{t.knownFrom}
                  <input type="date" style={{ ...styles.input, marginTop: 4 }} value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2, flex: "1 1 140px" }}>{t.knownTo}
                  <input type="date" style={{ ...styles.input, marginTop: 4 }} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
                </label>
              </div>
            </>
          )}
          {err && <div style={{ fontSize: 12.5, color: COLORS.dangerInk }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            {options.length > 0 && <Button variant="primary" onClick={add} disabled={!draft.clientId || !draft.from}>{t.knownSave}</Button>}
            <Button variant="secondary" onClick={() => { setAdding(false); setErr(""); }}><X size={14} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnownClientsSection;
