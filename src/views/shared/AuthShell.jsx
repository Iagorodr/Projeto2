// Casca comum dos ecrãs de antes do login (código da empresa, login,
// assinatura vencida): fundo em gradiente, seletor de idioma e cartão central.
// O logótipo também vive aqui para os três ecrãs usarem o mesmo.
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW, FONT } from "../../styles/tokens.js";
import { LangSwitcher } from "./Layout.jsx";
import { LogoMark } from "./Logo.jsx";

// Logótipo do ecrã de início de sessão (documento, 4.12): "bloco 34
// forest-600 com ✓ + 'Servi' em forest-800 e 'x' em clay".
export function LoginLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.forest600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <LogoMark size={22} tone="reversed" />
      </div>
      <span style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 21, color: COLORS.forest800, lineHeight: 1 }}>
        Servi<span style={{ color: COLORS.clay }}>x</span>
      </span>
    </div>
  );
}

// Campo de texto dos ecrãs de antes do login.
export const authInputStyle = {
  width: "100%", height: 44, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`,
  padding: "0 14px", fontSize: 14, color: COLORS.ink, background: COLORS.card, boxSizing: "border-box",
  fontFamily: "inherit",
};

// Fundo: gradiente verde-menta → forest, com dois brilhos radiais (clay no
// topo, forest escuro no canto oposto) — eco dos dois tons da marca.
export function AuthShell({ lang, setLang, children, cardStyle }) {
  return (
    <div
      style={{
        minHeight: "100dvh", flex: 1, width: "100%", position: "relative", boxSizing: "border-box",
        background: "linear-gradient(155deg, #E3F2EA 0%, #A9D9C2 45%, #4D9D7E 85%, #2E8570 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(circle at 50% 0%, rgba(226,138,101,.35), transparent 50%), " +
            "radial-gradient(circle at 100% 100%, rgba(15,49,41,.35), transparent 55%)",
        }}
      />
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <div
        style={{
          position: "relative", width: 420, maxWidth: "100%", background: COLORS.card,
          borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: "36px 32px", boxSizing: "border-box",
          ...cardStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
