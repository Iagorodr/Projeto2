// Seletor de VÁRIAS pessoas com pesquisa (irmão do SearchSelect): gatilho com o resumo
// da escolha, popover com pesquisa, linha "Todos" no topo e uma caixa de seleção por
// pessoa. `allIds` = quem a opção "Todos" marca (ex.: só os funcionários ativos).
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";
import { SearchField } from "./SearchField.jsx";

function Box({ checked, partial }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${checked || partial ? COLORS.vivo : COLORS.iconBorder}`,
        background: checked ? COLORS.vivo : partial ? COLORS.mintBg : COLORS.card,
      }}
    >
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
      {partial && !checked && <span style={{ width: 8, height: 2, borderRadius: 1, background: COLORS.vivo }} />}
    </span>
  );
}

function MultiSelect({ value, onChange, options, allIds, allLabel, summary, placeholder, searchPlaceholder, noResultsLabel, mobile }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = new Set(value.map(String));
  const everyone = (allIds || options.map((o) => o.id)).map(String);
  const allChecked = everyone.length > 0 && everyone.every((id) => selected.has(id));
  const someChecked = everyone.some((id) => selected.has(id));
  const filtered = search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const height = mobile ? 48 : 44;

  function toggle(id) {
    const key = String(id);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(options.filter((o) => next.has(String(o.id))).map((o) => o.id));
  }
  function toggleAll() {
    onChange(allChecked ? [] : options.filter((o) => everyone.includes(String(o.id))).map((o) => o.id));
  }
  const text = value.length === 0 ? "" : summary(value, allChecked);

  const row = { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", cursor: "pointer", borderRadius: RADIUS.chip, fontSize: 13, fontFamily: "inherit", color: COLORS.ink };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height,
          padding: "0 12px", borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, background: COLORS.card,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, color: text ? COLORS.ink : COLORS.ink3, textAlign: "left", boxSizing: "border-box",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text || placeholder}</span>
        <ChevronDown size={15} color={COLORS.ink3} style={{ flexShrink: 0, marginLeft: 6 }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={() => { setOpen(false); setSearch(""); }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, zIndex: 60, padding: 8 }}>
            <SearchField value={search} onChange={setSearch} placeholder={searchPlaceholder} mobile={mobile} style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {!search && (
                <button type="button" role="checkbox" aria-checked={allChecked} onClick={toggleAll} style={{ ...row, background: allChecked ? COLORS.forest50 : "transparent", fontWeight: 700, borderBottom: `1px solid ${COLORS.lineSoft}` }}>
                  <Box checked={allChecked} partial={someChecked} />{allLabel}
                </button>
              )}
              {filtered.length === 0 ? (
                <div style={{ fontSize: 12.5, color: COLORS.ink3, padding: "8px 6px" }}>{noResultsLabel}</div>
              ) : filtered.map((o) => {
                const on = selected.has(String(o.id));
                return (
                  <button key={o.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.id)} style={{ ...row, background: on ? COLORS.forest50 : "transparent" }}>
                    <Box checked={on} />{o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { MultiSelect };
