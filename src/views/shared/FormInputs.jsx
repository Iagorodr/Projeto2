import { useRef, useState, useEffect } from "react";
import { Calendar, Plus, Minus } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { parseHoursInput, fmtHM } from "../../models/utils.js";

// Máscara dd/mm/aaaa: só dígitos, e a "/" entra sozinha depois do dia e do mês.
function maskDMY(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
const dmyToIso = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const isoToDmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

const iconBtn = {
  width: 40, height: 40, flexShrink: 0, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surface,
  color: COLORS.primaryDark, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit",
};

// Data "dd/mm/aaaa": escreve-se à mão (com as barras automáticas) ou escolhe-se
// no calendário (botão à direita, usa o seletor de datas do próprio sistema).
function DateField({ value, onChange, placeholder = "dd/mm/aaaa", openLabel = "Calendar" }) {
  const pickerRef = useRef(null);
  function openPicker() {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") { try { el.showPicker(); return; } catch (_) { /* cai no fallback */ } }
    el.focus(); el.click();
  }
  return (
    <div style={{ display: "flex", gap: 6, position: "relative" }}>
      <input
        style={styles.input} inputMode="numeric" placeholder={placeholder} value={value || ""}
        onChange={(e) => onChange(maskDMY(e.target.value))}
        maxLength={10}
      />
      <button type="button" aria-label={openLabel} title={openLabel} style={iconBtn} onClick={openPicker}><Calendar size={17} /></button>
      <input
        ref={pickerRef} type="date" tabIndex={-1} aria-hidden="true"
        value={dmyToIso(value)}
        onChange={(e) => onChange(isoToDmy(e.target.value))}
        style={{ position: "absolute", right: 0, bottom: 0, width: 40, height: 1, opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

// Duração em horas "1:30" (valor guardado em MINUTOS). Botões − / + mexem
// de 30 em 30 min; também se pode escrever (1:30, 1,5, 90min, 45 …).
function DurationField({ value, onChange, step = 30, placeholder = "0:00" }) {
  const minutes = Number(value) || 0;
  const [text, setText] = useState(value === "" || value == null ? "" : fmtHM(minutes));
  useEffect(() => { setText(value === "" || value == null ? "" : fmtHM(Number(value) || 0)); }, [value]);
  function commit() {
    const parsed = parseHoursInput(text);
    if (parsed == null) { setText(value === "" || value == null ? "" : fmtHM(minutes)); return; }
    onChange(parsed); setText(fmtHM(parsed));
  }
  function bump(delta) { onChange(Math.max(0, minutes + delta)); }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button type="button" aria-label={`-${step} min`} style={iconBtn} onClick={() => bump(-step)}><Minus size={17} /></button>
      <input
        style={{ ...styles.input, textAlign: "center" }} inputMode="text" placeholder={placeholder} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      />
      <button type="button" aria-label={`+${step} min`} style={iconBtn} onClick={() => bump(step)}><Plus size={17} /></button>
    </div>
  );
}

export { DateField, DurationField, maskDMY };
