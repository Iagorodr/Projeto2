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
const COLORS = {
  bg: "#F3F6F4", surface: "#FFFFFF", primary: "#1F6F5C", primaryDark: "#143F35", primaryTint: "#E5F1EC",
  extra: "#B3492E", extraTint: "#FBEBE6", success: "#2F9E64", successTint: "#E4F3EA",
  accent: "#E28A65", accentTint: "#FBEADF",
  text: "#16211D", textSoft: "#5B6961", border: "#E1E8E3", sidebarBg: "#EDF2EF",

  // --- Tokens do documento de design, secção 1.1 (novos, aditivos) ---
  page: "#F3F6F4", card: "#FFFFFF",
  line: "#E3EAE6", lineSoft: "#EEF3F0", lineInput: "#D5E0DA",
  forest900: "#0F3129", forest800: "#143F35", forest700: "#185A4A",
  forest600: "#1F6F5C", forest500: "#2E8570",
  forest200: "#B5D5C9", forest100: "#D8E9E2", forest50: "#EDF4F1",
  clay: "#E28A65", clayInk: "#9A4A26", clayTint: "#FBE9DF",
  alert: "#B3492E", alertTint: "#FBE4DC",
  ok: "#2F9E64", okInk: "#14684A", okTint: "#DDF1E6",
  amberBg: "#FCF3DF", amberInk: "#8A5A0B",
  ink: "#1A2B26", ink2: "#4F635C", ink3: "#66786F",
  headerTint: "#F6F9F7", segmentBg: "#E4ECE8",

  // Par "aço/ardósia" usado na pílula de Supervisor (2.3) e no ciclo de
  // cores do Avatar (2.4) — aparece nas duas secções de Componentes mas
  // não tem nome na tabela de cores 1.1, por isso ganha um aqui (Etapa 2).
  steelBg: "#E4EDF1", steelInk: "#3F5A66",
};

export { COLORS };
