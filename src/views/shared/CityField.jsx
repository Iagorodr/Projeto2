import { useState } from "react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { resolveCity, suggestCities } from "../../models/cities.js";

// Campo "Cidade" dos clientes: escreve-se e escolhe-se uma localidade da
// Bélgica (lista em models/cities.js). Só nomes reconhecidos são aceites —
// ao sair do campo, um nome (ou alias: "Brussel", "Anvers"...) reconhecido
// vira o nome canónico; o que não é reconhecido fica por corrigir.
function CityField({ value, onChange, placeholder, noMatchLabel, hint }) {
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const text = value || "";
  const options = focus ? suggestCities(text, 8) : [];
  const exact = resolveCity(text);
  const showNoMatch = focus && text.trim() && options.length === 0;

  function pick(name) { onChange(name); setFocus(false); setActive(0); }
  function onKey(e) {
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(options[Math.min(active, options.length - 1)].name); }
    else if (e.key === "Escape") setFocus(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...styles.input, ...(text.trim() && !exact && !focus ? { borderColor: COLORS.alert } : {}) }}
        value={text} placeholder={placeholder} autoComplete="off" role="combobox" aria-expanded={options.length > 0}
        onChange={(e) => { onChange(e.target.value); setActive(0); }}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          // pequeno atraso: deixa o clique numa sugestão acontecer primeiro
          setTimeout(() => { setFocus(false); const r = resolveCity(text); if (r && r.name !== text) onChange(r.name); }, 120);
        }}
        onKeyDown={onKey}
      />
      {(options.length > 0 || showNoMatch) && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 70, background: COLORS.card,
            border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, padding: 4, maxHeight: 260, overflowY: "auto",
          }}
        >
          {options.map((p, i) => (
            <button
              key={p.name} type="button" role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p.name); }}
              style={{
                display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13.5, color: COLORS.ink, padding: "8px 10px", borderRadius: RADIUS.chip,
                background: i === active ? COLORS.forest50 : "transparent",
              }}
            >
              {p.name}
            </button>
          ))}
          {showNoMatch && <div style={{ padding: "8px 10px", fontSize: 12.5, color: COLORS.ink2 }}>{noMatchLabel}</div>}
        </div>
      )}
      {hint && <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default CityField;
