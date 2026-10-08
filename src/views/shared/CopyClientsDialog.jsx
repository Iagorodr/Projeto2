import { useState, useEffect } from "react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { fmtMinutes } from "../../models/utils.js";
import { T } from "../../models/i18n.js";

// Texto curto com os dados principais de um ou mais clientes, para colar em
// qualquer conversa (WhatsApp, SMS, e-mail). Por defeito SEM a observação
// (código de acesso, chave, cão...) — a mensagem fica curta e os dados
// sensíveis só saem se a gerência marcar a opção.
function clientShareText(client, { withNote, labels }) {
  const place = [client.address, client.city].filter(Boolean).join(", ");
  const freq = client.frequency === "biweekly" ? labels.biweekly : client.frequency === "monthly" ? labels.monthly : "";
  const when = [client.availability, client.duration ? fmtMinutes(client.duration) : "", freq].filter(Boolean).join(" · ");
  const lines = [client.name];
  if (place) lines.push(place);
  if (when) lines.push(when);
  if (withNote && client.note) lines.push(`${labels.note}: ${client.note}`);
  return lines.join("\n");
}

function CopyClientsDialog({ lang, title, clients, header, onClose }) {
  const t = T[lang].absences;
  const c0 = T[lang].common;
  const [withNote, setWithNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const labels = { biweekly: t.shareBiweekly, monthly: t.shareMonthly, note: t.shareNoteLabel };
  const text = clients.map((c) => clientShareText(c, { withNote, labels })).join("\n\n");

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      // Sem acesso à área de transferência: o texto fica visível e selecionável.
      setCopied(false);
    }
  }

  return (
    <div role="dialog" aria-label={title} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: RADIUS.card, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: 18, boxSizing: "border-box" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 10 }}>{title}</div>
        {header}
        {clients.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.ink2, padding: "10px 0" }}>{t.shareNone}</div>
        ) : (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink, margin: "10px 0" }}>
              <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} />
              {t.shareWithNote}
            </label>
            <textarea readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} onFocus={(e) => e.target.select()}
              style={{ ...styles.textarea, width: "100%", boxSizing: "border-box", fontSize: 13 }} />
          </>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, height: 40, borderRadius: RADIUS.control, border: `1px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.ink, fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            {c0.close}
          </button>
          <button type="button" disabled={clients.length === 0} onClick={copy}
            style={{ flex: 2, height: 40, borderRadius: RADIUS.control, border: "none", background: clients.length ? COLORS.forest600 : COLORS.line, color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: clients.length ? "pointer" : "default" }}>
            {copied ? t.shareCopied : t.shareCopy}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CopyClientsDialog;
