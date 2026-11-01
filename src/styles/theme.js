// Cor da empresa (redesign B1). A cor escolhida pela empresa é o ACENTO do app
// (menu, botão principal, progresso, "hoje", seleção); tudo o resto é neutro.
// Cada tema tem --p1 (principal) e --p2 (mais escura). Os tons claros derivados
// (--p1-8, --p1-12, ...) são calculados aqui em JS e postos como variáveis CSS no
// :root — assim não dependemos de color-mix() (telemóveis mais antigos).
//
// As cores com significado (atenção, urgente, ok, informação, reaberto) são fixas
// e NÃO mudam com o tema (ver colors.js).

export const THEMES = [
  { key: "verde", p1: "#1E8C5A", p2: "#166B45", label: { pt: "Verde", en: "Green", fr: "Vert" } },
  { key: "ciano", p1: "#0A87A6", p2: "#076A83", label: { pt: "Ciano", en: "Cyan", fr: "Cyan" } },
  { key: "indigo", p1: "#3644C9", p2: "#2733A3", label: { pt: "Índigo", en: "Indigo", fr: "Indigo" } },
  { key: "violeta", p1: "#8A35D6", p2: "#6C25AD", label: { pt: "Violeta", en: "Violet", fr: "Violet" } },
  { key: "fucsia", p1: "#BE2A80", p2: "#981F65", label: { pt: "Fúcsia", en: "Fuchsia", fr: "Fuchsia" } },
  { key: "lima", p1: "#6A8A0C", p2: "#526B08", label: { pt: "Lima", en: "Lime", fr: "Citron vert" } },
];
export const DEFAULT_THEME = "verde";

export function themeByKey(key) {
  return THEMES.find((t) => t.key === key) || THEMES[0];
}

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function toHex(rgb) {
  return "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
// Mistura `hex` com branco (pct = quanto da cor fica, 0–100).
export function tint(hex, pct) {
  const c = hexToRgb(hex);
  return toHex(c.map((v) => 255 + (v - 255) * (pct / 100)));
}
// Mistura com preto.
export function shade(hex, pct) {
  const c = hexToRgb(hex);
  return toHex(c.map((v) => v * (pct / 100)));
}
export function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Todas as variáveis de um tema.
export function themeVars(key) {
  const t = themeByKey(key);
  return {
    "--p1": t.p1,
    "--p2": t.p2,
    "--p3": shade(t.p2, 72),
    "--p1-90": tint(t.p1, 88),
    "--p1-60": tint(t.p1, 60),
    "--p1-35": tint(t.p1, 35),
    "--p1-20": tint(t.p1, 20),
    "--p1-12": tint(t.p1, 12),
    "--p1-8": tint(t.p1, 8),
    "--p1-4": tint(t.p1, 4),
    "--p1-shadow": withAlpha(t.p1, 0.28),
  };
}

const STORE_KEY = "servix.theme";

export function applyTheme(key) {
  const k = themeByKey(key).key;
  const vars = themeVars(k);
  try {
    const root = document.documentElement;
    Object.entries(vars).forEach(([n, v]) => root.style.setProperty(n, v));
    root.dataset.theme = k;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", vars["--p1"]);
  } catch { /* sem DOM (testes) */ }
  try { localStorage.setItem(STORE_KEY, k); } catch { /* armazenamento bloqueado */ }
  return k;
}

// No arranque: o último tema usado neste aparelho (o da empresa chega depois).
export function applyStoredTheme() {
  let k = DEFAULT_THEME;
  try { k = localStorage.getItem(STORE_KEY) || DEFAULT_THEME; } catch { /* ignora */ }
  return applyTheme(k);
}
