// Paleta de cores compartilhada por toda a interface.
//
// As chaves originais (bg, surface, primary, extra, success, accent, text,
// textSoft, border, sidebarBg...) continuam tal como estavam — nada foi
// renomeado nem removido, para não arriscar quebrar nenhum ecrã que já as
// usa. Etapa 1 (fundação) do documento de design só ADICIONA os tokens
// novos da secção 1.1 (nomes em camelCase a partir dos nomes sugeridos no
// documento, ex.: "forest-600" -> forest600). Onde um token novo tem o
// mesmo valor de um antigo (ex.: forest600 === primary), o valor foi
// mantido igual nos dois de propósito — são o mesmo tom. Onde os valores
// divergem um pouco (ex.: alertTint vs extraTint), o valor do documento é
// o que conta a partir de agora; a troca de uso nos componentes/ecrãs fica
// para as Etapas 2-4, não aqui.
// Redesign B1 (2026-11): neutros novos + o ACENTO vem da cor da empresa
// (variáveis CSS --p1/--p2 e tons claros, ver styles/theme.js). Todas as chaves
// antigas continuam a existir (nenhum ecrã partiu); só mudaram de valor. As cores
// com significado (atenção, urgente, ok, informação, reaberto) são fixas.
const P1 = "var(--p1)", P2 = "var(--p2)", P3 = "var(--p3)";
const COLORS = {
  bg: "#ECEEE9", surface: "#FFFFFF", primary: P1, primaryDark: P2, primaryTint: "var(--p1-12)",
  extra: "#D6454A", extraTint: "#FCE5E5", success: "#167049", successTint: "#E3F4EA",
  accent: "#C98A12", accentTint: "#FBF0D9",
  text: "#151816", textSoft: "#5A625C", border: "#E2E5DF", sidebarBg: "#EEF0EC",

  page: "#ECEEE9", card: "#FFFFFF",
  line: "#E2E5DF", lineSoft: "#EEF0EC", lineInput: "#D3D8D1",
  forest900: P3, forest800: P2, forest700: P2,
  forest600: P1, forest500: "var(--p1-90)",
  forest200: "var(--p1-35)", forest100: "var(--p1-20)", forest50: "var(--p1-8)",
  // "clay" era o laranja de destaque; no B1 passa a ser a cor de ATENÇÃO (fixa).
  clay: "#C98A12", clayInk: "#8A5A0B", clayTint: "#FBF0D9",
  alert: "#D6454A", alertTint: "#FCE5E5",
  ok: "#167049", okInk: "#167049", okTint: "#E3F4EA",
  amberBg: "#FBF0D9", amberInk: "#8A5A0B", amber: "#C98A12",
  ink: "#151816", ink2: "#5A625C", ink3: "#6F776F",
  headerTint: "#F5F6F3", segmentBg: "#E6E9E3",

  steelBg: "#EEF0EC", steelInk: "#5A625C",
  // Informação / neutro e Reaberto (fixas).
  info: "#5A625C", infoBg: "#EEF0EC", reopened: "#6B44B8", reopenedBg: "#EEE9FA",
  // Botão escuro: confirmar ações sensíveis.
  dark: "#151816",

  vivo: P1, vivoLight: "var(--p1-90)", vivoInk: P2,
  vivoBtnTop: P1, vivoBtnBottom: P1, vivoToggleOn: P1,
  mint: "var(--p1-20)", mintBg: "var(--p1-8)", iconBorder: "var(--p1-35)", fieldBorder: "#8A918C",
  disabledBg: "#E3E6E0", disabledInk: "#6F776F",
  navDeep: P2,
  navGradient: P1, navText: "#FFFFFF", navIcon: "rgba(255,255,255,.82)", navIconActive: "#FFFFFF", navBottomText: "#FFFFFF",
  dangerInk: "#B8343A", dangerBg: "#FCE5E5", dangerSolid: "#D6454A",
  rowIconBg: "#FBF0D9", rowIconInk: "#8A5A0B", onClay: "#FFFFFF",
};

export { COLORS };
