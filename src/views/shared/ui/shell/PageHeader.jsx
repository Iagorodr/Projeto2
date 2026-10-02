// Cabeçalho de página (documento de design, 3.4, PC/tablet): título H1 +
// subtítulo (por defeito a data, ex.: "Terça-feira, 29 de setembro") à
// esquerda; à direita, ações da página (botão primário) e seletor de
// língua. Isto SUBSTITUI a faixa com a data sublinhada no canto superior
// esquerdo que existia antes em todas as páginas (`TopBar`, que ficava em
// views/shared/Layout.jsx) — o documento é explícito: "desaparece".
//
// Introduzido na Etapa 3 (casca); já troca o `TopBar` em todos os 16
// ecrãs redesenhados na Etapa 4. O `TopBar` e o `SupervisorDashboardScreen.jsx`
// (seu único utilizador restante, já substituído pelo EmployeeInicioScreen
// novo, ver nota em App.jsx) foram removidos do projeto na limpeza
// pós-Etapa 4 — nenhum ecrã ao vivo usava mais nenhum dos dois.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { FONT, RADIUS } from "../../../../styles/tokens.js";

function LangSwitcher({ lang, setLang, langNames }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", background: COLORS.bg, border: `1px solid ${COLORS.line}`,
          borderRadius: RADIUS.control, padding: "6px 10px", fontSize: 13, fontWeight: 500, color: COLORS.ink,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {langNames[lang]}
        <ChevronDown size={14} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: 38, background: COLORS.card, border: `1px solid ${COLORS.line}`,
            borderRadius: RADIUS.control, overflow: "hidden", zIndex: 20, minWidth: 130, boxShadow: "0 4px 14px rgba(20,63,53,.15)",
          }}
        >
          {Object.keys(langNames).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => { setLang(code); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none",
                background: "transparent", fontSize: 13, fontWeight: code === lang ? 700 : 400, color: COLORS.ink,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {langNames[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle, actions, lang, setLang, langNames }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, color: COLORS.ink, lineHeight: 1.15 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 4 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {actions}
        {lang && setLang && langNames && <LangSwitcher lang={lang} setLang={setLang} langNames={langNames} />}
      </div>
    </div>
  );
}

export { PageHeader };
