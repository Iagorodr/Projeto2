// Seletor com pesquisa (documento de design, 4.7/5.6: "Funcionário (seletor
// com pesquisa)", "Cliente (seletor com pesquisa)") — não existia nenhum
// componente assim na Etapa 2, então é um padrão novo, ad hoc, no mesmo
// espírito dos outros dois já construídos sem entrar na lista partilhada
// (o menu "Tipo ▾" de Clientes, Etapa 4f; o popover de adicionar cliente de
// Agendas, Etapa 4e) — com uma diferença: aqui o MESMO padrão é preciso em
// mais de um ecrã já nesta etapa (a gaveta "Novo aviso" da gerência e os
// dois formulários do telemóvel/supervisor), por isso desta vez compensa
// pôr no sítio partilhado em vez de duplicar o popover 2-3 vezes.
//
// Gatilho = uma caixa com o valor escolhido (ou o placeholder) + seta;
// clicar abre um popover com `SearchField` + lista com scroll — mesmo
// backdrop "clique fora fecha" já usado no menu Tipo▾.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";
import { SearchField } from "./SearchField.jsx";

function SearchSelect({ value, onChange, options, placeholder, searchPlaceholder, noResultsLabel, disabled, mobile }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.id === value);
  const filtered = search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const height = mobile ? 48 : 44;

  function pick(id) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height,
          padding: "0 12px", borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`,
          background: disabled ? COLORS.lineSoft : COLORS.card, cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit", fontSize: 13.5, color: selected ? COLORS.ink : COLORS.ink3, textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} color={COLORS.ink3} style={{ flexShrink: 0, marginLeft: 6 }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={() => { setOpen(false); setSearch(""); }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: COLORS.card,
              border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, zIndex: 60, padding: 8,
            }}
          >
            <SearchField value={search} onChange={setSearch} placeholder={searchPlaceholder} mobile={mobile} style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.length === 0 ? (
                <div style={{ fontSize: 12.5, color: COLORS.ink3, padding: "8px 6px" }}>{noResultsLabel}</div>
              ) : filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none",
                    background: o.id === value ? COLORS.forest50 : "transparent", cursor: "pointer",
                    borderRadius: RADIUS.chip, fontSize: 13, fontFamily: "inherit", color: COLORS.ink,
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { SearchSelect };
