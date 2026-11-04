import { useState } from "react";
import { COLORS } from "../styles/colors.js";
import { FONT } from "../styles/tokens.js";
import { T } from "../models/i18n.js";
import { Button } from "./shared/ui/index.js";
import { AuthShell, LoginLogo, authInputStyle } from "./shared/AuthShell.jsx";

// Primeiro ecrã: código da empresa. Placeholder «Ex: acme-lda», taglines
// no painel esquerdo (desktop) via AuthShell.
const ERROR_KEY = { invalid: "gateInvalid", not_found: "gateNotFound", error: "gateError", empty: "gateEmpty" };

function CompanyGateScreen({ lang, setLang, onSubmit }) {
  const t = T[lang].company;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!value.trim()) { setError("empty"); return; }
    setBusy(true);
    setError(null);
    const result = await onSubmit(value);
    setBusy(false);
    if (result !== "ok") setError(result);
  }

  return (
    <AuthShell lang={lang} setLang={setLang} tagline={t.gateTagline} subtitle={t.gateSubtitle}>
      <LoginLogo />
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 24, fontWeight: 800, color: COLORS.ink, lineHeight: 1.2 }}>{t.gateTitle}</div>
        <div style={{ fontSize: 14, color: COLORS.ink2, lineHeight: 1.5 }}>{t.gateIntro}</div>
        <label htmlFor="company-code" style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink2, marginTop: 4 }}>{t.gateLabel}</label>
        <input
          id="company-code" name="company" value={value} onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          placeholder={t.gatePlaceholder} style={authInputStyle}
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
        />
        {error && (
          <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
            {t[ERROR_KEY[error]] || t.gateError}
          </div>
        )}
        <Button type="submit" variant="primary" disabled={busy} style={{ height: 52, width: "100%", marginTop: 4, fontSize: 15 }}>
          {busy ? t.gateChecking : t.gateContinue}
        </Button>
        <div style={{ fontSize: 13, color: COLORS.ink3, textAlign: "center", marginTop: 4 }}>{t.gateHelp}</div>
      </form>
    </AuthShell>
  );
}

export default CompanyGateScreen;
