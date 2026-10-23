// Pequenas peças partilhadas pelo bloco Financeiro (Dashboard) e pelos Contratantes.
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { monthAbbr } from "../../../models/utils.js";
import { FIN } from "../../../models/i18nFin.js";

// € com espaço nos milhares e sem cêntimos (os cartões são resumos; o valor exato está nos detalhes).
export function eur0(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return `€ ${r < 0 ? "-" : ""}${Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

export function fmtDay(d, lang) {
  return `${d.getDate()} ${monthAbbr(lang, d.getMonth())}`;
}

export function Dot({ color, size = 10 }) {
  return <span style={{ width: size, height: size, borderRadius: 99, background: color, display: "inline-block", flexShrink: 0 }} />;
}

// "em 6 dias" / "hoje" / "há 3 dias". `next` = é a próxima ação (clay); o resto fica discreto.
export function DateChip({ days, next, lang }) {
  const f = FIN[lang];
  const text = days === 0 ? f.today : days > 0 ? f.inDays(days) : f.daysAgo(-days);
  return (
    <span
      style={{
        fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: RADIUS.pill, whiteSpace: "nowrap",
        background: next ? COLORS.clayTint : COLORS.lineSoft, color: next ? COLORS.clayInk : COLORS.ink2,
      }}
    >
      {text}
    </span>
  );
}
