import { useState } from "react";
import { COLORS } from "../../styles/colors.js";
import { Button } from "../shared/ui/index.js";
import { Dialog, Field, inputStyle } from "./AdminUi.jsx";
import { slugify, isValidCode, isValidEmail, addMonths, renewedUntil, todayIso, formatIsoDate } from "../../models/adminCompanies.js";

const TIMEZONES = [
  ["Europe/Brussels", "Bélgica (Europe/Brussels)"], ["Europe/Lisbon", "Portugal (Europe/Lisbon)"], ["Europe/Paris", "França (Europe/Paris)"],
  ["Europe/Luxembourg", "Luxemburgo (Europe/Luxembourg)"], ["Europe/London", "Reino Unido (Europe/London)"], ["Europe/Madrid", "Espanha (Europe/Madrid)"],
  ["America/Sao_Paulo", "Brasil (America/Sao_Paulo)"], ["Atlantic/Azores", "Açores (Atlantic/Azores)"],
];

// Criar ou editar uma empresa.
//   mode "create": nome, código, e-mail da gerência, validade, fuso, notas.
//   mode "edit":   igual, sem o e-mail da gerência.
// `onSubmit(values)` devolve uma mensagem de erro (string) ou null se correu bem.
export default function CompanyFormDialog({ mode, company, onSubmit, onClose }) {
  const editing = mode === "edit";
  const tz0 = company?.timezone || "Europe/Brussels";
  const [name, setName] = useState(company?.name || "");
  const [code, setCode] = useState(company?.code || "");
  const [codeTouched, setCodeTouched] = useState(editing);
  const [email, setEmail] = useState("");
  const [noLimit, setNoLimit] = useState(editing ? company.validUntil == null : false);
  const [validUntil, setValidUntil] = useState(company?.validUntil || addMonths(todayIso(tz0), 1));
  const [timezone, setTimezone] = useState(tz0);
  const [notes, setNotes] = useState(company?.notes || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const today = todayIso(timezone);
  const tzOptions = TIMEZONES.some(([v]) => v === tz0) ? TIMEZONES : [[tz0, tz0], ...TIMEZONES];

  function onName(v) {
    setName(v);
    if (!codeTouched) setCode(slugify(v));
  }
  function quick(months) {
    setNoLimit(false);
    setValidUntil(renewedUntil(editing ? company.validUntil : null, today, months));
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const c = code.trim().toLowerCase();
    if (!name.trim()) return setError("Escreva o nome da empresa.");
    if (!isValidCode(c)) return setError("Código inválido: use 2 a 31 letras minúsculas, números ou hífen (sem espaços).");
    if (!editing && !isValidEmail(email)) return setError("Escreva o e-mail da gerência.");
    if (!noLimit && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return setError("Escolha a data de validade (ou marque \"Sem prazo\").");
    setError(null);
    setBusy(true);
    const err = await onSubmit({ name: name.trim(), code: c, managerEmail: email.trim().toLowerCase(), validUntil: noLimit ? null : validUntil, timezone, notes: notes.trim() });
    setBusy(false);
    if (err) setError(err);
  }

  const codeChanged = editing && code.trim().toLowerCase() !== company.code;

  return (
    <Dialog title={editing ? `Editar ${company.name}` : "Nova empresa"} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Nome da empresa" htmlFor="cf-name">
          <input id="cf-name" value={name} onChange={(e) => onName(e.target.value)} style={inputStyle} autoFocus placeholder="ex.: Limpezas Águia, Lda" />
        </Field>
        <Field label="Código da empresa" htmlFor="cf-code" hint="É o que a equipa escreve antes do login (e vai no link). Só letras minúsculas, números e hífen.">
          <input id="cf-code" value={code} onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toLowerCase().replace(/\s+/g, "-")); }} style={inputStyle} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="ex.: limpezas-aguia" />
        </Field>
        {codeChanged && (
          <div style={{ background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>
            Trocar o código: quem já o tem guardado no aparelho terá de usar “Trocar de empresa” e escrever o novo. Os links antigos deixam de servir.
          </div>
        )}
        {!editing && (
          <Field label="E-mail da gerência" htmlFor="cf-email" hint="A conta principal da empresa. Receberá uma palavra-passe temporária (gerada a seguir).">
            <input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoCapitalize="none" placeholder="gerencia@empresa.com" />
          </Field>
        )}
        <Field label="Validade da assinatura" htmlFor="cf-valid" hint={noLimit ? "Sem data de fim: nunca bloqueia." : `Acesso normal até ao fim deste dia, mais 7 dias de tolerância com aviso. Hoje: ${formatIsoDate(today)}.`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input id="cf-valid" type="date" value={noLimit ? "" : validUntil} disabled={noLimit} onChange={(e) => setValidUntil(e.target.value)} style={{ ...inputStyle, width: 170, opacity: noLimit ? 0.5 : 1 }} />
            {[1, 3, 6, 12].map((m) => (
              <button key={m} type="button" onClick={() => quick(m)} style={chipBtn}>{editing ? "+" : ""}{m} {m === 1 ? "mês" : "meses"}</button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink2, marginTop: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={noLimit} onChange={(e) => setNoLimit(e.target.checked)} /> Sem prazo (sem data de fim)
          </label>
        </Field>
        <Field label="Fuso horário" htmlFor="cf-tz" hint="Define a que horas “acaba o dia” da validade e quando saem os lembretes.">
          <select id="cf-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle}>
            {tzOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Notas (só você vê)" htmlFor="cf-notes">
          <textarea id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical" }} placeholder="ex.: plano, contacto, forma de pagamento" />
        </Field>
        {error && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "A guardar..." : editing ? "Guardar" : "Criar empresa"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

const chipBtn = {
  height: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${COLORS.iconBorder}`, background: COLORS.mintBg,
  color: COLORS.vivo, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
