// Controlo segmentado e chips de filtro (documento de design, 2.6).
//
// Introduzidos na Etapa 2 (componentes); já ligados a vários ecrãs
// redesenhados na Etapa 4 — comentário antigo (dizia "ainda não ligados a
// nenhum ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem mudança
// de comportamento.
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, MOTION } from "../../../styles/tokens.js";

// options: [{ value, label }]
function SegmentedControl({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex", background: COLORS.segmentBg, borderRadius: RADIUS.control,
        padding: 3, gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              padding: "7px 14px", borderRadius: RADIUS.control - 2,
              background: active ? COLORS.card : "transparent",
              color: active ? COLORS.ink : COLORS.ink2,
              boxShadow: active ? "0 1px 2px rgba(20,63,53,.12)" : "none",
              transition: `background ${MOTION.fast} ease, box-shadow ${MOTION.fast} ease`,
              fontFamily: "inherit",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// `count`: número opcional, mostrado numa mini-pílula depois do texto.
function FilterChip({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: RADIUS.pill,
        border: active ? "1px solid transparent" : `1px solid ${COLORS.line}`,
        background: active ? COLORS.forest800 : COLORS.card,
        color: active ? "#fff" : COLORS.ink,
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        transition: `background ${MOTION.fast} ease`,
      }}
    >
      {children}
      {count != null && (
        <span
          style={{
            fontSize: 11, fontWeight: 700, borderRadius: RADIUS.pill,
            padding: "1px 7px", lineHeight: "16px",
            background: active ? "rgba(255,255,255,.22)" : COLORS.lineSoft,
            color: active ? "#fff" : COLORS.ink2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export { SegmentedControl, FilterChip };
