import { Lock, MessageCircle } from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { FONT } from "../styles/tokens.js";
import { T } from "../models/i18n.js";
import { Button } from "./shared/ui/index.js";
import { AuthShell, LoginLogo } from "./shared/AuthShell.jsx";
import { SUPPORT_WHATSAPP, supportWhatsappUrl, formatIsoDate } from "../models/companyContext.js";

// Assinatura vencida (depois da semana de tolerância) ou empresa suspensa:
// ninguém entra. Quem é funcionário é mandado falar com a gerência; a gerência
// tem o botão do WhatsApp do suporte para renovar.
// `block`: { state: "expired" | "suspended", name, validUntil, code }
function CompanyBlockedScreen({ lang, setLang, block, onBack }) {
  const t = T[lang].company;
  const suspended = block.state === "suspended";
  const date = formatIsoDate(block.validUntil);
  return (
    <AuthShell lang={lang} setLang={setLang}>
      <LoginLogo />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.alertTint, color: COLORS.alert, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={22} />
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.ink }}>
          {suspended ? t.blockedTitleSuspended : t.blockedTitleExpired}
        </div>
        <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.5 }}>
          {suspended ? t.blockedSuspended(block.name) : t.blockedExpired(block.name, date)}
        </div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5 }}>{t.blockedDataSafe}</div>
        <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>{t.blockedEmployee}</div>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>{t.blockedManager}</div>
          <Button
            type="button" variant="primary" icon={MessageCircle} style={{ height: 48, width: "100%", fontSize: 14, gap: 8 }}
            onClick={() => window.open(supportWhatsappUrl(t.whatsappMessage(block.name, block.code)), "_blank", "noopener,noreferrer")}
          >
            {t.whatsappButton}
          </Button>
          <div style={{ fontSize: 12.5, color: COLORS.ink3, textAlign: "center" }}>{SUPPORT_WHATSAPP}</div>
        </div>
        <button
          type="button" onClick={onBack}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.forest700, fontSize: 13, fontWeight: 600, padding: "8px 0", fontFamily: "inherit" }}
        >
          {t.blockedBack}
        </button>
      </div>
    </AuthShell>
  );
}

export default CompanyBlockedScreen;
