// Avatar (documento de design, 2.4): círculo com iniciais (2 letras), cor
// determinística a partir do nome, ciclando por 6 pares fundo/texto.
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs
// redesenhados na Etapa 4. Única exceção que continua com o `styles.avatar`
// antigo (1 letra, cor fixa): o bloco de marca da própria `Sidebar` da
// gerência em Layout.jsx, que fica fora do escopo até essa sidebar ser
// substituída pela `AppSidebar` (ver nota em AppSidebar.jsx) — comentário
// antigo corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento.
import { COLORS } from "../../../styles/colors.js";

// Mesmos 6 pares do documento, na ordem em que aparecem lá.
const AVATAR_PAIRS = [
  { bg: COLORS.forest100, ink: COLORS.forest800 },
  { bg: COLORS.clayTint, ink: COLORS.clayInk },
  { bg: COLORS.steelBg, ink: COLORS.steelInk },
  { bg: COLORS.okTint, ink: COLORS.okInk },
  { bg: COLORS.amberBg, ink: COLORS.amberInk },
  { bg: COLORS.forest50, ink: COLORS.ink2 },
];

// "Maria Silva" -> "MS" · "Ana" -> "AN" (nome com uma palavra só usa as
// duas primeiras letras) · ignora espaços extra.
function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Hash simples e estável (mesmo nome -> sempre o mesmo par de cores,
// mesmo entre sessões/idiomas, já que só depende da string do nome).
function hashName(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorsForName(name) {
  return AVATAR_PAIRS[hashName(name) % AVATAR_PAIRS.length];
}

// size: 36 (tabelas, por defeito) · 28 (empilhado) · 24 (dentro de pílulas).
function Avatar({ name, photoUrl, size = 36 }) {
  const { bg, ink } = colorsForName(name);
  const fontSize = size <= 24 ? 10 : size <= 28 ? 11 : 13;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: bg, color: ink, fontWeight: 700, fontSize,
        overflow: "hidden", fontFamily: "inherit",
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

export { Avatar, getInitials, colorsForName };
