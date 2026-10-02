// Barra de progresso (documento de design, 2.12): altura 8-10, raio 5,
// fundo #E4ECE8 (segment-bg), preenchimento forest-600 (ou branco sobre
// cartão herói). Sempre acompanhada do número ao lado — este componente
// não escreve esse texto sozinho porque o formato varia por contexto
// ("28h de 32h30", "12 de 20 clientes"...); quem usa passa `label` já
// formatado (com fmtHoursScreen ou o que fizer sentido no ecrã).
//
// Introduzido na Etapa 2 (componentes); já ligado a Clientes (gerência e
// funcionário) e Horas do funcionário desde a Etapa 4 — comentário antigo
// corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento.
import { COLORS } from "../../../styles/colors.js";

function ProgressBar({ value, max, label, onHero, height = 9, style }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      <div
        style={{
          flex: 1, height, borderRadius: height / 2,
          background: onHero ? "rgba(255,255,255,.25)" : COLORS.segmentBg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`, height: "100%", borderRadius: height / 2,
            background: onHero ? "#fff" : COLORS.forest600,
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: onHero ? "#fff" : COLORS.ink2, whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
    </div>
  );
}

export { ProgressBar };
