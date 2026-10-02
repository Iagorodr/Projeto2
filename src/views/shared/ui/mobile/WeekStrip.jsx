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
import { Check, AlertTriangle, Lock } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";

function tileStyle(state, isToday) {
  switch (state) {
    case "selected":
      return { background: "linear-gradient(150deg, #2A8A73, #185A4A)", color: "#fff", border: "none" };
    case "missing":
      return { background: COLORS.card, color: COLORS.ink, border: `2px solid ${COLORS.alert}` };
    case "noClients":
      return { background: "transparent", color: COLORS.ink3, border: `1px dashed ${COLORS.line}` };
    case "weekLocked":
    case "outsideLocked":
      return { background: COLORS.lineSoft, color: COLORS.ink3, border: `1px solid ${COLORS.line}` };
    case "future":
      return { background: COLORS.card, color: COLORS.ink2, border: `1px solid ${COLORS.line}` };
    case "registered":
    default:
      return { background: COLORS.card, color: COLORS.ink, border: `1px solid ${COLORS.line}` };
  }
}

function StateIcon({ state }) {
  if (state === "registered") return <Check size={14} color={COLORS.ok} strokeWidth={2.2} />;
  if (state === "missing") return <AlertTriangle size={14} color={COLORS.alert} strokeWidth={2} />;
  if (state === "weekLocked") return <Lock size={13} color={COLORS.ink2} />;
  if (state === "outsideLocked") return <Lock size={13} color={COLORS.ink3} />;
  return null;
}

function WeekStrip({ days, onSelectDay, legend = "registado · em falta · tracejado: sem clientes" }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
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
                minWidth: 36, width: 44, height: 68, borderRadius: 14, flexShrink: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                cursor: clickable ? "pointer" : "default", fontFamily: "inherit", position: "relative",
                ...style,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", opacity: 0.85 }}>{d.dayLabel}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{d.dayNumber}</span>
              <StateIcon state={d.state} />
              {d.isToday && (
                <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: COLORS.clay }} />
              )}
            </button>
          );
        })}
      </div>
      {legend && <div style={{ fontSize: 11, color: COLORS.ink3, marginTop: 8 }}>{legend}</div>}
    </div>
  );
}

export { WeekStrip };
