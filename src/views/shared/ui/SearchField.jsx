// Campo de pesquisa (documento de design, 2.7). Foco/estados de campo
// seguem a regra geral de formulários (secção 1.6): contorno forest-500 +
// anel 3px rgba(46,133,112,.2).
//
// Introduzido na Etapa 2 (componentes); já ligado em `EmployeeClientesScreen.jsx`
// (versão PC/tablet) e, indiretamente, em `AvisosScreen.jsx`/
// `EmployeeAvisosScreen.jsx` via `SearchSelect.jsx`, que o usa por dentro.
// As versões mobile desses mesmos ecrãs continuam com o markup antigo
// (`mobStyles.searchWrap`/`searchInput`), mesma decisão de "PC usa
// componente novo, mobile fica com o markup embutido" já documentada
// noutros componentes — comentário antigo corrigido aqui, varredura de
// QA pós-Etapa 4, sem mudança de comportamento.
import { useState } from "react";
import { Search, X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, MOTION } from "../../../styles/tokens.js";

function SearchField({ value, onChange, placeholder, mobile, clearLabel = "Limpar", style }) {
  const [focused, setFocused] = useState(false);
  const height = mobile ? 44 : 42;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8, height,
        borderRadius: RADIUS.control, background: COLORS.card,
        border: `1px solid ${focused ? COLORS.forest500 : COLORS.lineInput}`,
        boxShadow: focused ? "0 0 0 3px rgba(46,133,112,.2)" : "none",
        padding: "0 12px", transition: `border-color ${MOTION.fast} ease, box-shadow ${MOTION.fast} ease`,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <Search size={18} strokeWidth={1.8} color={COLORS.ink3} style={{ flexShrink: 0 }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          border: "none", outline: "none", background: "transparent", flex: 1,
          fontSize: 14, color: COLORS.ink, fontFamily: "inherit", minWidth: 0,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: COLORS.ink3, flexShrink: 0, padding: 2,
          }}
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

export { SearchField };
