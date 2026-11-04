// Botão fixo "?" (só PC/tablet), canto inferior direito. Ficheiro à parte para
// a Ajuda (manuais pt/en/fr, ~100 kB) só ser descarregada quando é aberta.
import { CircleHelp } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";

export const HELP_LABEL = { pt: "Ajuda", en: "Help", fr: "Aide" };

export function HelpFab({ lang, onClick }) {
  const label = HELP_LABEL[lang] || HELP_LABEL.pt;
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label}
      style={{
        position: "fixed", right: 22, bottom: 22, zIndex: 40, width: 52, height: 52, borderRadius: RADIUS.pill ?? 999,
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(180deg, ${COLORS.vivoBtnTop}, ${COLORS.vivoBtnBottom})`, color: "#fff",
        boxShadow: SHADOW.sh2 || "0 10px 20px -8px rgba(31,122,95,.7)",
      }}
    >
      <CircleHelp size={26} strokeWidth={2} />
    </button>
  );
}
