// Cabeçalho mobile (documento de design, 3.3): em cima à esquerda botão
// redondo de 44 (voltar/início), à direita seletor de língua compacto
// ("PT ▾", altura 40); por baixo o título em FRASE NORMAL (nunca
// maiúsculas), alinhado à esquerda, Poppins 600 28 — acaba com o título
// centrado, em maiúsculas e o ícone solto ao lado que o app tem hoje.
//
// Introduzido na Etapa 2 (componentes); usado como componente em
// MonitoramentoScreen.jsx e EmployeeHorasScreen.jsx. Nos outros ecrãs
// mobile redesenhados na Etapa 4, o cabeçalho ficou como marcação inline
// reaproveitando `mobStyles.header`/`homeIcon` (mesmo resultado visual,
// sem passar por este componente) — decisão já tomada ecrã a ecrã, não um
// esquecimento. Comentário antigo (dizia "ainda não ligado a nenhum
// ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento.
import { useState } from "react";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { FONT, RADIUS } from "../../../../styles/tokens.js";

function CompactLangSwitcher({ lang, setLang, langNames }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 40, padding: "0 10px", borderRadius: RADIUS.control, border: `1px solid ${COLORS.line}`,
          background: COLORS.card, display: "flex", alignItems: "center", gap: 4,
          fontSize: 13, fontWeight: 700, color: COLORS.ink, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {lang.toUpperCase()}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: 44, background: COLORS.card, border: `1px solid ${COLORS.line}`,
            borderRadius: RADIUS.control, overflow: "hidden", zIndex: 20, minWidth: 120, boxShadow: "0 4px 14px rgba(20,63,53,.15)",
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

function MobileHeader({ onBack, backLabel = "Voltar", title, lang, setLang, langNames }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        {onBack ? (
          <button
            type="button" onClick={onBack} aria-label={backLabel}
            style={{
              width: 44, height: 44, borderRadius: "50%", border: `1px solid ${COLORS.line}`, background: COLORS.card,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink,
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        ) : <span />}
        {lang && setLang && langNames && <CompactLangSwitcher lang={lang} setLang={setLang} langNames={langNames} />}
      </div>
      <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 28, color: COLORS.ink, textAlign: "left" }}>
        {title}
      </div>
    </div>
  );
}

export { MobileHeader };
