import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { Button } from "../shared/ui/index.js";
import { Dialog } from "./AdminUi.jsx";
import { deliveryMessage, accessLink } from "../../models/adminCompanies.js";

// Depois de criar uma empresa (ou gerar nova palavra-passe): tudo o que se
// entrega à gerência, com mensagem pronta. A palavra-passe só existe aqui.
//   delivery: { company: {name, code}, email, password }  |  { company, email, error }
export default function DeliveryDialog({ delivery, onClose, notify }) {
  const { company, email, password, error } = delivery;
  const link = accessLink(window.location.origin, company.code);
  const message = password ? deliveryMessage({ name: company.name, link, code: company.code, email, password }) : "";
  const [copied, setCopied] = useState(null);

  async function copy(key, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      notify("Não foi possível copiar — selecione o texto e copie à mão.");
    }
  }

  const row = (label, value, mono = false) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${COLORS.lineSoft}` }}>
      <div style={{ width: 118, flexShrink: 0, fontSize: 12.5, color: COLORS.ink3, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: COLORS.ink, wordBreak: "break-all", fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit", fontWeight: mono ? 700 : 500 }}>{value}</div>
    </div>
  );

  return (
    <Dialog title={error ? `${company.name} — falta a palavra-passe` : `Acesso de ${company.name}`} onClose={onClose} width={560}>
      {error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontWeight: 600 }}>
            A empresa foi criada, mas não foi possível gerar a palavra-passe da gerência: {error}
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5 }}>
            Quando resolver (por exemplo, publicar a função <b>admin-company-login</b> no Supabase), use o botão “Nova senha” no cartão da empresa.
          </div>
          {row("Link", link)}{row("Código", company.code)}{row("E-mail", email)}
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Button type="button" variant="primary" onClick={onClose}>Fechar</Button></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
            A palavra-passe só aparece agora. Copie e envie já; se perder, gere outra em “Nova senha”.
          </div>
          <div>
            {row("Link de acesso", link)}{row("Código", company.code)}{row("E-mail", email)}{row("Palavra-passe", password, true)}
          </div>
          <textarea readOnly value={message} rows={9} onFocus={(e) => e.target.select()} style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, border: `1px solid ${COLORS.lineInput}`, padding: 12, fontSize: 13, lineHeight: 1.5, fontFamily: "inherit", color: COLORS.ink, background: COLORS.headerTint, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button type="button" variant="secondary" icon={copied === "link" ? Check : Copy} onClick={() => copy("link", link)}>{copied === "link" ? "Copiado" : "Copiar link"}</Button>
            <Button type="button" variant="secondary" icon={MessageCircle} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")}>Abrir no WhatsApp</Button>
            <Button type="button" variant="primary" icon={copied === "msg" ? Check : Copy} onClick={() => copy("msg", message)}>{copied === "msg" ? "Copiada" : "Copiar mensagem"}</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
