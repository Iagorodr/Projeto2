// Ajudantes de geometria/escala partilhados pelos gráficos novos da
// secção 2.14. Na origem, não reaproveitava os equivalentes privados de
// `DashboardWidgets.jsx` (niceCeiling, roundedTopBarPath) porque não
// eram exportados de lá — em vez de expor internals de um ficheiro de
// ecrã só para isto, replicou-se o essencial aqui (poucas linhas).
// `DashboardWidgets.jsx` foi removido do projeto na limpeza pós-Etapa 4.

// Escolhe um "topo" arredondado (1 / 1.2 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 /
// 8 / 10 × 10ⁿ) pra grade do eixo Y ficar em números limpos.
function niceCeiling(max) {
  if (max <= 0) return 1;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  for (const s of steps) {
    const candidate = s * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

// Caminho SVG de uma barra com cantos arredondados só em cima.
function roundedTopBarPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, Math.max(h, 0));
  if (h <= 0) return "";
  return `M ${x} ${y + h} L ${x} ${y + rad} Q ${x} ${y} ${x + rad} ${y} L ${x + w - rad} ${y} Q ${x + w} ${y} ${x + w} ${y + rad} L ${x + w} ${y + h} Z`;
}

export { niceCeiling, roundedTopBarPath };
