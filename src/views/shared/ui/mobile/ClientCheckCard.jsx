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
import { Check, Clock, User, Undo2 } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { SHADOW } from "../../../../styles/tokens.js";
import { Pill } from "../Pill.jsx";

// Redesign B1 (Horas do funcionário, ecrã 2): cartão grande; o círculo marca ✓
// e, depois de marcado, aparecem por baixo as ações "Ajustar horas" e
// "Trabalhei sozinho". As horas vão em destaque à direita (tiradas do início do
// `subtitle`, ex.: "1h30 · a sua parte (2 pessoas)").
const HOURS_RE = /^(\d+h(?:\d{2})?|\d+\s?min)(?: · |$)/;
const HEADING = "'Archivo Variable', 'Archivo Display', sans-serif";

function ActionButton({ icon: Icon, label, onClick, active }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: "1 1 auto", minHeight: 50, padding: "0 12px", borderRadius: 16, whiteSpace: "nowrap",
      border: `1.5px solid ${active ? "var(--p1)" : COLORS.line}`, background: active ? "var(--p1-8)" : COLORS.card,
      color: COLORS.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <Icon size={17} strokeWidth={2.2} /> {label}
    </button>
  );
}

function ClientCheckCard({
  name, subtitle, checked, onToggle, onExtraTime, extraTimeLabel = "Fiz mais tempo",
  extraPill, extraPillVariant = "pending", readOnly, dimmed, dimmedNote, onAdjustSplit, adjustSplitLabel,
  onSolo, soloLabel, soloActive, soloTag, soloUndoLabel, conflictTag, managerTag,
}) {
  const text = dimmed && dimmedNote ? dimmedNote : (subtitle || "");
  const m = !dimmed ? HOURS_RE.exec(text) : null;
  const hours = m ? m[1] : null;
  const rest = m ? text.slice(m[0].length) : text;
  const showActions = !readOnly && !dimmed && checked && (onExtraTime || onSolo || (onAdjustSplit && adjustSplitLabel));
  return (
    <div
      style={{
        borderRadius: 24, boxShadow: SHADOW.sh1, background: dimmed ? COLORS.lineSoft : COLORS.card,
        border: `2px solid ${checked && !dimmed ? "var(--p1-20)" : "transparent"}`, padding: "14px 16px",
        opacity: dimmed ? 0.75 : 1, boxSizing: "border-box", transition: "border-color .2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56 }}>
        <button
          type="button"
          onClick={readOnly ? undefined : onToggle}
          disabled={readOnly}
          aria-label={name}
          aria-pressed={!!checked}
          style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            border: checked ? "none" : `2px solid ${COLORS.lineInput}`,
            background: checked ? "var(--p1)" : COLORS.card, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: readOnly ? "default" : "pointer", transition: "background .2s",
          }}
        >
          {checked && <Check key="ck" className="b1-pop" size={26} color="#fff" strokeWidth={3} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17.5, fontWeight: 700, color: COLORS.ink, lineHeight: 1.25, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {name}
          </div>
          {rest && <div style={{ fontSize: 14, color: COLORS.ink2, marginTop: 2, lineHeight: 1.3 }}>{rest}</div>}
          {(extraPill || conflictTag || managerTag || (soloActive && soloTag)) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {extraPill && <Pill variant={extraPillVariant}>{extraPill}</Pill>}
              {conflictTag && <Pill variant="pending">{conflictTag}</Pill>}
              {managerTag && <Pill variant="neutral">{managerTag}</Pill>}
              {soloActive && soloTag && <Pill variant="paid">{soloTag}</Pill>}
            </div>
          )}
        </div>

        {hours && (
          <div style={{ fontFamily: HEADING, fontSize: 22, color: COLORS.ink, flexShrink: 0, whiteSpace: "nowrap" }}>{hours}</div>
        )}
      </div>

      {showActions && (
        <div className="b1-rise" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${COLORS.line}` }}>
          {onExtraTime && <ActionButton icon={Clock} label={extraTimeLabel} onClick={onExtraTime} />}
          {onAdjustSplit && adjustSplitLabel && <ActionButton icon={User} label={adjustSplitLabel} onClick={onAdjustSplit} />}
          {onSolo && <ActionButton icon={soloActive ? Undo2 : User} label={soloActive ? soloUndoLabel : soloLabel} onClick={onSolo} active={soloActive} />}
        </div>
      )}
    </div>
  );
}

export { ClientCheckCard };
