// Corpo do relatório de um contratante: um bloco por cliente com visitas feitas/previstas,
// dia a dia (data, horas, extra, quem fez) e total de horas. Usado na pré-visualização e no relatório do mês.
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { fmtHoursScreen, fmtHoursNum } from "../../../models/utils.js";
import { FIN } from "../../../models/i18nFin.js";

const LOCALE = { pt: "pt-PT", en: "en-GB", fr: "fr-FR" };
function dayLabel(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).toLocaleDateString(LOCALE[lang] || "pt-PT", { weekday: "short" }).replace(".", "");
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
function visitText(v, lang, f) {
  const parts = [dayLabel(v.date, lang), fmtHoursScreen(v.hours)];
  if (v.extraMin > 0) parts[1] += ` (${f.reportExtraMin(v.extraMin)})`;
  if (v.lessMin > 0) parts[1] += ` (${f.reportLessMin(v.lessMin)})`;
  if (v.staff.length) parts.push(v.staff.join(", "));
  return parts.join(" · ");
}

function ReportDetail({ lang, report }) {
  const f = FIN[lang];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {report.rows.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 14px", background: COLORS.headerTint }}>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>{r.name}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtHoursScreen(r.hours)}</span>
          </div>
          <div style={{ padding: "9px 14px", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", color: COLORS.ink2 }}>
              <span style={{ fontWeight: 600, color: COLORS.ink }}>{f.reportVisits(r.doneN, r.expectedN)}</span>
              {r.missed.length > 0 && <span style={{ color: COLORS.amberInk }}>{f.reportMissedN(r.missed.length)}</span>}
              {r.outside > 0 && <span>{f.reportOutsideN(r.outside)}</span>}
              {r.extraMin > 0 && <span>{f.reportExtraMin(r.extraMin)}</span>}
              {r.lessMin > 0 && <span>{f.reportLessMin(r.lessMin)}</span>}
            </div>
            {r.visits.map((v) => (
              <div key={v.date} style={{ color: COLORS.ink2, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{visitText(v, lang, f)}</div>
            ))}
            {r.missed.length > 0 && (
              <div style={{ color: COLORS.amberInk, fontSize: 12.5 }}>{f.reportMissedDays}: {r.missed.map((d) => dayLabel(d, lang)).join(", ")}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Linhas do PDF: Cliente | Visitas | Dias, horas e quem fez | Horas.
function reportPdfRows(report, lang) {
  const f = FIN[lang];
  return report.rows.map((r) => [
    r.name,
    f.reportVisits(r.doneN, r.expectedN),
    r.visits.map((v) => visitText(v, lang, f)).join("\n") + (r.missed.length ? `\n${f.reportMissedDays}: ${r.missed.map((d) => dayLabel(d, lang)).join(", ")}` : ""),
    `${fmtHoursNum(r.hours)}h`,
  ]);
}

export { ReportDetail, reportPdfRows };
