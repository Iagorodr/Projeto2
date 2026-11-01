// WeekStrip (documento de design, 2.15 + detalhe em 5.2.2): tira de
// mosaicos de dia, um por dia da semana/bloco, mín. 36 px de largura,
// altura 68 (8 mosaicos nos blocos de 8 dias — ver 5.2.1 — cabem porque o
// componente não fixa a largura, só a altura e o mínimo).
//
// Puramente apresentacional/controlado por props — cada mosaico recebe um
// `state` já decidido por quem usa o componente (a Etapa 4 é que vai
// calcular, a partir dos dados reais de horas/agenda, se um dia está
// registado, em falta, sem clientes etc. — a lógica de negócio de 5.2 não
// mora aqui, só os 8 estados visuais que o documento nomeia).
//
// `days`: [{ key, dayLabel (ex.: "SEG"), dayNumber, state, isToday }]
// `state` ∈ "registered" | "missing" | "selected" | "noClients" |
//           "future" | "weekLocked" | "outsideLocked" | "default"
import { Lock } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";

// Redesign B1: registado (traço verde em baixo) · em falta (tracejado âmbar) ·
// sem clientes (às riscas) · hoje (contorno escuro) · selecionado (escuro).
const HATCH = "repeating-linear-gradient(135deg, #EEF0EC 0 4px, #FAFAF8 4px 8px)";
function tileStyle(state, isToday) {
  const today = isToday ? { boxShadow: "inset 0 0 0 2.5px #151816" } : {};
  switch (state) {
    case "selected":
      return { background: "#151816", color: "#fff", border: "none" };
    case "missing":
      return { background: "#FFF8EA", color: COLORS.ink, border: "2px dashed #E2A93B", ...today };
    case "noClients":
      return { background: HATCH, color: COLORS.ink3, border: "none", ...today };
    case "weekLocked":
    case "outsideLocked":
      return { background: COLORS.lineSoft, color: COLORS.ink3, border: "none", ...today };
    case "future":
      return { background: COLORS.card, color: COLORS.ink2, border: "none", ...today };
    case "registered":
    default:
      return { background: COLORS.card, color: COLORS.ink, border: "none", ...today };
  }
}

function StateIcon({ state }) {
  if (state === "registered") return <span style={{ width: 18, height: 4, borderRadius: 2, background: "var(--p1)" }} />;
  if (state === "selected") return <span style={{ width: 18, height: 4, borderRadius: 2, background: "var(--p1-60)" }} />;
  if (state === "missing") return <span style={{ width: 18, height: 4, borderRadius: 2, background: "#E2A93B" }} />;
  if (state === "weekLocked") return <Lock size={12} color={COLORS.ink2} />;
  if (state === "outsideLocked") return <Lock size={12} color={COLORS.ink3} />;
  return <span style={{ height: 4 }} />;
}

function LegendSwatch({ kind }) {
  const base = { width: 12, height: 12, borderRadius: 3, display: "inline-block", flexShrink: 0, boxSizing: "border-box" };
  if (kind === "done") return <span style={{ ...base, background: "var(--p1)" }} />;
  if (kind === "missing") return <span style={{ ...base, border: "1.5px dashed #E2A93B" }} />;
  if (kind === "none") return <span style={{ ...base, background: "repeating-linear-gradient(135deg, #D3D8D1 0 2px, transparent 2px 4px)" }} />;
  return <span style={{ ...base, boxShadow: "inset 0 0 0 2px #151816" }} />;
}

function WeekStrip({ days, onSelectDay, legend = "registado · em falta · tracejado: sem clientes", legendItems }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 1px" }}>
        {days.map((d) => {
          const style = tileStyle(d.state, d.isToday);
          const clickable = d.state !== "weekLocked" && d.state !== "outsideLocked" && !!onSelectDay;
          return (
            <button
              key={d.key}
              type="button"
              onClick={clickable ? () => onSelectDay(d.key) : undefined}
              disabled={!clickable}
              style={{
                minWidth: 40, flex: "1 0 40px", maxWidth: 64, height: 76, borderRadius: 16,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
                boxShadow: "0 1px 2px rgba(21,24,22,.05)", transition: "background .2s, color .2s",
                cursor: clickable ? "pointer" : "default", fontFamily: "inherit", position: "relative",
                ...style,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", opacity: 0.7 }}>{d.dayLabel}</span>
              <span style={{ fontFamily: "'Archivo Variable', 'Archivo Display', sans-serif", fontSize: 21, lineHeight: 1 }}>{d.dayNumber}</span>
              <StateIcon state={d.state} />
            </button>
          );
        })}
      </div>
      {legendItems ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 14px", marginTop: 8 }}>
          {["done", "missing", "none", "today"].filter((k) => legendItems[k]).map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.ink2 }}>
              <LegendSwatch kind={k} />{legendItems[k]}
            </div>
          ))}
        </div>
      ) : (
        legend && <div style={{ fontSize: 11, color: COLORS.ink3, marginTop: 8 }}>{legend}</div>
      )}
    </div>
  );
}

export { WeekStrip };
