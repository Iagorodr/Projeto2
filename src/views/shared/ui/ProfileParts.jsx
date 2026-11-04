// Peças partilhadas das fichas laterais de Clientes e Funcionários (redesign
// B1, documento p. 28 e resposta 3 às dúvidas do Toni): "o mesmo componente
// de gaveta — espaçamentos, cabeçalho, rodapé com Editar; só o conteúdo muda".
//
//  • ProfileSection — título de secção + conteúdo, com o mesmo ritmo nos dois ecrãs.
//  • MiniPlaceMap   — mapa pequeno da localidade (municípios reais, carregados à
//                     parte como no Dashboard) com o pin na cor do tema.
//  • DocSlot        — documento com estado: verde quando existe, tracejado quando
//                     falta, âmbar a expirar, vermelho expirado.
//  • Fab            — botão flutuante "+" do telemóvel (acima da barra de baixo).
import { useEffect, useMemo, useState } from "react";
import { MapPin, Check, AlertTriangle, FileX } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, FONT } from "../../../styles/tokens.js";
import { resolveCity } from "../../../models/cities.js";

function ProfileSection({ title, aside, first, children }) {
  return (
    <section style={{ marginTop: first ? 0 : 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Os limites dos municípios (~200 kB) só carregam quando a primeira ficha os
// pede; a promessa fica em cache para todas as fichas seguintes.
let geoPromise = null;
function loadGeo() {
  if (!geoPromise) geoPromise = import("../../../models/beMapData.js").then((m) => m.default).catch((e) => { geoPromise = null; throw e; });
  return geoPromise;
}

function MiniPlaceMap({ city, height = 132, ariaLabel }) {
  const place = useMemo(() => resolveCity(city), [city]);
  const [geo, setGeo] = useState(null);
  useEffect(() => {
    if (!place) return undefined;
    let alive = true;
    loadGeo().then((g) => { if (alive) setGeo(g); }).catch(() => {});
    return () => { alive = false; };
  }, [place]);

  const frame = { position: "relative", height, borderRadius: 14, overflow: "hidden", background: "#F4F6F2", border: `1px solid ${COLORS.lineSoft}` };

  if (!place || !geo) {
    return (
      <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "radial-gradient(#DDE2DA 1px, transparent 1px)", backgroundSize: "12px 12px" }} aria-hidden={!place}>
        <MapPin size={22} color={place ? COLORS.primary : COLORS.ink3} strokeWidth={2} />
      </div>
    );
  }

  const { u, lon0, lat0, kx, ky, muni, placeMuni } = geo;
  const x = (place.lon - lon0) * kx * u;
  const y = (lat0 - place.lat) * ky * u;
  const mi = placeMuni[place.name];
  // Janela de ~16 km de largura centrada na localidade.
  const w = 16 * u; // `u` = unidades por km no beMapData
  const h = w * (height / 300);
  const view = { x: x - w / 2, y: y - h / 2, w, h };
  const vis = (b) => !(b[6] < view.x || b[4] > view.x + view.w || b[7] < view.y || b[5] > view.y + view.h);

  return (
    <div style={frame}>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={ariaLabel || place.name} style={{ width: "100%", height: "100%", display: "block" }}>
        {muni.map((m, i) => (vis(m) ? (
          <path key={i} d={m[1]} fill={i === mi ? "var(--p1-12)" : "#fff"} stroke={i === mi ? "var(--p1-60)" : "#D9DED6"} strokeWidth={i === mi ? 1.4 : 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ) : null))}
      </svg>
      {/* Pin em HTML (fica sempre do mesmo tamanho, seja qual for o zoom do SVG). */}
      <div className="b1-pin-drop" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -100%)", pointerEvents: "none" }}>
        <svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
          <path d="M14 35s12-11.6 12-21A12 12 0 0 0 2 14c0 9.4 12 21 12 21Z" fill="var(--p1)" stroke="#fff" strokeWidth="2" />
          <circle cx="14" cy="14" r="4.5" fill="#fff" />
        </svg>
      </div>
      <span style={{ position: "absolute", left: 10, bottom: 8, fontSize: 11.5, fontWeight: 700, color: COLORS.ink, background: "rgba(255,255,255,.88)", padding: "3px 8px", borderRadius: 999 }}>{place.name}</span>
    </div>
  );
}

// Estado do documento a partir da validade (YYYY-MM-DD, inclusiva).
function docState(doc, today, soonDays = 30) {
  if (!doc) return "missing";
  if (!doc.validUntil) return "ok";
  const [y, m, d] = doc.validUntil.split("-").map(Number);
  const days = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  if (days < 0) return "expired";
  if (days <= soonDays) return "soon";
  return "ok";
}

const DOC_TONE = {
  ok: { border: `1px solid #BFE3CD`, bg: COLORS.okTint, ink: COLORS.okInk, Icon: Check },
  soon: { border: `1px solid #EBD3A0`, bg: COLORS.amberBg, ink: COLORS.amberInk, Icon: AlertTriangle },
  expired: { border: `1px solid #F1C2C4`, bg: COLORS.dangerBg, ink: COLORS.dangerInk, Icon: AlertTriangle },
  missing: { border: `1.5px dashed ${COLORS.lineInput}`, bg: COLORS.card, ink: COLORS.ink3, Icon: FileX },
};

function DocSlot({ label, state = "missing", statusLabel, children }) {
  const tone = DOC_TONE[state] || DOC_TONE.missing;
  const { Icon } = tone;
  return (
    <div style={{ border: tone.border, background: state === "missing" ? tone.bg : "#fff", borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink, lineHeight: 1.3, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: tone.ink, background: state === "missing" ? COLORS.lineSoft : tone.bg, padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
          <Icon size={12} strokeWidth={2.4} />{statusLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

function Fab({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label} className="b1-pop"
      style={{
        position: "fixed", right: 18, bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)", zIndex: 35,
        width: 58, height: 58, borderRadius: 20, border: "none", cursor: "pointer",
        background: "var(--p1)", color: "#fff", boxShadow: "0 10px 24px var(--p1-shadow, rgba(0,0,0,.2))",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon size={24} strokeWidth={2.4} />
    </button>
  );
}

// Faixa de identidade no topo da ficha (avatar/ícone + linhas + selos).
function ProfileHero({ media, title, subtitle, badges, children }) {
  return (
    <div style={{ borderRadius: RADIUS.card, background: COLORS.bg, padding: 14, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {media}
        <div style={{ minWidth: 0, flex: 1 }}>
          {title && <div style={{ fontFamily: FONT.heading, fontSize: 18, lineHeight: 1.15, color: COLORS.ink, overflowWrap: "anywhere" }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 3 }}>{subtitle}</div>}
          {badges && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{badges}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Selo branco para o topo da ficha (o fundo do topo é cinzento, por isso as
// pílulas neutras desapareciam). Com `color`, leva o ponto do contratante.
function HeroChip({ color, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: COLORS.ink, background: "#fff", border: `1px solid ${COLORS.line}`, padding: color ? "3px 10px 3px 8px" : "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {color && <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }} />}
      {children}
    </span>
  );
}
function ContractorBadge({ name, color }) {
  if (!name) return null;
  return <HeroChip color={color || COLORS.ink3}>{name}</HeroChip>;
}

export { ProfileSection, MiniPlaceMap, DocSlot, docState, Fab, ProfileHero, ContractorBadge, HeroChip };
