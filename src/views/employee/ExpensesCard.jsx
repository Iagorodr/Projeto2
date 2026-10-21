import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { TODAY } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { EXPENSE_TYPES, parseMoneyInput, dateStrInPeriod, fmtEuro, isoDateStr, expenseApprovedValue } from "../../models/utils.js";
import { DateField } from "../shared/FormInputs.jsx";
import { Card, Button, Pill, Drawer, ConfirmDialog, PhotoDropzone, StoredFile } from "../shared/ui/index.js";
import { uploadFile, removeFile, KINDS, uploadErrorKey } from "../../models/fileStorage.js";

const isoToDmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
const dmyToIso = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const shortDm = (iso) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso || "");

function typeLabel(t, type) {
  return type === "fuel" ? t.typeFuel : type === "product" ? t.typeProduct : t.typeOther;
}

// Despesas a reembolsar (lado do funcionário). Só aparece a quem a gerência deu
// esse privilégio. Lança-se durante o período (ou ao finalizar o mês); a gerência
// aprova. Pendentes dá para editar/eliminar; decididas ficam só para ler.
// `openNonce`: o pai incrementa para abrir o formulário (ex.: pergunta ao finalizar).
function ExpensesCard({ lang, staffId, expenses, period, locked, onSave, onDelete, openNonce = 0 }) {
  const t = T[lang].expenses;
  const tf = T[lang].files;
  const [receiptFile, setReceiptFile] = useState(null); // foto nova, ainda por enviar
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(null); // null = fechado; { id?, type, description, amount, date(dd/mm/aaaa) }
  const [errors, setErrors] = useState({});
  const [deleteId, setDeleteId] = useState(null);

  function defaultDate() {
    const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    const d = today > period.end ? period.end : today < period.start ? period.start : today;
    return isoToDmy(isoDateStr(d));
  }
  function startAdd() {
    setErrors({}); setReceiptFile(null); setSaveError("");
    setForm({ type: "fuel", description: "", amount: "", date: defaultDate(), receipt: null });
  }
  function startEdit(e) {
    setErrors({}); setReceiptFile(null); setSaveError("");
    setForm({ id: e.id, type: e.type, description: e.description || "", amount: String(e.amount).replace(".", ","), date: isoToDmy(e.date), receipt: e.receipt || null, originalReceipt: e.receipt || null });
  }
  useEffect(() => { if (openNonce > 0 && !locked) startAdd(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [openNonce]);

  async function submit() {
    if (saving) return;
    const amount = parseMoneyInput(form.amount);
    const iso = dmyToIso(form.date);
    const next = {};
    if (!amount) next.amount = t.amountInvalid;
    if (!iso || !dateStrInPeriod(iso, period)) next.date = t.dateInvalid;
    if (form.type !== "fuel" && !form.description.trim()) next.description = t.descRequired;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // O recibo é opcional: foto nova → envia para o cofre; foto já guardada fica;
    // foto removida pelo utilizador → apaga a antiga do cofre.
    let receipt = form.receipt || null;
    if (receiptFile) {
      setSaving(true); setSaveError("");
      try {
        receipt = await uploadFile(receiptFile, { kind: KINDS.receipts, ownerId: staffId, imagesOnly: true });
      } catch (err) {
        setSaving(false); setSaveError(tf[uploadErrorKey(err)]);
        return;
      }
      setSaving(false);
    }
    const old = form.originalReceipt;
    if (old && (!receipt || receipt.path !== old.path)) removeFile(old);
    onSave({
      id: form.id || Date.now(),
      type: EXPENSE_TYPES.includes(form.type) ? form.type : "other",
      description: form.description.trim(), amount, date: iso,
      status: "pending",
      receipt,
    });
    setForm(null); setReceiptFile(null);
  }

  const sorted = expenses.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id - a.id));
  const approvedTotal = expenses.reduce((s, e) => s + expenseApprovedValue(e), 0);
  const pendingTotal = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  const field = { width: "100%", boxSizing: "border-box", height: 48, borderRadius: RADIUS.control, border: `1px solid ${COLORS.line}`, padding: "0 12px", fontSize: 16, fontFamily: "inherit" };
  const label = { fontSize: 12.5, fontWeight: 600, color: COLORS.ink2, marginBottom: 4 };
  const err = { fontSize: 12.5, color: COLORS.dangerInk, marginTop: 4 };

  return (
    <Card variant="default" data-testid="expenses-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{t.title}</div>
        {!locked && <Button variant="secondary" icon={Plus} onClick={startAdd} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{t.add}</Button>}
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.ink3, lineHeight: 1.45, marginBottom: 12 }}>{locked ? t.lockedNote : t.intro}</div>

      {sorted.length === 0 ? (
        <div style={{ fontSize: 13.5, color: COLORS.ink2 }}>{t.empty}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: COLORS.bg, borderRadius: RADIUS.control, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: COLORS.ink3 }}>{t.approvedTotal}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtEuro(approvedTotal)}</div>
            </div>
            {pendingTotal > 0 && (
              <div style={{ flex: 1, background: COLORS.amberBg, borderRadius: RADIUS.control, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: COLORS.amberInk }}>{t.pendingTotal}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtEuro(pendingTotal)}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((e) => (
              <div key={e.id} data-testid="expense-row" style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.chip, padding: "10px 12px", background: COLORS.card }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0, fontSize: 13.5, color: COLORS.ink }}>
                    <b>{typeLabel(t, e.type)}</b>
                    <span style={{ color: COLORS.ink2 }}> · {shortDm(e.date)}</span>
                    {e.description && <div style={{ color: COLORS.ink2, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</div>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.ink, flexShrink: 0 }}>{fmtEuro(e.amount)}</div>
                </div>
                {e.receipt && <StoredFile file={e.receipt} labels={tf} size={36} showName={false} style={{ marginTop: 8 }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Pill variant={e.status === "approved" ? "paid" : e.status === "rejected" ? "missing" : "pending"}>
                      {e.status === "approved" ? t.statusApproved : e.status === "rejected" ? t.statusRejected : t.statusPending}
                    </Pill>
                    {e.status === "approved" && e.approvedAmount != null && e.approvedAmount !== e.amount && (
                      <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.approvedOf(fmtEuro(e.approvedAmount))}</span>
                    )}
                    {e.status === "rejected" && e.note && <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.rejectedNote(e.note)}</span>}
                  </div>
                  {e.status === "pending" && !locked && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button variant="ghost" icon={Pencil} onClick={() => startEdit(e)}>{T[lang].common.edit}</Button>
                      <Button variant="ghost" icon={Trash2} onClick={() => setDeleteId(e.id)}>{T[lang].common.delete}</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Drawer
        open={!!form} onClose={() => setForm(null)} title={form && form.id ? t.editTitle : t.newTitle} width={420}
        footer={<><Button variant="secondary" onClick={() => setForm(null)}>{t.cancel}</Button><Button variant="primary" onClick={submit} disabled={saving}>{saving ? tf.uploading : t.save}</Button></>}
      >
        {form && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={label}>{t.fType}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {EXPENSE_TYPES.map((ty) => {
                  const active = form.type === ty;
                  return (
                    <button
                      key={ty} type="button" onClick={() => setForm({ ...form, type: ty })}
                      style={{ border: `1.5px solid ${active ? COLORS.vivo : COLORS.line}`, background: active ? COLORS.mint : COLORS.card, color: active ? COLORS.vivoInk : COLORS.ink2, fontWeight: 600, fontSize: 13.5, padding: "10px 14px", borderRadius: RADIUS.control, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {typeLabel(t, ty)}
                    </button>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={label}>{t.fDescription}</div>
              <input type="text" value={form.description} placeholder={t.fDescriptionPh} onChange={(ev) => setForm({ ...form, description: ev.target.value })} style={field} />
              {errors.description && <div style={err}>{errors.description}</div>}
            </label>
            <label style={{ display: "block", marginBottom: 14 }}>
              <div style={label}>{t.fAmount}</div>
              <input type="text" inputMode="decimal" value={form.amount} placeholder="0,00" onChange={(ev) => setForm({ ...form, amount: ev.target.value })} style={field} />
              {errors.amount && <div style={err}>{errors.amount}</div>}
            </label>
            <div style={{ marginBottom: 6 }}>
              <div style={label}>{t.fDate}</div>
              <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} openLabel={t.calendar} />
              {errors.date && <div style={err}>{errors.date}</div>}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={label}>{t.fReceipt}</div>
              <PhotoDropzone
                file={receiptFile} onChange={setReceiptFile} label={t.receiptAdd} removeLabel={tf.remove} labels={tf}
                existing={form.receipt} onClearExisting={() => setForm({ ...form, receipt: null })} disabled={saving}
              />
              {saveError && <div style={err}>{saveError}</div>}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteId != null} title={t.deleteTitle} body={t.deleteBody}
        cancelLabel={t.deleteCancel} confirmLabel={t.deleteConfirm} destructive
        onCancel={() => setDeleteId(null)} onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
      />
    </Card>
  );
}

export default ExpensesCard;
