// Barra segmentada (documento de design, 4.1 "A pagar no período" e 4.4
// "A pagar no período"): uma barra só, dividida proporcionalmente em N
// segmentos coloridos (ex.: pagos / por pagar / pendentes), sempre
// acompanhada de uma legenda por fora ("3 pagos · 2 por pagar · 8
// pendentes") — este componente só desenha a barra, a legenda é texto
// livre de quem usa (os rótulos mudam por ecrã/idioma).
//
// Componente NOVO (Etapa 4c), pensado para ser o mesmo em qualquer cartão
// "herói" (Horas agora; Dashboard mais tarde, 4.1, que pede explicitamente
// "barra segmentada (igual ao Dashboard)" — ainda por redesenhar).
import { COLORS } from "../../../styles/colors.js";

// segments: [{ value, color }] — segmentos com value<=0 não desenham nada
// (evita uma tira de largura 0 com borda visível).
function SegmentedBar({ segments, height = 10, onHero, style }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value || 0), 0);
  return (
    <div
      style={{
        display: "flex", height, borderRadius: height / 2, overflow: "hidden",
        background: onHero ? "rgba(255,255,255,.18)" : COLORS.segmentBg,
        ...style,
      }}
    >
      {total > 0 && segments.map((seg, i) => (
        seg.value > 0 && (
          <div key={i} style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }} />
        )
      ))}
    </div>
  );
}

export { SegmentedBar };
