import { useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { contractorPeriods } from "../../models/contractorStats.js";
import { ContractorsOverview } from "./finance/ContractorsOverview.jsx";
import { ContractorDetail } from "./finance/ContractorDetail.jsx";
import { T } from "../../models/i18n.js";
import { Field } from "../shared/Layout.jsx";
import { PageHeader, Pill, Drawer, Button, ConfirmDialog, Card } from "../shared/ui/index.js";
import {
  CONTRACTOR_COLORS, EMPTY_CONTRACTOR, normName, contractorNameTaken, clientsOfContractor,
  clientsWithoutContractor, marginPerHour,
} from "../../models/contractors.js";

const eur = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : `${Number(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

// Contratantes: quem paga à empresa pelas horas dos clientes. Esta página é
// só da gerência (os valores são confidenciais: a tabela nem é legível para
// funcionários). Cada contratante tem o seu valor/hora, o valor/hora padrão
// pago ao funcionário (pré-preenche os clientes novos), o dia de faturação e
// o prazo de pagamento; os clientes ligam-se a ele pelo nome (origem).
function ContratantesScreen({ lang, setLang, contractors, setContractors, onDeleteContractor, clients, setClients, staff, horasData, closedPeriods, cutoffDay }) {
  const t = T[lang].contratantes;
  const tier = useBreakpoint();
  const [detailId, setDetailId] = useState(null);
  // 12 períodos (11 fechados + o aberto): a partir daí liberta-se o filtro 6 | 12 meses.
  const periods = useMemo(
    () => contractorPeriods({ closedPeriods, horasData, staff, clients, contractors, cutoffDay, today: TODAY, lang, count: 12 }),
    [closedPeriods, horasData, staff, clients, contractors, cutoffDay, lang],
  );
  const has12 = periods.length >= 12;
  const detail = detailId != null ? contractors.find((c) => c.id === detailId) : null;
  const c0 = T[lang].common;

  const [editingId, setEditingId] = useState(null); // id | "new" | null
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editing = editingId && editingId !== "new" ? contractors.find((c) => c.id === editingId) : null;
  const unassigned = clientsWithoutContractor(clients, contractors);

  function openNew() { setDraft({ ...EMPTY_CONTRACTOR, color: CONTRACTOR_COLORS[contractors.length % CONTRACTOR_COLORS.length] }); setErrors({}); setEditingId("new"); }
  function openEdit(c) { setDraft({ ...EMPTY_CONTRACTOR, ...c }); setErrors({}); setEditingId(c.id); }
  function close() { setEditingId(null); setDraft(null); setErrors({}); setDeleteOpen(false); }
  function update(field, value) { setErrors((e) => ({ ...e, [field]: undefined })); setDraft((d) => ({ ...d, [field]: value })); }

  function save() {
    const errs = {};
    const name = String(draft.name || "").trim();
    if (!name) errs.name = c0.requiredField;
    else if (contractorNameTaken(contractors, name, editing ? editing.id : undefined)) errs.name = t.nameTaken;
    const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    ["rate", "staffRate"].forEach((k) => { const n = num(draft[k]); if (n !== null && !(n >= 0)) errs[k] = t.numberInvalid; });
    const bd = num(draft.billingDay); if (bd !== null && !(Number.isInteger(bd) && bd >= 1 && bd <= 31)) errs.billingDay = t.dayInvalid;
    const pd = num(draft.paymentDays); if (pd !== null && !(Number.isInteger(pd) && pd >= 0 && pd <= 365)) errs.paymentDays = t.daysInvalid;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const clean = { ...draft, name, rate: draft.isDirect ? "" : draft.rate };
    if (editing) {
      setContractors((prev) => prev.map((c) => (c.id === editing.id ? { ...clean, id: editing.id } : c)));
      // Mudou o nome? Os clientes dele passam a usar o nome novo.
      if (normName(editing.name) !== normName(name) || editing.name !== name) {
        const old = normName(editing.name);
        setClients((prev) => prev.map((cl) => (normName(cl.origin) === old ? { ...cl, origin: name } : cl)));
      }
    } else {
      setContractors((prev) => [...prev, { ...clean, id: Date.now() }]);
    }
    close();
  }

  function assign(clientId, contractorName) {
    setClients((prev) => prev.map((cl) => (cl.id === clientId ? { ...cl, origin: contractorName } : cl)));
  }

  const clientsCount = (c) => clientsOfContractor(clients, c).length;

  const draftClients = editing ? clientsOfContractor(clients, editing) : [];
  const blockedDelete = draftClients.length > 0;

  return (
    <div style={styles.content}>
      {detail ? (
        <ContractorDetail
          lang={lang} tier={tier} contractor={detail} clients={clients} periods={periods} has12={has12}
          onBack={() => setDetailId(null)} onEdit={() => openEdit(detail)}
        />
      ) : (
      <>
      <PageHeader
        title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES}
        actions={<Button icon={Plus} onClick={openNew}>{t.newContractor}</Button>}
      />

      {unassigned.length > 0 && (
        <Card variant="default" style={{ marginBottom: 18, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.amberInk, marginBottom: 4 }}>{t.unassignedTitle(unassigned.length)}</div>
          <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 12 }}>{contractors.length === 0 ? t.unassignedNoContractors : t.unassignedBody}</div>
          {contractors.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {unassigned.slice(0, 12).map((cl) => (
                <div key={cl.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 200px", fontSize: 13.5, fontWeight: 600 }}>
                    {cl.name}
                    {cl.origin ? <span style={{ fontWeight: 400, color: COLORS.ink3 }}> · {t.wasWritten(cl.origin)}</span> : null}
                  </span>
                  <select style={{ ...styles.input, width: 220 }} value="" onChange={(e) => e.target.value && assign(cl.id, e.target.value)} aria-label={t.chooseFor(cl.name)}>
                    <option value="">{t.choose}</option>
                    {contractors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              ))}
              {unassigned.length > 12 && <div style={{ fontSize: 12, color: COLORS.ink3 }}>{t.andMore(unassigned.length - 12)}</div>}
            </div>
          )}
        </Card>
      )}

      {contractors.length === 0
        ? <Card><div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.empty}</div></Card>
        : <ContractorsOverview lang={lang} tier={tier} contractors={contractors} clients={clients} periods={periods} has12={has12} today={TODAY} onOpen={(c) => setDetailId(c.id)} />}
      </>
      )}

      <Drawer
        open={!!(editingId && draft)}
        onClose={close}
        width={560}
        closeLabel={c0.close}
        title={editing ? editing.name : t.drawerNew}
        pill={draft && draft.isDirect ? <Pill variant="neutral">{t.direct}</Pill> : null}
        dirty={!!draft && (editingId === "new" ? String(draft.name || "").trim() !== "" : JSON.stringify({ ...EMPTY_CONTRACTOR, ...editing }) !== JSON.stringify(draft))}
        footer={
          <>
            {editing && <Button variant="dangerSoft" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={blockedDelete} disabledReason={blockedDelete ? t.deleteBlocked(draftClients.length) : undefined}>{c0.delete}</Button>}
            <div style={{ flex: 1 }} />
            <Button variant="secondary" onClick={close}>{c0.cancel}</Button>
            <Button variant="primary" onClick={save}>{c0.save}</Button>
          </>
        }
      >
        {draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label={t.fName} required error={errors.name} full>
              <input style={styles.input} value={draft.name} onChange={(e) => update("name", e.target.value)} />
              {editing && normName(editing.name) !== normName(draft.name) && clientsCount(editing) > 0 && (
                <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.renameHint}</div>
              )}
            </Field>

            <Field label={t.fColor} full>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CONTRACTOR_COLORS.map((col) => (
                  <button
                    key={col} type="button" aria-label={col} aria-pressed={draft.color === col} onClick={() => update("color", col)}
                    style={{ width: 32, height: 32, borderRadius: 99, background: col, border: draft.color === col ? `3px solid ${COLORS.ink}` : `2px solid ${COLORS.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    {draft.color === col && <Check size={14} color="#fff" />}
                  </button>
                ))}
              </div>
            </Field>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" checked={!!draft.isDirect} onChange={(e) => update("isDirect", e.target.checked)} style={{ marginTop: 3 }} />
              <span><strong>{t.fIsDirect}</strong><br /><span style={{ color: COLORS.ink3, fontSize: 12 }}>{t.fIsDirectHint}</span></span>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {!draft.isDirect && (
                <Field label={t.fRate} error={errors.rate}>
                  <input style={styles.input} type="number" min="0" step="0.01" value={draft.rate} onChange={(e) => update("rate", e.target.value)} />
                  <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.fRateHint}</div>
                </Field>
              )}
              <Field label={t.fStaffRate} error={errors.staffRate}>
                <input style={styles.input} type="number" min="0" step="0.01" value={draft.staffRate} onChange={(e) => update("staffRate", e.target.value)} />
                <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.fStaffRateHint}</div>
              </Field>
              <Field label={t.fBillingDay} error={errors.billingDay}>
                <input style={styles.input} type="number" min="1" max="31" value={draft.billingDay} onChange={(e) => update("billingDay", e.target.value)} />
              </Field>
              <Field label={t.fPaymentDays} error={errors.paymentDays}>
                <input style={styles.input} type="number" min="0" max="365" value={draft.paymentDays} onChange={(e) => update("paymentDays", e.target.value)} />
              </Field>
              <Field label={t.fContactName}><input style={styles.input} value={draft.contactName} onChange={(e) => update("contactName", e.target.value)} /></Field>
              <Field label={t.fEmail}><input style={styles.input} type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} /></Field>
            </div>
            <Field label={t.fNote} full>
              <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={draft.note} onChange={(e) => update("note", e.target.value)} />
            </Field>

            {editing && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t.clientsTitle} <span style={{ color: COLORS.ink3, fontWeight: 500 }}>({draftClients.length})</span></div>
                {draftClients.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noClients}</div>
                ) : (
                  <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 8, padding: "8px 12px", fontSize: 11.5, fontWeight: 600, color: COLORS.ink3, background: COLORS.bg }}>
                      <span style={{ flex: 2 }}>{t.colClient}</span><span style={{ flex: 1, textAlign: "right" }}>{t.colPaysEmployee}</span><span style={{ flex: 1, textAlign: "right" }}>{t.colMargin}</span>
                    </div>
                    {draftClients.map((cl) => {
                      const m = marginPerHour(editing, cl);
                      return (
                        <div key={cl.id} style={{ display: "flex", gap: 8, padding: "9px 12px", fontSize: 13, borderTop: `1px solid ${COLORS.lineSoft}` }}>
                          <span style={{ flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cl.name}</span>
                          <span style={{ flex: 1, textAlign: "right" }}>{eur(cl.valueHour)}</span>
                          <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: m === null ? COLORS.ink3 : m < 0 ? COLORS.alert : COLORS.forest800 }}>{m === null ? "—" : `${eur(m)}/h`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 6 }}>{t.clientsHint}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title={t.deleteTitle}
        body={t.deleteBody(editing ? editing.name : "")}
        cancelLabel={c0.cancel}
        confirmLabel={c0.confirmDelete}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => { onDeleteContractor(editing.id); close(); }}
      />
    </div>
  );
}

export default ContratantesScreen;
