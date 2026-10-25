// Corpo do relatório de um contratante: um bloco por cliente com visitas feitas/previstas,
// dia a dia (data, horas, extra, quem fez) e total de horas. Usado na pré-visualização e no relatório do mês.
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { fmtHoursScreen } from "../../../models/utils.js";
import { FIN } from "../../../models/i18nFin.js";

// Horas do cliente; os extras pedidos à parte vêm numa nota curta.
function hoursText(r, f) {
  let txt = fmtHoursScreen(r.hours);
  if (r.extraMin > 0) txt += ` (${f.reportExtraMin(r.extraMin)})`;
  if (r.lessMin > 0) txt += ` (${f.reportLessMin(r.lessMin)})`;
  return txt;
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
              {r.extraMin > 0 && <span>{f.reportExtraMin(r.extraMin)}</span>}
              {r.lessMin > 0 && <span>{f.reportLessMin(r.lessMin)}</span>}
            </div>
            {r.staffNames.length > 0 && <div style={{ color: COLORS.ink2, fontSize: 12.5 }}>{r.staffNames.join(", ")}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Linhas do PDF: Cliente | Visitas | Quem fez | Horas.
function reportPdfRows(report, lang) {
  const f = FIN[lang];
  return report.rows.map((r) => [r.name, f.reportVisits(r.doneN, r.expectedN), r.staffNames.join(", "), hoursText(r, f)]);
}

export { ReportDetail, reportPdfRows };
