import { BE_PLACES } from "./bePlaces.js";

// Cidades da Bélgica: validação do campo "Cidade" dos clientes e desenho do
// mapa do Dashboard. A cidade guardada no cliente é sempre o nome canónico
// de uma destas localidades (ver `resolveCity`).

// Nomes alternativos (francês/neerlandês/inglês) -> nome canónico da lista.
const ALIASES = {
  brussels: "Bruxelles", brussel: "Bruxelles", "bruxelles capitale": "Bruxelles", "brussels capital": "Bruxelles",
  anvers: "Antwerpen", antwerp: "Antwerpen", gand: "Gent", ghent: "Gent", bruges: "Brugge", louvain: "Leuven",
  malines: "Mechelen", courtrai: "Kortrijk", ypres: "Ieper", luik: "Liège", liege: "Liège", namen: "Namur",
  bergen: "Mons", doornik: "Tournai", nijvel: "Nivelles", waver: "Wavre", hal: "Halle", lierre: "Lier",
  ostende: "Oostende", termonde: "Dendermonde", audenarde: "Oudenaarde", grammont: "Geraardsbergen",
  "sint genesius rode": "Rhode-Saint-Genèse", "ecaussinnes": "Écaussinnes", "court st etienne": "Court-Saint-Étienne",
  "louvain la neuve": "Louvain-la-Neuve", "la hulpe": "La Hulpe", terhulpen: "La Hulpe", eigenbrakel: "Braine-l'Alleud",
  "braine l alleud": "Braine-l'Alleud", "woluwe saint lambert": "Woluwe-Saint-Lambert", "woluwe saint pierre": "Woluwe-Saint-Pierre",
  "sint pieters woluwe": "Woluwe-Saint-Pierre", "sint lambrechts woluwe": "Woluwe-Saint-Lambert",
};

// Minúsculas, sem acentos, "-" "'" "." viram espaço, "st"/"ste" viram "saint"/"sainte".
export function normalizePlace(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[-'’.]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\bste\b/g, "sainte").replace(/\bst\b/g, "saint");
}

const PLACES = BE_PLACES.map(([name, lat, lon, region]) => ({ name, lat, lon, region, key: normalizePlace(name) }));
const BY_KEY = new Map(PLACES.map((p) => [p.key, p]));
const ALIAS_BY_KEY = new Map(Object.entries(ALIASES).map(([alias, canon]) => [normalizePlace(alias), canon]));

// Texto livre -> localidade canónica ({ name, lat, lon, region }) ou null.
export function resolveCity(text) {
  const key = normalizePlace(text);
  if (!key) return null;
  const direct = BY_KEY.get(key);
  if (direct) return direct;
  const canon = ALIAS_BY_KEY.get(key);
  return canon ? BY_KEY.get(normalizePlace(canon)) || null : null;
}

// Sugestões enquanto se escreve: começa por > palavra começa por > contém.
export function suggestCities(query, limit = 8) {
  const q = normalizePlace(query);
  if (!q) return [];
  const scored = [];
  PLACES.forEach((p) => {
    let rank = -1;
    if (p.key.startsWith(q)) rank = 0;
    else if (p.key.split(" ").some((w) => w.startsWith(q))) rank = 1;
    else if (p.key.includes(q)) rank = 2;
    if (rank >= 0) scored.push({ p, rank });
  });
  ALIAS_BY_KEY.forEach((canon, aliasKey) => {
    if (aliasKey.startsWith(q)) {
      const p = BY_KEY.get(normalizePlace(canon));
      if (p) scored.push({ p, rank: 0 });
    }
  });
  const seen = new Set();
  return scored
    .sort((a, b) => a.rank - b.rank || a.p.name.length - b.p.name.length || a.p.name.localeCompare(b.p.name))
    .filter(({ p }) => (seen.has(p.name) ? false : (seen.add(p.name), true)))
    .slice(0, limit)
    .map(({ p }) => p);
}

// Contorno simplificado da Bélgica ([lon, lat]) — é um desenho, não um mapa
// topográfico: serve para situar as bolhas das cidades.
export const BE_OUTLINE = [
  [2.55, 51.09], [3.1, 51.3], [3.37, 51.37], [3.58, 51.3], [3.9, 51.21], [4.2, 51.37], [4.4, 51.43],
  [4.78, 51.49], [5.05, 51.47], [5.2, 51.3], [5.48, 51.3], [5.6, 51.18], [5.85, 51.05], [5.7, 50.85],
  [5.95, 50.75], [6.02, 50.75], [6.17, 50.6], [6.28, 50.5], [6.38, 50.33], [6.25, 50.17], [6.13, 50.13],
  [6.1, 49.95], [5.95, 49.88], [5.85, 49.75], [5.82, 49.55], [5.5, 49.5], [5.3, 49.62], [5.0, 49.78],
  [4.85, 49.95], [4.85, 50.12], [4.65, 49.98], [4.42, 49.95], [4.2, 49.97], [4.12, 50.25], [3.95, 50.35],
  [3.65, 50.38], [3.6, 50.5], [3.3, 50.5], [3.15, 50.75], [2.85, 50.72], [2.6, 50.85],
];

// lat/lon -> coordenadas do desenho (viewBox 0 0 260 215).
export const MAP_VIEWBOX = "0 0 260 215";
export function projectPlace(lat, lon) {
  return { x: (lon - 2.4) * 63.6, y: (51.62 - lat) * 100 };
}
export function outlinePath() {
  return BE_OUTLINE.map(([lon, lat], i) => { const { x, y } = projectPlace(lat, lon); return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";
}
