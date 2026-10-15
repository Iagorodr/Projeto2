import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { Button } from "../shared/ui/index.js";
import { Dialog, Field, inputStyle } from "./AdminUi.jsx";

// Excluir uma empresa arquivada para sempre. Para não acontecer por engano, é
// preciso digitar o código da empresa. `onConfirm()` devolve uma mensagem de
// erro (string) ou null se correu bem; o servidor volta a conferir o código.
export default function DeleteForeverDialog({ company: c, onConfirm, onClose }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === c.code;

  async function submit(e) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true); setError(null);
    const err = await onConfirm(typed.trim());
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Dialog title={`Excluir ${c.name} para sempre?`} onClose={busy ? () => {} : onClose} width={480}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div role="note" style={{ display: "flex", gap: 10, background: COLORS.alertTint, color: COLORS.alert, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5 }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <b>Não tem volta.</b> Vai apagar de vez: {c.clientsCount} {c.clientsCount === 1 ? "cliente" : "clientes"}, {c.staffCount} {c.staffCount === 1 ? "funcionário" : "funcionários"}, as definições, todos os dados do app e os <b>logins</b> da gerência e dos funcionários.
          </div>
        </div>
        <Field label={`Para confirmar, digite o código da empresa: ${c.code}`} htmlFor="df-code">
          <input id="df-code" value={typed} onChange={(e) => setTyped(e.target.value)} style={inputStyle} autoFocus autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={c.code} />
        </Field>
        {error && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" variant="dangerSolid" disabled={!matches || busy}>{busy ? "A excluir..." : "Excluir definitivamente"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
