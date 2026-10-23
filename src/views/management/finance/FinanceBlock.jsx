// "Financeiro" do Dashboard (versão compacta do Tomás): fechado ocupa ~125 px —
// A receber − Funcionários = Margem · %, a barra "De onde vem" (uma fatia por contratante) e,
// se faltar preço, um aviso amarelo com "Definir". "Detalhes ▾" abre uma tabela (PC) ou mini-cartões
// (telemóvel) com uma linha por contratante. Só gerência. Tudo calculado na hora
// (horas × valor do contratante), ou os valores guardados quando o mês já foi fechado.
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, FONT } from "../../../styles/tokens.js";
import { fmtHoursScreen } from "../../../models/utils.js";
import { isoDateStr } from "../../../models/utils.js";
import { contractorDates } from "../../../models/contractorStats.js";
import { paymentDueFromInvoice } from "../../../models/contractorClosings.js";
import { FIN } from "../../../models/i18nFin.js";
import { Card, Pill } from "../../shared/ui/index.js";
import { eur0, fmtDay, Dot, DateChip } from "./financeUi.jsx";

const MARGIN_BG = COLORS.clayTint;
const parseIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const hatch = "repeating-linear-gradient(135deg, #D9DEDB 0 4px, #EEF1EF 4px 8px)";

