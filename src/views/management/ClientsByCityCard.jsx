import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { FONT } from "../../styles/tokens.js";
import { resolveCity, outlinePath, projectPlace, MAP_VIEWBOX } from "../../models/cities.js";
import { Card } from "../shared/ui/index.js";

// Dashboard — "Clientes por cidade": mapa da Bélgica com uma bolha por cidade
// (maior = mais clientes) + ranking. Tocar numa cidade abre Clientes já
// filtrado por ela. No telemóvel só o ranking (as 5 maiores).
function ClientsByCityCard({ clients, t, mobile, onOpenCity, onOpenClients, style }) {
  const { rows, noCity, total } = useMemo(() => {
    const map = new Map();
    let missing = 0;
    clients.forEach((c) => {
      const place = resolveCity(c.city);
      if (!place) { missing += 1; return; }
      const cur = map.get(place.name) || { place, count: 0 };
      cur.count += 1; map.set(place.name, cur);
    });
    const list = [...map.values()].sort((a, b) => b.count - a.count || a.place.name.localeCompare(b.place.name));
    return { rows: list, noCity: missing, total: list.reduce((s, r) => s + r.count, 0) };
  }, [clients]);

  const max = rows.length ? rows[0].count : 1;
  const ranking = rows.slice(0, mobile ? 5 : 7);

  return (
    <Card style={{ ...style }} data-testid="clients-by-city">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{t.citiesTitle}</div>
        <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.citiesSubtitle(total, rows.length)}</div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 10 }}>{t.citiesEmpty}</div>
      ) : (
        <div style={{ display: "flex", gap: 22, marginTop: 14, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          {!mobile && (
            <svg viewBox={MAP_VIEWBOX} role="img" aria-label={t.citiesMapAria} style={{ flex: "1.2 1 230px", minWidth: 200, maxWidth: 320, height: "auto" }}>
              <path d={outlinePath()} fill={COLORS.forest50} stroke={COLORS.forest600} strokeWidth="1.4" strokeLinejoin="round" />
              {rows.slice().reverse().map(({ place, count }) => {
                const { x, y } = projectPlace(place.lat, place.lon);
                const r = 4 + 11 * Math.sqrt(count / max);
                const top = place.name === rows[0].place.name;
                return (
                  <g key={place.name} style={{ cursor: onOpenCity ? "pointer" : "default" }} onClick={() => onOpenCity && onOpenCity(place.name)}>
                    <title>{`${place.name}: ${count}`}</title>
                    <circle cx={x} cy={y} r={r} fill={top ? COLORS.clay : COLORS.forest600} fillOpacity="0.82" stroke="#fff" strokeWidth="1.2" />
                  </g>
                );
              })}
              {(() => {
                // Rótulos só para as cidades principais e sem sobrepor outro já escrito (o ranking ao lado cobre as restantes).
                const placed = [];
                return rows.slice(0, 5).map(({ place }) => {
                  const { x, y } = projectPlace(place.lat, place.lon);
                  if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 26)) return null;
                  placed.push({ x, y });
                  return <text key={place.name} x={x + 8} y={y - 8} fontSize="9" fontWeight="700" fill={COLORS.ink} stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{place.name}</text>;
                });
              })()}
            </svg>
          )}

          <div style={{ flex: "1 1 170px", minWidth: 150, display: "flex", flexDirection: "column", gap: 9 }}>
            {ranking.map(({ place, count }, i) => (
              <button
                key={place.name} type="button" onClick={() => onOpenCity && onOpenCity(place.name)}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", padding: 0, cursor: onOpenCity ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ width: 14, fontSize: 11.5, fontWeight: 700, color: COLORS.ink3 }}>{i + 1}</span>
                <span style={{ width: 76, fontSize: 13, color: COLORS.ink, fontWeight: i === 0 ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: COLORS.lineSoft, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.max(6, (count / max) * 100)}%`, borderRadius: 4, background: i === 0 ? COLORS.clay : COLORS.forest600 }} />
                </span>
                <span style={{ width: 24, textAlign: "right", fontFamily: FONT.heading, fontWeight: 600, fontSize: 13.5, color: COLORS.ink }}>{count}</span>
              </button>
            ))}
            {rows.length > ranking.length && (
              <div style={{ fontSize: 12, color: COLORS.ink3, paddingLeft: 24 }}>{t.citiesMore(rows.length - ranking.length)}</div>
            )}
          </div>
        </div>
      )}

      {noCity > 0 && (
        <button
          type="button" onClick={onOpenClients}
          style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 14, border: "none", background: COLORS.amberBg, color: COLORS.amberInk,
            borderRadius: 10, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >
          <AlertTriangle size={14} /> {t.citiesNoCity(noCity)}
        </button>
      )}
    </Card>
  );
}

export default ClientsByCityCard;
