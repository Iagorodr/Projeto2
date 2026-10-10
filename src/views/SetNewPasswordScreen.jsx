import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { RADIUS, SHADOW } from "../styles/tokens.js";
import { T } from "../models/i18n.js";
import { Button } from "./shared/ui/index.js";

// Ecrã que bloqueia o app até a pessoa escolher uma palavra-passe só dela:
// depois de uma temporária gerada pela gerência ("temporary") ou ao abrir
// o link de recuperação enviado por email ("recovery").
function SetNewPasswordScreen({ lang, mode, onSave, onLogout }) {
  const t = T[lang].login;
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    width: "100%", boxSizing: "border-box", height: 48, borderRadius: RADIUS.control,
    border: `1px solid ${COLORS.line}`, padding: "0 40px 0 12px", fontSize: 15, fontFamily: "inherit",
  };

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 8) { setError(t.setPwTooShort); return; }
    if (pw !== pw2) { setError(t.setPwMismatch); return; }
    setError(null); setBusy(true);
    const ok = await onSave(pw);
    setBusy(false);
    if (!ok) setError(t.setPwError);
  }

  return (
    <div style={{ minHeight: "100dvh", flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box", background: "linear-gradient(155deg, #E3F2EA 0%, #A9D9C2 45%, #4D9D7E 85%, #2E8570 100%)" }}>
      <form onSubmit={submit} style={{ width: 420, maxWidth: "100%", background: COLORS.card, borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: "32px 28px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink }}>{mode === "recovery" ? t.setPwTitleRecovery : t.setPwTitleTemp}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, marginBottom: 6 }}>{mode === "recovery" ? t.setPwIntroRecovery : t.setPwIntroTemp}</div>
        <div style={{ position: "relative" }}>
          <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t.setPwNew} autoComplete="new-password" style={inputStyle} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? t.hidePassword : t.showPassword}
            style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={t.setPwConfirm} autoComplete="new-password" style={inputStyle} />
        {error && <div style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
        <Button type="submit" variant="primary" disabled={busy} style={{ height: 52, width: "100%", fontSize: 14 }}>{busy ? t.setPwSaving : t.setPwSave}</Button>
        <button type="button" onClick={onLogout} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.forest700, fontSize: 12.5, fontWeight: 600, padding: 0 }}>{t.setPwLogout}</button>
      </form>
    </div>
  );
}

export default SetNewPasswordScreen;