const linkBtn = { border: "none", background: "transparent", color: COLORS.vivo, fontWeight: 700, fontSize: 13, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit", padding: 0 };

// Faturação / Pagamento de um contratante: data + "em X dias", ou "Faturado"/"Recebido", ou "Definir dia".
function stageInfo(card, period, today) {
  const c = card.contractor;
  const row = card.closing && card.closing.status === "closed" ? card.closing : null;
  const dates = contractorDates(c, period.end, today);
  const payDue = row && row.invoicedOn ? paymentDueFromInvoice(c, row.invoicedOn) : null;
  const diff = (d) => Math.round((d - today) / 86400000);
  const billing = row && row.invoicedOn
    ? { done: true, date: parseIso(row.invoicedOn) }
    : dates ? { date: dates.billing, days: dates.billingIn, next: !!row } : null;
  const payDate = payDue || (dates && dates.payment);
  const payment = row && row.receivedOn
    ? { done: true, date: parseIso(row.receivedOn) }
    : payDate ? { date: payDate, days: payDue ? diff(payDue) : dates.paymentIn, next: !!(row && row.invoicedOn) } : null;
  return { billing, payment };
}

function StageCell({ info, lang, f, onDefine, noInline }) {
  if (!info) return <button type="button" onClick={onDefine} style={linkBtn}>{f.defineDay}</button>;
  if (info.done) return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Pill variant="paid">{noInline}</Pill><span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{fmtDay(info.date, lang)}</span></span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><strong style={{ fontWeight: 600 }}>{fmtDay(info.date, lang)}</strong><DateChip days={info.days} next={info.next} lang={lang} /></span>;
}

function SourceBar({ cards, lang, f }) {
  const priced = cards.filter((cd) => cd.value != null && cd.value > 0);
  const unpriced = cards.filter((cd) => cd.value == null);
  const total = priced.reduce((s, cd) => s + cd.value, 0);
  const slice = total > 0 && unpriced.length ? total * 0.1 : 0; // fatia tracejada pequena, só para não "desaparecer"
  const sum = total + slice;
  if (!priced.length && !unpriced.length) return null;
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 6 }}>{f.whereFrom}</div>
      <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", gap: 2 }} aria-hidden="true">
        {priced.map((cd) => <div key={cd.contractor.id} style={{ flex: `${cd.value / (sum || 1)} 1 0`, background: cd.contractor.color }} />)}
        {unpriced.length > 0 && <div style={{ flex: total > 0 ? `${slice / sum} 1 0` : "1 1 0", background: hatch }} />}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8, fontSize: 12.5, color: COLORS.ink2 }}>
        {priced.map((cd) => (
          <span key={cd.contractor.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Dot color={cd.contractor.color} size={9} />{cd.contractor.name} <strong style={{ color: COLORS.ink }}>{eur0(cd.value)}</strong>
          </span>
        ))}
        {unpriced.map((cd) => (
          <span key={cd.contractor.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.ink3 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: hatch, display: "inline-block" }} />{cd.contractor.name} <strong style={{ fontWeight: 600 }}>{f.noPriceShort}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function FinanceBlock({ lang, period, finance, payTotal, expensesTotal = 0, paidCount, boardCount, today, tier, outstanding = [], onSeeContractors, onDefine }) {
  const f = FIN[lang];
  const [open, setOpen] = useState(false);
  const isPhone = tier === "mobile";
  const nothingPriced = finance.pricedCount === 0;
  const unpricedCards = finance.cards.filter((cd) => cd.value == null);
  const partialCards = finance.cards.filter((cd) => cd.value != null && cd.missingPrice > 0);
  const define = (cd) => (onDefine ? onDefine(cd.contractor.id) : onSeeContractors());
  const firstToDefine = (unpricedCards[0] || partialCards[0]);
  const pct = finance.receivable > 0 ? Math.round((finance.margin / finance.receivable) * 100) : null;
  const ended = isoDateStr(today) > period.iso; // eslint-disable-line no-unused-vars
  const big = { fontFamily: FONT.heading, fontWeight: 700, fontSize: isPhone ? 22 : 28, color: COLORS.ink, lineHeight: 1.1 };
  const lbl = { fontSize: 13, color: COLORS.ink2, marginBottom: 4 };
  const op = { fontSize: 20, color: COLORS.ink3, alignSelf: "flex-end", paddingBottom: 8 };

  const equation = (
    <div style={{ display: "flex", gap: isPhone ? 10 : 16, alignItems: "stretch", flexWrap: "nowrap" }}>
      <div><div style={lbl}>{f.toReceiveShort}</div><div style={big}>{nothingPriced ? "—" : eur0(finance.receivable)}</div></div>
      {!isPhone && <span style={op}>−</span>}
      <div><div style={lbl}>{f.staffShort}</div><div style={big}>{nothingPriced ? "—" : eur0(finance.pricedStaff)}</div></div>
      {!isPhone && <span style={op}>=</span>}
      <div style={{ background: MARGIN_BG, borderRadius: RADIUS.control, padding: "6px 12px" }}>
        <div style={{ ...lbl, color: COLORS.clayInk }}>{f.marginLbl}{!nothingPriced && pct != null ? ` · ${pct}%` : ""}</div>
        <div style={{ ...big, color: finance.margin < 0 ? COLORS.alert : COLORS.clayInk }}>{nothingPriced ? "—" : eur0(finance.margin)}</div>
      </div>
    </div>
  );

  const alertText = [
    ...unpricedCards.map((cd) => f.unpricedAlert(cd.contractor.name)),
    ...partialCards.map((cd) => f.partialAlert(cd.contractor.name, cd.missingPrice)),
  ].join(" · ");
  const alert = (unpricedCards.length > 0 || partialCards.length > 0) && (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: RADIUS.pill, fontSize: 13, maxWidth: "100%", width: isPhone ? "100%" : "auto", boxSizing: "border-box" }}>
      <AlertTriangle size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>{alertText}</span>
      <button type="button" onClick={() => define(firstToDefine)} style={{ border: `1.5px solid ${COLORS.vivo}`, background: COLORS.card, color: COLORS.vivo, fontWeight: 700, fontSize: 12.5, borderRadius: RADIUS.pill, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{f.define}</button>
    </div>
  );

  const toggle = (
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ ...linkBtn, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13.5 }}>
      {f.details} {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
    </button>
  );

  const cols = "1.3fr 0.8fr 0.9fr 0.9fr 1.1fr 1.4fr 1.6fr";
  const hdr = { fontSize: 12, fontWeight: 600, color: COLORS.ink3 };

  return (
    <Card style={{ marginBottom: isPhone ? 12 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 17, color: COLORS.ink }}>{f.titleShort}</span>
        <span style={{ fontSize: 13, color: COLORS.ink3 }}>{period.rangeLabel}</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 11px", borderRadius: RADIUS.pill, background: COLORS.clayTint, color: COLORS.clayInk }}>{f.estimate}</span>
        <span style={{ flex: 1 }} />
        {toggle}
      </div>

      <div style={{ display: "flex", flexDirection: isPhone ? "column" : "row", gap: isPhone ? 14 : 32, alignItems: isPhone ? "stretch" : "flex-end" }}>
        {equation}
        <SourceBar cards={finance.cards} lang={lang} f={f} />
      </div>

      {alert && <div style={{ marginTop: 12 }}>{alert}</div>}

      {open && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8 }}>
          {finance.cards.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.ink3, padding: "8px 0" }}>{f.noHours}</div>
          ) : !isPhone ? (
            <div role="table">
              <div role="row" style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "8px 2px" }}>
                <span style={hdr}>{f.colContractor}</span><span style={hdr}>{f.colHours}</span><span style={hdr}>{f.colReceive}</span><span style={hdr}>{f.staff}</span><span style={hdr}>{f.marginLbl}</span><span style={hdr}>{f.billing}</span><span style={hdr}>{f.payment}</span>
              </div>
              {finance.cards.map((cd) => {
                const st = stageInfo(cd, period, today);
                const priced = cd.value != null;
                return (
                  <div role="row" key={cd.contractor.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "10px 2px", borderTop: `1px solid ${COLORS.lineSoft}`, fontSize: 13.5 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, minWidth: 0 }}><Dot color={cd.contractor.color} size={10} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cd.contractor.name}</span></span>
                    <span>{fmtHoursScreen(cd.hours)}</span>
                    <span style={{ fontWeight: 700 }}>{priced ? eur0(cd.value) : <span style={{ color: COLORS.ink3, fontWeight: 400 }}>{f.noPriceShort}</span>}{priced && cd.missingPrice > 0 && <span style={{ display: "block", fontSize: 11.5, fontWeight: 400, color: COLORS.amberInk }}>+{cd.missingPrice} {f.noPriceShort}</span>}</span>
                    <span>{eur0(cd.staffCost)}</span>
                    <span style={{ fontWeight: 700, color: priced ? (cd.margin < 0 ? COLORS.alert : COLORS.clayInk) : COLORS.ink3 }}>{priced ? `${eur0(cd.margin)}${cd.marginPct != null ? ` · ${cd.marginPct}%` : ""}` : "—"}</span>
                    <span>{priced || cd.contractor.billingDay ? <StageCell info={st.billing} lang={lang} f={f} onDefine={onSeeContractors} noInline={f.invoiced} /> : <button type="button" onClick={() => define(cd)} style={linkBtn}>{f.definePrice}</button>}</span>
                    <span><StageCell info={st.payment} lang={lang} f={f} onDefine={onSeeContractors} noInline={f.received} /></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
              {finance.cards.map((cd) => {
                const st = stageInfo(cd, period, today);
                const priced = cd.value != null;
                return (
                  <div key={cd.contractor.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Dot color={cd.contractor.color} size={10} /><strong style={{ flex: 1 }}>{cd.contractor.name}</strong><span style={{ fontSize: 12.5, color: COLORS.ink3 }}>{fmtHoursScreen(cd.hours)}</span></div>
                    <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 20 }}>{priced ? eur0(cd.value) : <span style={{ color: COLORS.ink3, fontSize: 15 }}>{f.noPrice}</span>}</div>
                    <div style={{ fontSize: 13, color: COLORS.ink2 }}>{f.staff} {eur0(cd.staffCost)}{priced && <> · {f.marginShort} <strong style={{ color: cd.margin < 0 ? COLORS.alert : COLORS.clayInk }}>{eur0(cd.margin)}{cd.marginPct != null ? ` · ${cd.marginPct}%` : ""}</strong></>}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
                      {(!priced || cd.missingPrice > 0) && <button type="button" onClick={() => define(cd)} style={linkBtn}>{f.definePrice}</button>}
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{f.billing}: <StageCell info={st.billing} lang={lang} f={f} onDefine={onSeeContractors} noInline={f.invoiced} /></span>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{f.payment}: <StageCell info={st.payment} lang={lang} f={f} onDefine={onSeeContractors} noInline={f.received} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {outstanding.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>{f.receivablePrev}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outstanding.map((o) => (
                  <div key={o.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
                    <Dot color={o.color} size={9} />
                    <span style={{ fontWeight: 600 }}>{o.name}</span>
                    <span style={{ color: COLORS.ink3, flex: 1 }}>{o.label}</span>
                    <strong>{o.value != null ? eur0(o.value) : "—"}</strong>
                    <Pill variant={o.invoiced ? "pending" : "owed"}>{o.invoiced ? f.waitPay : f.nextBill}</Pill>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.lineSoft}`, fontSize: 13, color: COLORS.ink2 }}>
            <span style={{ flex: "1 1 240px" }}>
              {f.paidAll}: <strong style={{ color: COLORS.ink }}>{eur0(payTotal)}</strong> · {f.paidOf(paidCount, boardCount)}
              {expensesTotal > 0 && <> · {f.includesExpenses(eur0(expensesTotal))}</>}
            </span>
            <button type="button" onClick={onSeeContractors} style={{ ...linkBtn, fontSize: 13.5 }}>{f.seeContractors} →</button>
          </div>
        </div>
      )}
    </Card>
  );
}

export { FinanceBlock };
