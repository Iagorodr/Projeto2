// ClientCheckCard (documento de design, 2.15 + detalhe em 5.2.4): um
// cartão por cliente da agenda do dia. 72 px de altura mín., raio 18,
// sombra sh-1. Círculo de marcação de 34 (verde ✓ quando registado,
// tocar alterna), nome 17/600, subtítulo, botão secundário 48 "Fiz mais
// tempo".
//
// Puramente apresentacional — o QUE acontece ao tocar (gravar a marcação,
// abrir a folha de "Fiz mais tempo" com o contador de meia em meia hora,
// dividir horas entre pessoas via `recomputeSharedHours`...) é lógica de
// negócio de 5.2, que fica pra Etapa 4 junto com o resto do ecrã de
// Horas; este componente só dá os `onToggle`/`onExtraTime` como callbacks.
// `extraPill`: texto opcional tipo "+30 min · por aprovar" (pílula âmbar,
// mostrada quando já há horas extra pedidas nesse cliente).
import { Check } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";
import { Pill } from "../Pill.jsx";

function ClientCheckCard({
  name, subtitle, checked, onToggle, onExtraTime, extraTimeLabel = "Fiz mais tempo",
  extraPill, readOnly, dimmed, dimmedNote,
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, minHeight: 72,
        borderRadius: 18, boxShadow: SHADOW.sh1, background: dimmed ? COLORS.lineSoft : COLORS.card,
        border: `1px solid ${COLORS.line}`, padding: "12px 14px", opacity: dimmed ? 0.75 : 1,
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        onClick={readOnly ? undefined : onToggle}
        disabled={readOnly}
        aria-label={name}
        style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0, border: `2px solid ${checked ? COLORS.ok : COLORS.lineInput}`,
          background: checked ? COLORS.ok : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: readOnly ? "default" : "pointer",
        }}
      >
        {checked && <Check size={18} color="#fff" strokeWidth={2.5} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 2 }}>
          {dimmed && dimmedNote ? dimmedNote : subtitle}
        </div>
        {extraPill && <div style={{ marginTop: 6 }}><Pill variant="pending">{extraPill}</Pill></div>}
      </div>

      {!readOnly && !dimmed && onExtraTime && (
        <button
          type="button"
          onClick={onExtraTime}
          style={{
            height: 48, padding: "0 14px", borderRadius: RADIUS.control, flexShrink: 0,
            border: `1px solid ${COLORS.lineInput}`, background: COLORS.card, color: COLORS.forest700,
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {extraTimeLabel}
        </button>
      )}
    </div>
  );
}

export { ClientCheckCard };
