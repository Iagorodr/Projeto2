// "Financeiro do período" (Dashboard, topo): A receber − A pagar = Margem estimada, e um
// cartão por contratante com valor a receber, barra funcionários/margem e datas de
// faturação e pagamento. Só gerência. Tudo calculado na hora (horas × valor do contratante).
// Os estados "Faturado"/"Recebido" chegam com o fecho do mês (etapa seguinte): até lá a
// próxima ação de um período em curso é sempre "faturar".
import { FileText, CircleDollarSign } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, FONT } from "../../../styles/tokens.js";
import { fmtHoursScreen } from "../../../models/utils.js";
import { contractorDates } from "../../../models/contractorStats.js";
import { FIN } from "../../../models/i18nFin.js";
import { Card } from "../../shared/ui/index.js";
import { eur0, fmtDay, Dot, DateChip } from "./financeUi.jsx";

const STAFF_COLOR = "#5E9C85";
const MARGIN_COLOR = "#E08A66";

function ContractorFinanceCard({ card, period, today, lang }) {
  const f = FIN[lang];
  const { contractor: c } = card;
  const priced = card.value != null;
  const dates = contractorDates(c, period.end, today);
  const staffPct = priced && card.value > 0 ? Math.max(0, Math.min(100, (card.staffCost / card.value) * 100)) : 0;
  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, padding: 16, background: COLORS.headerTint, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Dot color={c.color} size={11} />
        <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        <span style={{ fontSize: 12.5, color: COLORS.ink3 }}>{fmtHoursScreen(card.hours)}</span>
      </div>

      {priced ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 26, color: COLORS.ink }}>{eur0(card.value)}</span>
            <span style={{ fontSize: 12.5, color: COLORS.ink3 }}>{f.receivable}</span>
          </div>
          <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden", gap: 2 }} aria-hidden="true">
            <div style={{ width: `${staffPct}%`, background: STAFF_COLOR }} />
            <div style={{ flex: 1, background: MARGIN_COLOR }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: STAFF_COLOR }} />
              <span style={{ flex: 1, color: COLORS.ink2 }}>{f.staff}</span><strong>{eur0(card.staffCost)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: MARGIN_COLOR }} />
              <span style={{ flex: 1, color: COLORS.clayInk, fontWeight: 600 }}>{f.marginShort}</span>
              <strong style={{ color: card.margin < 0 ? COLORS.alert : COLORS.clayInk }}>{eur0(card.margin)}{card.marginPct != null ? ` · ${card.marginPct}%` : ""}</strong>
            </div>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: COLORS.ink2, padding: "6px 0" }}>
          <div style={{ fontWeight: 600 }}>{c.isDirect ? f.priceByClient : f.noPrice}</div>
          <div style={{ fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{f.noPriceHint}</div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>{f.staff}: <strong>{eur0(card.staffCost)}</strong></div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
        {dates ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} color={COLORS.ink3} aria-hidden="true" />
              <span style={{ color: COLORS.ink2, flex: 1 }}>{f.billing} <strong style={{ color: COLORS.ink }}>{fmtDay(dates.billing, lang)}</strong></span>
              <DateChip days={dates.billingIn} next lang={lang} />
            </div>
            {dates.payment && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CircleDollarSign size={15} color={COLORS.ink3} aria-hidden="true" />
                <span style={{ color: COLORS.ink2, flex: 1 }}>{f.payment} <strong style={{ color: COLORS.ink }}>{fmtDay(dates.payment, lang)}</strong></span>
                <DateChip days={dates.paymentIn} lang={lang} />
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: COLORS.ink3 }}>{f.noBillingDay}</div>
        )}
      </div>
      {dates && (
        <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, padding: "8px 10px", borderRadius: RADIUS.control, background: COLORS.clayTint, color: COLORS.clayInk }}>{f.nextBill}</div>
      )}
    </div>
  );
}

function FinanceBlock({ lang, period, finance, payTotal, paidCount, boardCount, today, tier, onSeeContractors }) {
  const f = FIN[lang];
  const isPhone = tier === "mobile";
  const allPriced = finance.unpriced === 0;
  const nothingPriced = finance.pricedCount === 0; // sem nenhum preço definido: não há receber nem margem para mostrar
  const pctMargin = finance.receivable > 0 ? Math.round((finance.margin / finance.receivable) * 100) : null;
  const big = { fontFamily: FONT.heading, fontWeight: 700, fontSize: isPhone ? 24 : 30, color: COLORS.ink, lineHeight: 1.1 };
  const op = { fontSize: 22, color: COLORS.ink3, alignSelf: "center", padding: "0 2px" };

  return (
    <Card style={{ marginBottom: isPhone ? 12 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 17, color: COLORS.ink }}>{f.title}</span>
        <span style={{ fontSize: 13, color: COLORS.ink3, flex: isPhone ? "1 1 100%" : 1, order: isPhone ? 3 : 0 }}>{period.rangeLabel}</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: RADIUS.pill, background: COLORS.clayTint, color: COLORS.clayInk }}>{f.estimate}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: isPhone ? 14 : 22, alignItems: "stretch", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 6 }}>{f.toReceive}</div>
          <div style={big}>{nothingPriced ? "—" : eur0(finance.receivable)}</div>
        </div>
        {allPriced && !nothingPriced && !isPhone && <span style={op}>−</span>}
        <div>
          <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 6 }}>{f.toPay}</div>
          <div style={big}>{eur0(payTotal)}</div>
          <div style={{ fontSize: 12.5, color: COLORS.ink3, marginTop: 4 }}>{f.paidOf(paidCount, boardCount)}</div>
        </div>
        {allPriced && !nothingPriced && !isPhone && <span style={op}>=</span>}
        <div style={{ background: COLORS.clayTint, borderRadius: RADIUS.card, padding: "12px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 13, color: COLORS.clayInk, marginBottom: 6 }}>{f.margin}</div>
          <div style={{ ...big, color: finance.margin < 0 ? COLORS.alert : COLORS.clayInk }}>{nothingPriced ? "—" : eur0(finance.margin)}</div>
          <div style={{ fontSize: 12.5, color: COLORS.clayInk, marginTop: 4 }}>
            {!nothingPriced && pctMargin != null ? f.marginPct(pctMargin) : ""}
            {!allPriced && <div>{f.marginNote(finance.unpriced)}</div>}
          </div>
        </div>
      </div>

      {finance.cards.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink3, padding: "8px 0 14px" }}>{f.noHours}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
          {finance.cards.map((card) => (
            <ContractorFinanceCard key={card.contractor.id} card={card} period={period} today={today} lang={lang} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        <span style={{ fontSize: 12, color: COLORS.ink3, flex: "1 1 240px" }}>{f.footnote}</span>
        <button
          type="button" onClick={onSeeContractors}
          style={{ border: "none", background: "transparent", color: COLORS.vivo, fontSize: 13.5, fontWeight: 700, textDecoration: "underline", textDecorationThickness: 2, textUnderlineOffset: 4, cursor: "pointer", fontFamily: "inherit", padding: "6px 2px" }}
        >
          {f.seeContractors} →
        </button>
      </div>
    </Card>
  );
}

export { FinanceBlock };
