import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { clientById, entryClientName, fmtEuro, fmtHoursScreen, fmtNoteDate } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { PageHeader, Pill, Drawer, Button, Card, MobileHeader } from "../shared/ui/index.js";
import { exportStaffHorasPdf } from "../../models/pdfExport.js";

// Uma linha da lista de períodos (documento, 5.5): "20 jul – 19 ago" à
// esquerda, pílula de horas à direita, seta — cartão de 72 (mesma altura
// mínima já usada no acordeão de Clientes, 5.4/Etapa 4f). Partilhada entre
// a moldura de telemóvel e o layout PC/tablet (só o contentor à volta muda).
function PeriodRow({ period, hours, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        minHeight: 72, padding: "14px 16px", borderRadius: RADIUS.card, border: `1px solid ${COLORS.line}`,
        background: COLORS.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}
    >
      <span style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink }}>{period}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Pill variant="neutral">{hours}</Pill>
        <ChevronRight size={16} color={COLORS.ink3} />
      </span>
    </button>
  );
}

// Histórico do próprio (documento, 5.5) — ecrã partilhado por funcionário e
// supervisor (a "regra de ouro" da secção 5: mesmos ecrãs nos dois papéis).
// `desktop` vem de `useBreakpoint()` em App.jsx (`empTier !== "mobile"`),
// mesmo padrão já usado por NotasScreen.jsx/EmployeeClientesScreen.jsx —
// aqui a MESMA lista serve pros dois, só o contentor à volta muda (moldura
// de telemóvel vs. `styles.content` com `PageHeader`); o detalhe é sempre a
// mesma `Drawer` partilhada, que já sabe virar "sheet inferior a 92%" sozinha
// em ecrãs estreitos (<640, breakpoint interno do próprio componente) ou
// gaveta de 560 nos largos — exatamente a divisão que o documento pede
// ("PC e tablet: mesma lista, e o detalhe abre em gaveta de 560"), sem
// precisar duplicar a Drawer pros dois casos.
function EmployeeHistoricoScreen({ lang, setLang, onHome, staffId, company, clients, closedPeriods, desktop }) {
  const t = T[lang].employeeHistorico;
  const pdfT = T[lang].pdf;
  const [openId, setOpenId] = useState(null);
  const mine = closedPeriods.filter((p) => p.staffSummaries.some((s) => s.staffId === staffId));
  const open = mine.find((p) => p.id === openId);
  const line = open && open.staffSummaries.find((s) => s.staffId === staffId);

  const rows = mine.map((p) => {
    const l = p.staffSummaries.find((s) => s.staffId === staffId);
    return <PeriodRow key={p.id} period={p.periodLabel} hours={fmtHoursScreen(l ? l.hours : 0)} onClick={() => setOpenId(p.id)} />;
  });

  const drawer = (
    <Drawer
      open={!!open}
      onClose={() => setOpenId(null)}
      width={560}
      title={open?.periodLabel}
      pill={open && <Pill variant="neutral">{t.closedAt} {fmtNoteDate(open.closedAt)}</Pill>}
      footer={open && (
        <>
          <Button
            variant="secondary"
            onClick={() => exportStaffHorasPdf({
              companyName: company?.name,
              staffName: line ? line.name : "",
              periodLabel: open.periodLabel,
              entries: line ? line.entries : [],
              clients,
              totalHours: line ? line.hours : 0,
              totalValue: line ? line.euros : 0,
              lang,
              pdfT,
            })}
          >
            {t.exportPdf}
          </Button>
          <Button variant="primary" onClick={() => setOpenId(null)}>{t.close}</Button>
        </>
      )}
    >
      {open && (() => {
        const sortedEntries = line ? [...line.entries].sort((a, b) => a.date.localeCompare(b.date)) : [];
        return (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <Card style={{ flex: 1, padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.total}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink }}>{fmtHoursScreen(line ? line.hours : 0)}</div>
              </Card>
              <Card style={{ flex: 1, padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.receivedValue}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.primaryDark }}>{fmtEuro(line ? line.euros : 0)}</div>
              </Card>
            </div>
            {sortedEntries.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.ink3 }}>{T[lang].historico.noEntries}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {sortedEntries.map((e, i) => {
                  const c = clientById(clients, e.clientId);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.lineSoft}`, fontSize: 13 }}>
                      <span>{fmtNoteDate(e.date)} · {entryClientName(clients, e)}</span>
                      <span style={{ fontWeight: 600 }}>{fmtHoursScreen(e.hours)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </Drawer>
  );

  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
        {mine.length === 0 ? (
          <div style={styles.noResults}>{t.noneYet}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rows}</div>
        )}
        {drawer}
      </div>
    );
  }

  return (
    <div style={mobStyles.phone}>
      {/* QA (achado do Iago, 3ª volta — "botão de voltar padrão"):
          cabeçalho trocado pelo `MobileHeader` (seta, igual Horas/Agenda)
          em vez do ícone de casa antigo; título mantido (só Horas e
          Agenda perderam o título, ver comentário lá). */}
      <MobileHeader onBack={onHome} backLabel={t.backLabel} title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      {mine.length === 0 ? (
        <div style={mobStyles.emptyState}>{t.noneYet}</div>
      ) : (
        <div style={mobStyles.dayList}>{rows}</div>
      )}

      {drawer}
    </div>
  );
}

export default EmployeeHistoricoScreen;
