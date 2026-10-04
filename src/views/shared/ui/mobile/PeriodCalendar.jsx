// PeriodCalendar (documento de design, 2.15 + detalhe em 5.2.7): grelha
// de semanas (linhas) × SEG–DOM (colunas) cobrindo o período aberto.
// Célula 44×44: registado (ok-tint, com horas curtas "2h30" quando cabe),
// sem atendimento (cinzento com traço), em falta (alert-tint), sem agenda
// (vazio tracejado), fora do período (invisível), hoje (ponto clay).
// Tocar num dia salta para esse dia.
//
// Puramente apresentacional. `weeks`: matriz de semanas, cada uma com 7
// células SEG→DOM: [{ key, dayNumber, state, hoursLabel, isToday }].
// `state` ∈ "registered" | "noAttendance" | "missing" | "noSchedule" | "outside"
//
// `muted` (QA pós-auditoria, Lote 2 — "mês finalizado cinza"): este mesmo
// componente é usado tanto na vista normal/editável (cores do documento,
// 2.15) quanto dentro do bloco "Mês finalizado" de EmployeeHorasScreen.jsx,
// que o briefing exige em tons de cinza ("tela toda em tons de cinza").
// Em vez de cinzentar o componente para todo mundo (quebraria a vista
// normal), `muted` troca só a paleta das células por tons de
// cinza/ink — mantendo contraste AA (spec 1.7) — sem mudar `onSelectDay`
// nem a estrutura. Default `false`: comportamento/cores inalterados onde
// já era usado.
import { COLORS } from "../../../../styles/colors.js";

function cellStyle(state, muted) {
  if (muted) {
    switch (state) {
      case "registered":
        return { background: COLORS.line, color: COLORS.ink2, border: "none" };
      case "noAttendance":
        return { background: COLORS.lineSoft, color: COLORS.ink3, border: "none", textDecoration: "line-through" };
      case "missing":
        return { background: COLORS.lineSoft, color: COLORS.ink2, border: `1px dashed ${COLORS.ink3}` };
      case "noSchedule":
        return { background: "transparent", color: COLORS.ink3, border: `1px dashed ${COLORS.line}` };
      case "outside":
      default:
        return { background: "transparent", color: "transparent", border: "none", pointerEvents: "none" };
    }
  }
  switch (state) {
    case "registered":
      return { background: COLORS.okTint, color: COLORS.okInk, border: "none" };
    case "noAttendance":
      return { background: COLORS.lineSoft, color: COLORS.ink3, border: "none", textDecoration: "line-through" };
    case "missing":
      return { background: COLORS.alertTint, color: COLORS.alert, border: "none" };
    case "noSchedule":
      return { background: "transparent", color: COLORS.ink3, border: `1px dashed ${COLORS.line}` };
    case "outside":
    default:
      return { background: "transparent", color: "transparent", border: "none", pointerEvents: "none" };
  }
}

function PeriodCalendar({ weeks, dayHeaderLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"], onSelectDay, muted = false }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {dayHeaderLabels.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: COLORS.ink3, letterSpacing: "0.04em" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.map((day) => {
              const style = cellStyle(day.state, muted);
              const clickable = day.state !== "outside" && !!onSelectDay;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={clickable ? () => onSelectDay(day.key) : undefined}
                  disabled={!clickable}
                  style={{
                    width: "100%", aspectRatio: "1 / 1", maxWidth: 44, minWidth: 32, borderRadius: 10,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600, cursor: clickable ? "pointer" : "default",
                    fontFamily: "inherit", position: "relative", boxSizing: "border-box",
                    ...style,
                  }}
                >
                  <span>{day.dayNumber}</span>
                  {day.hoursLabel && day.state === "registered" && (
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{day.hoursLabel}</span>
                  )}
                  {day.isToday && (
                    <span style={{ position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: "50%", background: muted ? COLORS.ink3 : COLORS.clay }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export { PeriodCalendar };
