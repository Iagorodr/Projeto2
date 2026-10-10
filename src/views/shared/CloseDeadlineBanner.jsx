// Prazo obrigatório de fecho do mês (Definições → "Fecho do mês").
// Faixa de aviso (antes do prazo acabar) e painel de bloqueio do Dashboard
// da gerência (depois do prazo).
import { COLORS } from "../../styles/colors.js";
import { T } from "../../models/i18n.js";

function CloseDeadlineBanner({ lang, info, role, finalized, onGoHours }) {
  const t = T[lang].common;
  if (!info || !info.ended) return null;
  if (role === "employee" && finalized && !info.overdue) return null;
  const overdue = info.overdue;
  const dl = info.deadline;
  const dlStr = `${String(dl.getDate()).padStart(2, "0")}/${String(dl.getMonth() + 1).padStart(2, "0")}`;
  const title = role === "employee"
    ? (overdue ? t.cdEmpOverdueTitle : t.cdEmpTitle(dlStr))
    : (overdue ? t.cdMgmtOverdueTitle : t.cdEmpTitle(dlStr));
  const body = role === "employee"
    ? (overdue ? t.cdEmpOverdueBody : t.cdEmpBody(info.daysLeft))
    : (overdue ? t.cdMgmtOverdueBanner : t.cdMgmtBody(info.daysLeft));
  return (
    <div role="alert" style={{
      margin: "0 0 14px", padding: "12px 16px", borderRadius: 14, boxSizing: "border-box",
      background: overdue ? COLORS.alertTint : COLORS.amberBg,
      border: `1px solid ${overdue ? COLORS.alert : "#EBD9A8"}`,
      color: overdue ? COLORS.alert : COLORS.amberInk,
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{body}</div>
      </div>
      {role === "management" && onGoHours && (
        <button type="button" onClick={onGoHours} style={{ border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", background: overdue ? COLORS.alert : COLORS.amberInk, color: "#fff" }}>{t.cdGoHours}</button>
      )}
    </div>
  );
}

function CloseLockPanel({ lang, periodLabel, onGoHours }) {
  const t = T[lang].common;
  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 560, margin: "60px auto", padding: 28, borderRadius: 20, background: COLORS.alertTint, border: `1px solid ${COLORS.alert}`, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.alert }}>{t.cdMgmtOverdueTitle}</div>
        <div style={{ fontSize: 14, color: COLORS.ink, margin: "10px 0 18px" }}>{t.cdMgmtLockBody(periodLabel)}</div>
        <button type="button" onClick={onGoHours} style={{ border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: COLORS.alert, color: "#fff" }}>{t.cdGoHours}</button>
      </div>
    </div>
  );
}

export { CloseDeadlineBanner, CloseLockPanel };
