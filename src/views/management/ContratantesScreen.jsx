import { useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { FIN } from "../../models/i18nFin.js";
import { contractorPeriods, contractorCyclePeriods, cycleWindows } from "../../models/contractorStats.js";
import { ContractorsOverview } from "./finance/ContractorsOverview.jsx";
import { ContractorDetail } from "./finance/ContractorDetail.jsx";
import { T } from "../../models/i18n.js";
import { Field } from "../shared/Layout.jsx";
import { formatPeriodLabel } from "../../models/utils.js";
import { PageHeader, Pill, Drawer, Button, ConfirmDialog, Card } from "../shared/ui/index.js";
import {
  CONTRACTOR_COLORS, CONTRACTOR_COLOR_NAMES, nextContractorColor, EMPTY_CONTRACTOR, normName, contractorNameTaken, clientsOfContractor,
  clientsWithoutContractor, marginPerHour, cycleConfig,
} from "../../models/contractors.js";

const eur = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : `${Number(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

// Contratantes: quem paga à empresa pelas horas dos clientes. Esta página é
// só da gerência (os valores são confidenciais: a tabela nem é legível para
// funcionários). Cada contratante tem o seu valor/hora, o valor/hora padrão
// pago ao funcionário (pré-preenche os clientes novos), o dia de faturação e
// o prazo de pagamento; os clientes ligam-se a ele pelo nome (origem).
function ContratantesScreen({ lang, setLang, contractors, setContractors, onDeleteContractor, clients, setClients, staff, horasData, closedPeriods, cutoffDay, assignments, covers, absences, closings, onSaveClosing, companyName, companyInfo, who, onNavigate, navIntent }) {
  const t = T[lang].contratantes;
  const tier = useBreakpoint();
  const [detailId, setDetailId] = useState(navIntent && navIntent.contractorId != null ? navIntent.contractorId : null);
  const [detailTab, setDetailTab] = useState(navIntent && navIntent.tab ? navIntent.tab : null);
  // 12 períodos (11 fechados + o aberto): a partir daí liberta-se o filtro 6 | 12 meses.
  const periods = useMemo(
    () => contractorPeriods({ closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, today: TODAY, lang, count: 12 }),
    [closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, lang],
  );
  const detail = detailId != null ? contractors.find((c) => c.id === detailId) : null;
  // Contratante com ciclo próprio: o detalhe, o relatório e o fecho seguem os ciclos dele.
  const detailPeriods = useMemo(
    () => (detail && cycleConfig(detail)
      ? contractorCyclePeriods({ contractor: detail, closedPeriods, horasData, staff, clients, contractors, closings, today: TODAY, lang, count: 12 })
      : periods),
    [detail, periods, closedPeriods, horasData, staff, clients, contractors, closings, lang],
  );
  const has12 = detailPeriods.length >= 12;
  const c0 = T[lang].common;

  const [editingId, setEditingId] = useState(null); // id | "new" | null
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cycleCustom, setCycleCustom] = useState(false);

  const editing = editingId && editingId !== "new" ? contractors.find((c) => c.id === editingId) : null;
  const unassigned = clientsWithoutContractor(clients, contractors);

  function openNew() { setDraft({ ...EMPTY_CONTRACTOR, color: nextContractorColor(contractors) }); setCycleCustom(false); setErrors({}); setEditingId("new"); }
  function openEdit(c) { setDraft({ ...EMPTY_CONTRACTOR, ...c }); setCycleCustom(!!cycleConfig(c)); setErrors({}); setEditingId(c.id); }
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
    if (cycleCustom) {
      const sd = num(draft.periodStartDay), ed = num(draft.periodEndDay), pm = num(draft.periodMonths) || 1;
      if (!(Number.isInteger(sd) && sd >= 1 && sd <= 31)) errs.periodStartDay = t.dayInvalid;
      if (!(Number.isInteger(ed) && ed >= 1 && ed <= 31)) errs.periodEndDay = t.dayInvalid;
      if (pm > 1 && !/^\d{4}-\d{2}-\d{2}$/.test(draft.periodAnchor || "")) errs.periodAnchor = t.cycleAnchorNeeded;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const cycleFields = cycleCustom
      ? { periodMonths: Number(draft.periodMonths) || 1, periodAnchor: (Number(draft.periodMonths) || 1) > 1 ? draft.periodAnchor : "" }
      : { periodStartDay: "", periodEndDay: "", periodMonths: "", periodAnchor: "" };
    const clean = { ...draft, name, rate: draft.isDirect ? "" : draft.rate, ...cycleFields };
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

  // Exemplo do ciclo que o formulário vai criar (o mais recente já começado).
  const cycleExample = (() => {
    if (!cycleCustom || !draft) return "";
    const probe = { periodStartDay: draft.periodStartDay, periodEndDay: draft.periodEndDay, periodMonths: Number(draft.periodMonths) || 1, periodAnchor: draft.periodAnchor };
    if (!cycleConfig(probe)) return "";
    const w = cycleWindows(probe, TODAY, 1)[0];
    return w ? formatPeriodLabel({ start: w.start, end: w.end }, lang) : "";
  })();

  const draftClients = editing ? clientsOfContractor(clients, editing) : [];
  const hasClosings = !!editing && (closings || []).some((r) => String(r.contractorId) === String(editing.id));
  const blockedDelete = draftClients.length > 0 || hasClosings;

  return (
    <div style={styles.content}>
      {detail ? (
        <ContractorDetail
          lang={lang} tier={tier} contractor={detail} clients={clients} periods={detailPeriods} has12={has12}
          initialTab={detailTab} onSetClientPrice={(id, v) => setClients((prev) => prev.map((cl) => (cl.id === id ? { ...cl, sellPrice: v } : cl)))}
          closings={closings} horasData={horasData} staff={staff} assignments={assignments} covers={covers} absences={absences}
          cutoffDay={cutoffDay} closedPeriods={closedPeriods} onSaveClosing={onSaveClosing} companyName={companyName} companyInfo={companyInfo} who={who} onNavigate={onNavigate}
          onBack={() => { setDetailId(null); setDetailTab(null); }} onEdit={() => openEdit(detail)}
        />
      ) : (
      <>
      <PageHeader
        title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES}
        actions={tier === "mobile" ? null : <Button icon={Plus} onClick={openNew}>{t.newContractor}</Button>}
      />
      {tier === "mobile" && <Button icon={Plus} onClick={openNew} style={{ width: "100%", marginBottom: 14 }}>{t.newContractor}</Button>}

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
        : <ContractorsOverview lang={lang} tier={tier} contractors={contractors} clients={clients} periods={periods} closings={closings} today={TODAY} onOpen={(c) => { setDetailTab(null); setDetailId(c.id); }} onDefineDay={openEdit} />}
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
            {editing && <Button variant="dangerSoft" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={blockedDelete} disabledReason={blockedDelete ? (draftClients.length > 0 ? t.deleteBlocked(draftClients.length) : FIN[lang].deleteBlockedClosings) : undefined}>{c0.delete}</Button>}
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
                {CONTRACTOR_COLORS.map((col, ci) => (
                  <button
                    key={col} type="button" aria-label={(CONTRACTOR_COLOR_NAMES[lang] || CONTRACTOR_COLOR_NAMES.pt)[ci]} title={(CONTRACTOR_COLOR_NAMES[lang] || CONTRACTOR_COLOR_NAMES.pt)[ci]} aria-pressed={draft.color === col} onClick={() => update("color", col)}
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
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{t.cycleTitle}</div>
                <select style={styles.input} value={cycleCustom ? "custom" : "general"} onChange={(e) => setCycleCustom(e.target.value === "custom")}>
                  <option value="general">{t.cycleGeneral}</option>
                  <option value="custom">{t.cycleCustom}</option>
                </select>
                {cycleCustom && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                    <Field label={t.cycleStart} error={errors.periodStartDay}>
                      <input style={styles.input} type="number" min="1" max="31" value={draft.periodStartDay} onChange={(e) => update("periodStartDay", e.target.value)} />
                    </Field>
                    <Field label={t.cycleEnd} error={errors.periodEndDay}>
                      <input style={styles.input} type="number" min="1" max="31" value={draft.periodEndDay} onChange={(e) => update("periodEndDay", e.target.value)} />
                    </Field>
                    <Field label={t.cycleEvery}>
                      <select style={styles.input} value={draft.periodMonths || 1} onChange={(e) => update("periodMonths", Number(e.target.value))}>
                        {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{t.cycleMonths(n)}</option>)}
                      </select>
                    </Field>
                    {(Number(draft.periodMonths) || 1) > 1 && (
                      <Field label={t.cycleAnchor} error={errors.periodAnchor}>
                        <input style={styles.input} type="date" value={draft.periodAnchor || ""} onChange={(e) => update("periodAnchor", e.target.value)} />
                        <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.cycleAnchorHint}</div>
                      </Field>
                    )}
                    {cycleExample && <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: COLORS.ink2 }}>{t.cycleExample(cycleExample)} · {t.cycleBillingHint}</div>}
                  </div>
                )}
              </div>
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
