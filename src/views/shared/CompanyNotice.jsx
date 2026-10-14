import { AlertTriangle, Clock, MessageCircle } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { T } from "../../models/i18n.js";
import { supportWhatsappUrl, formatIsoDate } from "../../models/companyContext.js";

// Aviso de assinatura no topo do app.
//   notice: { kind: "soon" | "grace", daysLeft, validUntil } (ver companyContext.js)
//   audience: "management" | "employee"
// Em tolerância a gerência vê um aviso forte (vermelho, sem fechar) com atalho
// para renovar; os funcionários, um aviso mais calmo a pedir que avisem a gerência.
export default function CompanyNotice({ lang, notice, audience, companyName, companyCode }) {
  if (!notice) return null;
  const t = T[lang].company;
  const date = formatIsoDate(notice.validUntil);
  const manager = audience === "management";
  const strong = notice.kind === "grace" && manager;
  const text = notice.kind === "soon"
    ? t.noticeSoon(notice.daysLeft, date)
    : manager ? t.noticeGraceManager(notice.daysLeft, date) : t.noticeGraceEmployee(notice.daysLeft);
  const palette = strong
    ? { bg: COLORS.dangerSolid, ink: "#FFFFFF", border: COLORS.dangerSolid }
    : { bg: COLORS.amberBg, ink: COLORS.amberInk, border: "#F0DDAE" };
  const Icon = strong ? AlertTriangle : Clock;
  return (
    <div
      role={strong ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        background: palette.bg, color: palette.ink, border: `1px solid ${palette.border}`,
        borderRadius: RADIUS.control, padding: strong ? "14px 16px" : "10px 14px",
        fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 600, lineHeight: 1.4,
      }}
    >
      <Icon size={strong ? 22 : 18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 200 }}>{text}</span>
      {manager && (
        <a
          href={supportWhatsappUrl(t.whatsappMessage(companyName, companyCode))} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontWeight: 700, fontSize: 13.5,
            padding: "8px 14px", borderRadius: RADIUS.control, whiteSpace: "nowrap",
            background: strong ? "#FFFFFF" : COLORS.amberInk, color: strong ? COLORS.dangerSolid : "#FFFFFF",
          }}
        >
          <MessageCircle size={16} /> {t.noticeRenew}
        </a>
      )}
    </div>
  );
}
