import { useState } from "react";
import { COLORS } from "../styles/colors.js";
import { FONT } from "../styles/tokens.js";
import { T } from "../models/i18n.js";
import { Button } from "./shared/ui/index.js";
import { AuthShell, LoginLogo, authInputStyle } from "./shared/AuthShell.jsx";

// Primeiro ecrã (várias empresas no mesmo banco): a pessoa escreve o código da
// empresa — uma só vez por aparelho; fica guardado e a partir daí abre-se
// direto o login. O código também pode vir num link (…/?e=codigo).
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
    <AuthShell lang={lang} setLang={setLang}>
      <LoginLogo />
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: COLORS.ink }}>{t.gateTitle}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 4 }}>{t.gateIntro}</div>
        <label htmlFor="company-code" style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink2 }}>{t.gateLabel}</label>
        <input
          id="company-code" name="company" value={value} onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          placeholder={t.gatePlaceholder} style={{ ...authInputStyle, height: 48, fontSize: 15 }}
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
        />
        {error && (
          <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>
            {t[ERROR_KEY[error]] || t.gateError}
          </div>
        )}
        <Button type="submit" variant="primary" disabled={busy} style={{ height: 52, width: "100%", marginTop: 4, fontSize: 14 }}>
          {busy ? t.gateChecking : t.gateContinue}
        </Button>
        <div style={{ fontSize: 12.5, color: COLORS.ink3, textAlign: "center", marginTop: 6 }}>{t.gateHelp}</div>
      </form>
    </AuthShell>
  );
}

export default CompanyGateScreen;
