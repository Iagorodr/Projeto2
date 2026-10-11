// Interruptor — Verde vivo (documento do Tomás): desligado #7A9A8C (cinza-verde
// com contraste), ligado #27916F, bolinha branca. Sem `onChange` vira só
// indicador de leitura (sem clique, sem papel de botão).
import { COLORS } from "../../../styles/colors.js";

function Toggle({ on, onChange, ariaLabel, disabled, readOnly }) {
  const track = {
    display: "inline-flex", alignItems: "center", width: 44, height: 26, borderRadius: 999,
    background: on ? COLORS.vivoToggleOn : COLORS.fieldBorder,
    padding: 3, boxSizing: "border-box", flexShrink: 0, border: "none",
    transition: "background .15s ease", opacity: disabled ? 0.45 : 1,
  };
  const knob = (
    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform .15s ease" }} />
  );
  if (readOnly || !onChange) return <span style={track} aria-hidden="true">{knob}</span>;
  return (
    <button
      type="button" role="switch" aria-checked={!!on} aria-label={ariaLabel}
      disabled={disabled} onClick={() => onChange(!on)}
      style={{ ...track, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}
    >
      {knob}
    </button>
  );
}

export { Toggle };
