import { useState } from "react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { clientById, entryClientName, fmtEuro, fmtHoursScreen, fmtNoteDate, getOpenPeriod, formatPeriodLabel, dateStrInPeriod, staffTotalPay, staffTotalHours, expensesOf, expenseApprovedValue } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { PageHeader, Pill, Drawer, Button, Card, MobileHeader, ChevronCircle } from "../shared/ui/index.js";
import { exportStaffHorasPdf } from "../../models/pdfExport.js";

// Uma linha da lista de períodos (documento, 5.5): "20 jul – 19 ago" à
// esquerda, pílula de horas à direita, seta — cartão de 72 (mesma altura
// mínima já usada no acordeão de Clientes, 5.4/Etapa 4f). Partilhada entre
// a moldura de telemóvel e o layout PC/tablet (só o contentor à volta muda).
function PeriodRow({ period, hours, onClick, badge }) {
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
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink }}>{period}</span>
        {badge && <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.amberInk, background: COLORS.amberBg, borderRadius: 6, padding: "3px 8px" }}>{badge}</span>}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Pill variant="neutral">{hours}</Pill>
        <ChevronCircle />
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
function EmployeeHistoricoScreen({ lang, setLang, onHome, staffId, company, clients, staff = [], horasData = {}, cutoffDay, closedPeriods, desktop }) {
  const t = T[lang].employeeHistorico;
  const te = T[lang].expenses;
  const pdfT = T[lang].pdf;
  const [openId, setOpenId] = useState(null);
  const mine = closedPeriods.filter((p) => p.staffSummaries.some((s) => s.staffId === staffId));

  // Período que o próprio já finalizou mas a gerência ainda não fechou: aparece no topo,
  // "em análise pela gerência", com o que foi registado (o valor ainda pode mudar até ao fecho).
  const myHoras = horasData[staffId];
  const pendingPeriod = myHoras && myHoras.status === "finalizado" ? getOpenPeriod(closedPeriods, cutoffDay, TODAY) : null;
  const pending = pendingPeriod ? (() => {
    const entries = (myHoras.entries || []).filter((e) => !e.voided && dateStrInPeriod(e.date, pendingPeriod));
    return {
      id: "pending", periodLabel: formatPeriodLabel(pendingPeriod, lang), isPending: true,
      staffSummaries: [{
        staffId, name: (staff.find((x) => x.id === staffId) || {}).name || "", entries,
        hours: staffTotalHours(myHoras, pendingPeriod), euros: staffTotalPay(myHoras, clients, pendingPeriod),
        expenses: expensesOf(myHoras, pendingPeriod),
      }],
    };
  })() : null;

  const open = openId === "pending" ? pending : mine.find((p) => p.id === openId);
  const line = open && open.staffSummaries.find((s) => s.staffId === staffId);

  const rows = [
    ...(pending ? [<PeriodRow key="pending" period={pending.periodLabel} badge={t.inReview} hours={fmtHoursScreen(pending.staffSummaries[0].hours)} onClick={() => setOpenId("pending")} />] : []),
    ...mine.map((p) => {
      const l = p.staffSummaries.find((s) => s.staffId === staffId);
      return <PeriodRow key={p.id} period={p.periodLabel} hours={fmtHoursScreen(l ? l.hours : 0)} onClick={() => setOpenId(p.id)} />;
    }),
  ];
  const hasRows = rows.length > 0;

  const drawer = (
    <Drawer
      open={!!open}
      onClose={() => setOpenId(null)}
      width={560}
      title={open?.periodLabel}
      pill={open && (open.isPending ? <Pill variant="neutral">{t.inReview}</Pill> : <Pill variant="neutral">{t.closedAt} {fmtNoteDate(open.closedAt)}</Pill>)}
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
        const expenseList = line ? [...(line.expenses || []), ...(line.expensesRejected || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
        const sortedEntries = line ? [...line.entries].sort((a, b) => a.date.localeCompare(b.date)) : [];
        return (
          <>
            {open.isPending && (
              <div style={{ fontSize: 13, color: COLORS.ink2, background: COLORS.amberBg, borderRadius: RADIUS.card, padding: "12px 14px", marginBottom: 14, lineHeight: 1.45 }}>{t.inReviewNote}</div>
            )}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <Card style={{ flex: 1, padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.total}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink }}>{fmtHoursScreen(line ? line.hours : 0)}</div>
              </Card>
              <Card style={{ flex: 1, padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{open.isPending ? t.estimatedValue : t.receivedValue}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.primaryDark }}>{fmtEuro(line ? line.euros : 0)}</div>
              </Card>
            </div>
            {expenseList.length > 0 && (
              <div style={{ marginBottom: 18 }} data-testid="hist-expenses">
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>{te.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {expenseList.map((e, i) => (
                    <div key={e.id || i} style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.chip, padding: "10px 12px", background: COLORS.card }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5, color: COLORS.ink }}>
                        <span><b>{e.type === "fuel" ? te.typeFuel : e.type === "product" ? te.typeProduct : te.typeOther}</b><span style={{ color: COLORS.ink2 }}> · {fmtNoteDate(e.date)}</span></span>
                        <b>{fmtEuro(e.amount)}</b>
                      </div>
                      {e.description && <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 2 }}>{e.description}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <Pill variant={e.status === "approved" ? "paid" : e.status === "rejected" ? "missing" : "pending"}>
                          {e.status === "approved" ? te.statusApproved : e.status === "rejected" ? te.statusRejected : te.statusPending}
                        </Pill>
                        {e.status === "approved" && e.approvedAmount != null && e.approvedAmount !== e.amount && (
                          <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{te.approvedOf(fmtEuro(e.approvedAmount))}</span>
                        )}
                        {e.status === "rejected" && e.note && <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{te.rejectedNote(e.note)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>
                  <span>{te.approvedTotal}</span><span>{fmtEuro(expenseList.reduce((sum, e) => sum + expenseApprovedValue(e), 0))}</span>
                </div>
              </div>
            )}
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
        {!hasRows ? (
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

      {!hasRows ? (
        <div style={mobStyles.emptyState}>{t.noneYet}</div>
      ) : (
        <div style={mobStyles.dayList}>{rows}</div>
      )}

      {drawer}
    </div>
  );
}

export default EmployeeHistoricoScreen;
