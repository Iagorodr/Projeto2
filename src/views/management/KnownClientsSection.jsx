import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY } from "../../models/data.js";
import { isoDateStr, clientById } from "../../models/utils.js";
import { Button, ConfirmDialog } from "../shared/ui/index.js";

// Funcionário → "Clientes conhecidos": atalho com clientes que esta pessoa faz
// de vez em quando (e que NÃO são da agenda dela). Aparecem no celular dela em
// «Adicionar outro cliente», sem precisar de procurar/digitar o nome. Não é um
// tipo de cliente nem muda a agenda. Cada linha: { clientId } (listas antigas
// podem ter `from`/`to`; as que já terminaram deixam de aparecer e saem ao gravar).
function KnownClientsSection({ staffMember, clients, assignments = {}, setStaff, t, cancelLabel = "Cancelar" }) {
  const today = isoDateStr(TODAY);
  const all = Array.isArray(staffMember.knownClients) ? staffMember.knownClients : [];
  const list = all.filter((k) => !k.to || k.to >= today);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [removeId, setRemoveId] = useState(null);

  // Clientes fixos da agenda dele não entram (já aparecem sozinhos).
  const agendaIds = new Set();
  Object.keys(assignments || {}).forEach((key) => {
    if (key.startsWith(`${staffMember.id}-`)) (assignments[key] || []).forEach((cid) => agendaIds.add(String(cid)));
  });
  const knownIds = new Set(list.map((k) => String(k.clientId)));
  const options = clients.filter((c) => !agendaIds.has(String(c.id)) && !knownIds.has(String(c.id))).sort((a, b) => a.name.localeCompare(b.name));

  const save = (next) => setStaff((prev) => prev.map((s) => (s.id === staffMember.id ? { ...s, knownClients: next } : s)));
  function add() {
    if (!pick) return;
    save([...list, { clientId: Number(pick) }]);
    setAdding(false); setPick("");
  }
  const removing = removeId != null ? clientById(clients, removeId) : null;

  return (
    <div data-testid="known-clients">
      <div style={{ fontSize: 12.5, color: COLORS.ink3, marginBottom: 8 }}>{t.knownClientsHint}</div>
      {list.length === 0 && <div style={styles.noClientsText}>{t.knownEmpty}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {list.map((k) => {
          const c = clientById(clients, k.clientId);
          return (
            <div key={k.clientId} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{c ? c.name : `#${k.clientId}`}</div>
                {c && c.city && <div style={{ fontSize: 12, color: COLORS.ink3 }}>{c.city}</div>}
              </div>
              <Button variant="dangerSoft" icon={Trash2} onClick={() => setRemoveId(k.clientId)}>{t.knownRemove}</Button>
            </div>
          );
        })}
      </div>

      {!adding ? (
        <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={14} /> {t.knownAdd}</Button>
      ) : (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {options.length === 0 ? (
            <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.knownNoOptions}</div>
          ) : (
            <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2 }}>{t.knownPick}
              <select style={{ ...styles.input, marginTop: 4 }} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{t.knownPickPlaceholder}</option>
                {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</option>)}
              </select>
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {options.length > 0 && <Button variant="primary" onClick={add} disabled={!pick}>{t.knownSave}</Button>}
            <Button variant="secondary" onClick={() => { setAdding(false); setPick(""); }}><X size={14} /></Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeId != null}
        title={t.knownRemoveTitle}
        body={t.knownRemoveBody(removing ? removing.name : "", (staffMember.name || "").split(" ")[0])}
        cancelLabel={cancelLabel}
        confirmLabel={t.knownRemove}
        destructive
        onCancel={() => setRemoveId(null)}
        onConfirm={() => { save(list.filter((k) => String(k.clientId) !== String(removeId))); setRemoveId(null); }}
      />
    </div>
  );
}

export default KnownClientsSection;
