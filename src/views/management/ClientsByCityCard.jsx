import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { FONT } from "../../styles/tokens.js";
import { resolveCity } from "../../models/cities.js";
import { Card } from "../shared/ui/index.js";

// Dashboard — "Clientes por cidade": mapa aproximado da região onde há clientes
// (municípios com fronteiras, os que têm clientes pintados e uma bolha por
// cidade) + ranking. Tocar numa cidade abre Clientes já filtrado por ela.
// Os limites vêm de um módulo grande carregado só quando o cartão aparece.

const ASPECT = 0.72; // altura / largura do mapa

// Escala "redonda" (km) que ocupa ~90 px.
function niceKm(kmPerPx) {
  const target = 90 * kmPerPx;
  const steps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  let best = steps[0];
  steps.forEach((s) => { if (Math.abs(s - target) < Math.abs(best - target)) best = s; });
  return best;
}

function RegionMap({ geo, rows, max, view, widthPx, t, onOpenCity }) {
  const { u, lon0, lat0, kx, ky, muni, prov, placeMuni } = geo;
  const k = view.w / widthPx; // unidades por pixel
  const wide = view.w > 120 * u; // vista do país: fronteiras mais finas
  const px = (n) => n * k;

  const pts = rows.map((r) => ({ ...r, x: (r.place.lon - lon0) * kx * u, y: (lat0 - r.place.lat) * ky * u, mi: placeMuni[r.place.name] }));
  const countByMuni = new Map();
  pts.forEach((p) => { if (p.mi != null) countByMuni.set(p.mi, (countByMuni.get(p.mi) || 0) + p.count); });

  const m = view.w * 0.1;
  const vis = (b) => !(b[6] < view.x - m || b[4] > view.x + view.w + m || b[7] < view.y - m || b[5] > view.y + view.h + m);
  const visible = muni.map((mu, i) => ({ mu, i })).filter(({ mu }) => vis(mu));

  // Rótulos: primeiro as cidades com clientes, depois os municípios maiores; sem sobreposição.
  const boxes = [];
  const free = (x, y, w, h) => !boxes.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
  const take = (x, y, w, h) => { boxes.push({ x, y, w, h }); };
  const inView = (x, y, w, h) => x > view.x && y > view.y && x + w < view.x + view.w && y + h < view.y + view.h;
  const bubbleLabels = [];
  pts.forEach((p) => {
    const r = px(5 + 8 * Math.sqrt(p.count / max));
    take(p.x - r, p.y - r, r * 2, r * 2);
  });
  pts.forEach((p) => {
    const r = px(5 + 8 * Math.sqrt(p.count / max));
    const w = px(p.place.name.length * 6.4 + 4), h = px(13);
    const spots = [[p.x + r + px(3), p.y - h / 2], [p.x - r - px(3) - w, p.y - h / 2], [p.x - w / 2, p.y - r - h - px(1)], [p.x - w / 2, p.y + r + px(1)]];
    for (const [lx, ly] of spots) {
      if (inView(lx, ly, w, h) && free(lx, ly, w, h)) { take(lx, ly, w, h); bubbleLabels.push({ p, lx, ly, h, anchor: "start" }); break; }
    }
  });
  const muniLabels = [];
  visible
    .map(({ mu, i }) => ({ mu, i, size: (mu[6] - mu[4]) * (mu[7] - mu[5]) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 60)
    .forEach(({ mu, i }) => {
      const name = mu[0];
      const w = px(name.length * 5.2 + 2), h = px(11);
      const x = mu[2] - w / 2, y = mu[3] - h / 2;
      if (px(name.length * 5.2) > (mu[6] - mu[4]) * 1.25) return; // não cabe dentro do município
      if (!inView(x, y, w, h) || !free(x, y, w, h)) return;
      take(x, y, w, h); muniLabels.push({ name, x: mu[2], y: mu[3] + px(3.5), i });
    });

  const km = niceKm(k / u); // km por pixel = k / u
  const barUnits = km * u;

  return (
    <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label={t.citiesMapAria} style={{ width: "100%", height: "auto", display: "block", background: "#F4F8F6", borderRadius: 12 }}>
      <g>
        {visible.map(({ mu, i }) => {
          const n = countByMuni.get(i) || 0;
          const fill = n ? (n / max > 0.6 ? COLORS.forest200 : COLORS.forest100) : "#fff";
          return <path key={i} d={mu[1]} fill={fill} stroke={COLORS.forest200} strokeWidth={wide ? 0.45 : 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
        })}
        {prov.map((pv, i) => <path key={`p${i}`} d={pv[1]} fill="none" stroke={COLORS.forest500} strokeOpacity="0.6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
      </g>
      <g style={{ pointerEvents: "none" }}>
        {muniLabels.map((l) => (
          <text key={l.i} x={l.x} y={l.y} textAnchor="middle" fontSize={px(9.5)} fill={COLORS.ink3} stroke="#fff" strokeWidth={px(2.2)} strokeOpacity="0.85" paintOrder="stroke" strokeLinejoin="round">{l.name}</text>
        ))}
      </g>
      {pts.slice().reverse().map((p) => {
        const r = px(5 + 8 * Math.sqrt(p.count / max));
        const top = p.place.name === rows[0].place.name;
        return (
          <g key={p.place.name} style={{ cursor: onOpenCity ? "pointer" : "default" }} onClick={() => onOpenCity && onOpenCity(p.place.name)}>
            <title>{`${p.place.name}: ${p.count}`}</title>
            <circle cx={p.x} cy={p.y} r={r} fill={top ? COLORS.clay : COLORS.forest600} fillOpacity="0.88" stroke="#fff" strokeWidth={px(1.6)} />
            {p.count > 1 && r > px(8) && <text x={p.x} y={p.y + px(3.6)} textAnchor="middle" fontSize={px(10.5)} fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{p.count}</text>}
          </g>
        );
      })}
      <g style={{ pointerEvents: "none" }}>
        {bubbleLabels.map(({ p, lx, ly, h }) => (
          <text key={p.place.name} x={lx} y={ly + h * 0.78} fontSize={px(11.5)} fontWeight="700" fill={COLORS.ink} stroke="#fff" strokeWidth={px(3)} paintOrder="stroke" strokeLinejoin="round">{p.place.name}</text>
        ))}
      </g>
      <g style={{ pointerEvents: "none" }} transform={`translate(${view.x + px(12)} ${view.y + view.h - px(14)})`}>
        <path d={`M0 ${-px(4)} V0 H${barUnits} V${-px(4)}`} fill="none" stroke={COLORS.ink2} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <text x={barUnits / 2} y={-px(6)} textAnchor="middle" fontSize={px(10)} fontWeight="600" fill={COLORS.ink2} stroke="#fff" strokeWidth={px(2.4)} paintOrder="stroke">{km} km</text>
      </g>
    </svg>
  );
}

function ClientsByCityCard({ clients, t, mobile, wide, onOpenCity, onOpenClients, style }) {
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

  // Limites dos municípios: carregados à parte, só quando há algo para mostrar.
  const [geo, setGeo] = useState(null);
  const [geoFailed, setGeoFailed] = useState(false);
  useEffect(() => {
    if (!rows.length || geo) return undefined;
    let alive = true;
    import("../../models/beMapData.js").then((m) => { if (alive) setGeo(m.default); }).catch(() => { if (alive) setGeoFailed(true); });
    return () => { alive = false; };
  }, [rows.length, geo]);

  const [scope, setScope] = useState("region");
  const boxRef = useRef(null);
  const [widthPx, setWidthPx] = useState(480);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setWidthPx(Math.max(200, el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo, rows.length]);

  const view = useMemo(() => {
    if (!geo || !rows.length) return null;
    const { u, lon0, lat0, kx, ky, muni } = geo;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    if (scope === "country") {
      muni.forEach((mu) => { minx = Math.min(minx, mu[4]); miny = Math.min(miny, mu[5]); maxx = Math.max(maxx, mu[6]); maxy = Math.max(maxy, mu[7]); });
    } else {
      rows.forEach(({ place }) => {
        const x = (place.lon - lon0) * kx * u, y = (lat0 - place.lat) * ky * u;
        minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      });
    }
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const pad = scope === "country" ? 1.04 : 1.8;
    let w = Math.max((maxx - minx) * pad, ((maxy - miny) * pad) / ASPECT, scope === "country" ? 0 : 26 * u);
    if (scope === "country") w = Math.max(w, ((maxy - miny) * pad) / ASPECT);
    const h = w * ASPECT;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [geo, rows, scope]);

  const max = rows.length ? rows[0].count : 1;
  const ranking = rows.slice(0, mobile ? 5 : 7);
  const tab = (id, label) => (
    <button
      key={id} type="button" onClick={() => setScope(id)} aria-pressed={scope === id}
      style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: scope === id ? COLORS.forest600 : "transparent", color: scope === id ? "#fff" : COLORS.ink2 }}
    >{label}</button>
  );

  return (
    <Card style={{ ...style }} data-testid="clients-by-city">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{t.citiesTitle}</div>
        <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.citiesSubtitle(total, rows.length)}</div>
      </div>
      {geo && rows.length > 0 && (
        <div style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 999, background: COLORS.lineSoft, marginTop: 8 }}>
          {tab("region", t.citiesRegion)}{tab("country", t.citiesCountry)}
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 10 }}>{t.citiesEmpty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", gap: wide ? 24 : 14, marginTop: 12 }}>
          {!geoFailed && (
            <div style={wide ? { flex: "1.25 1 0", minWidth: 0 } : undefined}>
              <div ref={boxRef} style={{ position: "relative", minHeight: geo ? 0 : 160 }}>
                {geo && view ? (
                  <RegionMap geo={geo} rows={rows} max={max} view={view} widthPx={widthPx} t={t} onOpenCity={onOpenCity} />
                ) : (
                  <div style={{ height: 200, borderRadius: 12, background: COLORS.lineSoft }} />
                )}
              </div>
              {geo && <div style={{ fontSize: 10.5, color: COLORS.ink3, marginTop: 4 }}>{t.citiesMapCredit}</div>}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 9, ...(wide ? { flex: "1 1 0", minWidth: 0 } : null) }}>
            {ranking.map(({ place, count }, i) => (
              <button
                key={place.name} type="button" onClick={() => onOpenCity && onOpenCity(place.name)}
                style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", padding: 0, cursor: onOpenCity ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ width: 14, fontSize: 11.5, fontWeight: 700, color: COLORS.ink3 }}>{i + 1}</span>
                <span style={{ width: 96, fontSize: 13, color: COLORS.ink, fontWeight: i === 0 ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</span>
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
