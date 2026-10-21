import { useState } from "react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { T } from "../../models/i18n.js";
import { parseMoneyInput, fmtEuro, expenseApprovedValue } from "../../models/utils.js";
import { Button, Pill, Drawer, StoredFile } from "../shared/ui/index.js";

const shortDm = (iso) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso || "");
function typeLabel(t, type) {
  return type === "fuel" ? t.typeFuel : type === "product" ? t.typeProduct : t.typeOther;
}

// Uma despesa vista pela gerência: por aprovar -> valor (editável) + Aprovar/Recusar;
// já decidida -> estado + "Voltar a decidir" (se o funcionário ainda não foi pago).
function ExpenseDecisionRow({ lang, expense: e, staffName, locked, onApprove, onReject, onRevert }) {
  const t = T[lang].expenses;
  const [amount, setAmount] = useState(String(e.amount).replace(".", ","));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const parsed = parseMoneyInput(amount);
  const input = { height: 40, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`, padding: "0 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div
      data-testid="expense-decision" data-status={e.status}
      style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.chip, padding: "10px 12px", background: e.status === "pending" ? COLORS.amberBg : COLORS.card }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, fontSize: 13.5, color: COLORS.ink }}>
          {staffName && <div style={{ fontWeight: 700 }}>{staffName}</div>}
          <div><b>{typeLabel(t, e.type)}</b><span style={{ color: COLORS.ink2 }}> · {shortDm(e.date)}</span></div>
          {e.description && <div style={{ color: COLORS.ink2 }}>{e.description}</div>}
          {e.receipt && <StoredFile file={e.receipt} labels={T[lang].files} size={40} showName={false} style={{ marginTop: 6 }} />}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.ink, flexShrink: 0 }}>{fmtEuro(e.amount)}</div>
      </div>

      {e.status === "pending" ? (
        <div style={{ marginTop: 10 }}>
          {!rejecting ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.ink2 }}>
                {t.approvedAmountLabel}
                <input aria-label={t.approvedAmountLabel} type="text" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} style={{ ...input, width: 90 }} />
              </label>
              <Button variant="primary" disabled={!parsed} onClick={() => onApprove(parsed)}>{t.approve}</Button>
              <Button variant="secondary" onClick={() => setRejecting(true)}>{t.reject}</Button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input aria-label={t.rejectNotePh} type="text" value={note} placeholder={t.rejectNotePh} onChange={(ev) => setNote(ev.target.value)} style={{ ...input, flex: 1, minWidth: 160 }} />
              <Button variant="secondary" onClick={() => { setRejecting(false); setNote(""); }}>{t.cancel}</Button>
              <Button variant="dangerSoft" onClick={() => onReject(note.trim())}>{t.reject}</Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill variant={e.status === "approved" ? "paid" : "missing"}>{e.status === "approved" ? t.statusApproved : t.statusRejected}</Pill>
            {e.status === "approved" && <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.approvedOf(fmtEuro(expenseApprovedValue(e)))}</span>}
            {e.status === "rejected" && e.note && <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.rejectedNote(e.note)}</span>}
          </div>
          {!locked ? <Button variant="ghost" onClick={onRevert}>{t.revert}</Button> : <span style={{ fontSize: 12, color: COLORS.ink3 }}>{t.paidLocked}</span>}
        </div>
      )}
    </div>
  );
}

// Caixa com todas as despesas por aprovar, de todos os funcionários.
// `items`: [{ staffId, expense }]; `decide(staffId, id, patch)` grava a decisão.
function ExpensesReviewDrawer({ lang, open, onClose, items, staff, decide }) {
  const t = T[lang].expenses;
  const nameOf = (sid) => (staff.find((s) => String(s.id) === String(sid)) || {}).name || "—";
  return (
    <Drawer
      open={open} onClose={onClose} title={t.reviewTitle} width={560}
      footer={<Button variant="secondary" onClick={onClose}>{t.reviewClose}</Button>}
    >
      {items.length === 0 ? (
        <div style={{ fontSize: 14, color: COLORS.ink2 }}>{t.reviewEmpty}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(({ staffId, expense }) => (
            <ExpenseDecisionRow
              key={`${staffId}-${expense.id}`} lang={lang} expense={expense} staffName={nameOf(staffId)} locked={false}
              onApprove={(value) => decide(staffId, expense.id, { status: "approved", approvedAmount: value, note: "" })}
              onReject={(note) => decide(staffId, expense.id, { status: "rejected", approvedAmount: null, note })}
              onRevert={() => decide(staffId, expense.id, { status: "pending", approvedAmount: null, note: "" })}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

export { ExpenseDecisionRow, ExpensesReviewDrawer };
