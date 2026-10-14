// Ligações para abrir o endereço de um cliente num aplicativo de mapas.
//
// Uma página web não consegue saber que mapas estão instalados no telemóvel,
// por isso usamos ligações universais (abrem o aplicativo se estiver
// instalado, senão o site):
//  * Mapas da Apple  — maps.apple.com
//  * Google Maps     — google.com/maps
//  * Waze            — waze.com/ul
// e, no Android, a ligação `geo:` abre o seletor do próprio sistema com TODOS
// os aplicativos de mapas instalados ("Outro aplicativo…").

function detectPlatform(nav) {
  const n = nav || (typeof navigator !== "undefined" ? navigator : null);
  if (!n) return "desktop";
  const ua = n.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ apresenta-se como um Mac com ecrã tátil.
  if ((n.platform === "MacIntel" || /Macintosh/.test(ua)) && (n.maxTouchPoints || 0) > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

// Texto a procurar: morada + cidade (a cidade vive num campo à parte e ajuda
// o mapa a acertar), sem repetir a cidade se já estiver na morada.
function placeQuery(client) {
  const address = ((client && client.address) || "").trim();
  const city = ((client && client.city) || "").trim();
  if (!address) return "";
  if (city && !address.toLowerCase().includes(city.toLowerCase())) return `${address}, ${city}`;
  return address;
}

// Opções por plataforma, na ordem em que aparecem. `labelKey` é uma chave do
// grupo `common` das traduções. `external: false` = abre pelo sistema (geo:).
function mapOptions(query, platform) {
  const q = encodeURIComponent(query);
  const apple = { key: "apple", labelKey: "mapAppleMaps", href: `https://maps.apple.com/?q=${q}` };
  const google = { key: "google", labelKey: "mapGoogleMaps", href: `https://www.google.com/maps/search/?api=1&query=${q}` };
  const waze = { key: "waze", labelKey: "mapWaze", href: `https://waze.com/ul?q=${q}&navigate=yes` };
  const other = { key: "other", labelKey: "mapOtherApp", href: `geo:0,0?q=${q}`, external: false };
  if (platform === "ios") return [apple, google, waze];
  if (platform === "android") return [google, waze, other];
  return [google, apple, waze];
}

export { detectPlatform, placeQuery, mapOptions };
