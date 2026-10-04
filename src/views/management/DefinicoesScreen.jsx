import { useRef, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { PageHeader, Card, Button, ConfirmDialog, SegmentedBar, InfoTip } from "../shared/ui/index.js";
import { supabase } from "../../models/supabaseClient.js";

// Diálogo simples de "feito" (um botão só) — reaproveitado pelo sucesso de
// "Formatar dados" e pela troca de palavra-passe da empresa, pra não
// repetir a mesma moldura de overlay/cartão três vezes neste ficheiro.
function InfoDialog({ open, title, children, closeLabel, onClose }) {
  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: 420, maxWidth: "100%", borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 22 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" onClick={onClose}>{closeLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// Secção da navegação lateral (documento, 4.11): "navegação interna à
// esquerda (pegajosa: Perfil, Pagamento, Alertas, Zona de risco)".
const SECTIONS = [
  { id: "perfil", labelKey: "navProfile" },
  { id: "pagamento", labelKey: "navPayment" },
  { id: "alertas", labelKey: "navAlerts" },
  { id: "risco", labelKey: "navDanger" },
];

// Definições (documento de design, 4.11) — a segurança (Edge Function
// update-staff-password, RLS) já foi construída na Etapa 0b; aqui é só o
// redesign visual: navegação lateral, cartões (máx. 720), confirmação
// escrita ao mudar o dia de fecho, pré-visualização ao vivo das faixas de
// reclamações, "Formatar dados" com palavra digitada em vez de
// palavra-passe, e barra de guardar fixa no lugar da frase vermelha.
function DefinicoesScreen({ lang, setLang, company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays, reclamacaoBaseClients, setReclamacaoBaseClients, reclamacaoExcelenteCount, setReclamacaoExcelenteCount, reclamacaoRazoavelCount, setReclamacaoRazoavelCount, clients, onFormatData, onVerifyPassword }) {
  const t = T[lang].definicoes;
  const c0 = T[lang].common;

  const [activeSection, setActiveSection] = useState("perfil");
  const sectionRefs = {
    perfil: useRef(null), pagamento: useRef(null), alertas: useRef(null), risco: useRef(null),
  };
  function goToSection(id) {
    setActiveSection(id);
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // --- Perfil da empresa (gravado só ao clicar "Guardar alterações") ---
  const [nameDraft, setNameDraft] = useState(company.name);
  const [emailDraft, setEmailDraft] = useState(company.email);
  const [photoDraft, setPhotoDraft] = useState(company.photoUrl || null);
  const fileInputRef = useRef(null);
  const profileDirty = nameDraft !== company.name || emailDraft !== company.email || photoDraft !== (company.photoUrl || null);

  function handlePhotoPick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDraft(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function handleSave() {
    setCompany((c) => ({ ...c, name: nameDraft, email: emailDraft, photoUrl: photoDraft }));
  }
  function handleDiscard() {
    setNameDraft(company.name); setEmailDraft(company.email); setPhotoDraft(company.photoUrl || null);
  }

  // --- Trocar palavra-passe real da empresa (já ligado à Edge Function) ---
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwNew, setPwNew] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwError, setPwError] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  function openPwModal() { setPwNew(""); setPwCurrent(""); setPwError(null); setPwDone(false); setPwModalOpen(true); }
  function closePwModal() { if (!pwBusy) setPwModalOpen(false); }
  async function handlePwConfirm() {
    if (pwNew.trim().length < 6) { setPwError(t.changePasswordTooShort); return; }
    if (!pwCurrent.trim()) return;
    setPwBusy(true);
    setPwError(null);
    const ok = await onVerifyPassword(pwCurrent);
    if (!ok) { setPwBusy(false); setPwError(c0.wrongPassword); return; }
    if (!supabase) { setPwBusy(false); setPwError(t.changePasswordFailed); return; }
    try {
      const { data, error } = await supabase.functions.invoke("update-staff-password", {
        body: { email: company.email, newPassword: pwNew.trim() },
      });
      if (error || data?.error) throw error || new Error(data.error);
      setPwDone(true);
      setPwCurrent(""); setPwNew("");
    } catch {
      setPwError(t.changePasswordFailed);
    } finally {
      setPwBusy(false);
    }
  }

  // --- Dia de fecho do período — pede confirmação escrita antes de aplicar ---
  const [cutoffInput, setCutoffInput] = useState(cutoffDay);
  const [pendingCutoff, setPendingCutoff] = useState(null);
  function commitCutoffIfChanged() {
    const n = Number(cutoffInput);
    // `Number("")` é 0 (finito!), por isso o campo vazio precisa de uma
    // checagem própria além de `isFinite` — senão limpar o campo e sair
    // abriria a confirmação pedindo pra mudar o fecho pro dia 0.
    if (cutoffInput === "" || !Number.isFinite(n) || n < 1 || n > 28 || n === cutoffDay) { setCutoffInput(cutoffDay); return; }
    setPendingCutoff(n);
  }

  // --- Pré-visualização ao vivo das faixas de reclamações (mesma fórmula
  // já usada no Dashboard — DashboardScreen.jsx) ---
  const excelenteThreshold = Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));

  // --- Formatar dados — confirmação escrita (palavra), não mais palavra-passe ---
  const [formatConfirmOpen, setFormatConfirmOpen] = useState(false);
  const [formatDoneOpen, setFormatDoneOpen] = useState(false);
  async function handleFormatConfirm() {
    await onFormatData();
    setFormatConfirmOpen(false);
    setFormatDoneOpen(true);
  }

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <nav style={{ position: "sticky", top: 24, width: 168, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => goToSection(sec.id)}
              style={{
                textAlign: "left", border: "none", cursor: "pointer",
                padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: activeSection === sec.id ? COLORS.forest700 : COLORS.ink2,
                background: activeSection === sec.id ? COLORS.forest50 : "transparent",
              }}
            >
              {t[sec.labelKey]}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, maxWidth: 720, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 90 }}>
          <div ref={sectionRefs.perfil}>
            <Card>
              <div style={styles.sectionTitle}>{t.companyProfile}</div>
              <div style={styles.defProfileRow}>
                <div style={styles.defPhotoBlock}>
                  <div style={styles.defPhotoCircle}>
                    {photoDraft ? <img src={photoDraft} alt="" style={styles.defPhotoImg} /> : <span style={styles.defPhotoInitial}>{nameDraft.slice(0, 1)}</span>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handlePhotoPick} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={styles.defPhotoButton} onClick={() => fileInputRef.current && fileInputRef.current.click()}>{t.changePhoto}</button>
                    {photoDraft && <button style={styles.defPhotoButtonOutline} onClick={() => setPhotoDraft(null)}>{t.removePhoto}</button>}
                  </div>
                  <div style={{ ...styles.defSettingHint, textAlign: "center", marginTop: 0 }}>{t.photoHint}</div>
                </div>
                <div style={styles.defProfileFields}>
                  <div>
                    <div style={styles.defSettingLabel}>{t.companyName}</div>
                    <input style={styles.defTextInput} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                  </div>
                  <div>
                    <div style={styles.defSettingLabel}>{t.email}</div>
                    <input style={styles.defTextInput} value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} />
                  </div>
                  <div>
                    {/* Lote 4, 4.5 (achado da Marta): hint fixo (11.5px)
                        vira (i) ao lado do rótulo. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <div style={styles.defSettingLabel}>{t.newPassword}</div>
                      <InfoTip text={t.changePasswordHint} label={c0.moreInfoLabel} />
                    </div>
                    <Button variant="secondary" onClick={openPwModal}>{t.changePasswordButton}</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div ref={sectionRefs.pagamento}>
            <Card>
              <div style={styles.sectionTitle}>{t.payment}</div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  {/* Lote 4, 4.5 (achado da Marta, cutoffHint): idem. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div style={styles.defSettingLabel}>{t.cutoffLabel}</div>
                    <InfoTip text={t.cutoffHint} label={c0.moreInfoLabel} />
                  </div>
                </div>
                <input
                  type="number" min={1} max={28} style={styles.defNumberInput}
                  value={cutoffInput}
                  onChange={(e) => setCutoffInput(e.target.value)}
                  onBlur={commitCutoffIfChanged}
                />
              </div>
            </Card>
          </div>

          <div ref={sectionRefs.alertas}>
            <Card>
              <div style={styles.sectionTitle}>{t.alerts}</div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.defSettingLabel}>{t.contractAlertLabel}</div>
                </div>
                <input type="number" min={1} style={styles.defNumberInput} value={contractAlertDays} onChange={(e) => setContractAlertDays(Number(e.target.value))} />
              </div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  {/* Lote 4, 4.5 (achado da Marta, gaugeBaseHint): idem. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div style={styles.defSettingLabel}>{t.gaugeBaseLabel}</div>
                    <InfoTip text={t.gaugeBaseHint} label={c0.moreInfoLabel} />
                  </div>
                </div>
                <input type="number" min={1} style={styles.defNumberInput} value={reclamacaoBaseClients} onChange={(e) => setReclamacaoBaseClients(Number(e.target.value))} />
              </div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.defSettingLabel}>{t.gaugeExcelenteCountLabel}</div>
                </div>
                <input type="number" min={0} style={styles.defNumberInput} value={reclamacaoExcelenteCount} onChange={(e) => setReclamacaoExcelenteCount(Number(e.target.value))} />
              </div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.defSettingLabel}>{t.gaugeRazoavelCountLabel}</div>
                </div>
                <input type="number" min={1} style={styles.defNumberInput} value={reclamacaoRazoavelCount} onChange={(e) => setReclamacaoRazoavelCount(Number(e.target.value))} />
              </div>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
                <div style={{ ...styles.defSettingLabel, marginBottom: 8 }}>{t.gaugePreviewLabel}</div>
                <SegmentedBar
                  height={10}
                  segments={[
                    { value: 1, color: COLORS.okTint },
                    { value: 1, color: "#FFF6E0" },
                    { value: 1, color: COLORS.alertTint },
                  ]}
                />
                <div style={{ ...styles.defSettingHint, marginTop: 8 }}>
                  {t.gaugeExample(
                    clients.length, excelenteThreshold, razoavelThreshold,
                    T[lang].dashboard.gaugeExcelente, T[lang].dashboard.gaugeRazoavel, T[lang].dashboard.gaugeCritico
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div ref={sectionRefs.risco}>
            <Card variant="alert">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={16} />
                <div style={{ ...styles.sectionTitle, margin: 0 }}>{t.dangerZoneTitle}</div>
              </div>
              <div style={styles.defSettingRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.defSettingHint, color: "inherit" }}>{t.formatDataWarningBody}</div>
                </div>
                <Button variant="dangerSolid" onClick={() => setFormatConfirmOpen(true)}>{t.formatDataButton}</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {profileDirty && (
        <div
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
            background: COLORS.card, borderTop: `1px solid ${COLORS.line}`, boxShadow: "0 -6px 18px -10px rgba(0,0,0,.18)",
            padding: "14px 32px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14,
          }}
        >
          <span style={{ fontSize: 13, color: COLORS.ink2, marginRight: "auto" }}>{t.unsavedChanges}</span>
          <Button variant="secondary" onClick={handleDiscard}>{c0.discard}</Button>
          <Button variant="primary" onClick={handleSave}>{c0.saveChanges}</Button>
        </div>
      )}

      <ConfirmDialog
        open={pendingCutoff !== null}
        title={t.cutoffConfirmTitle}
        body={t.cutoffConfirmBody}
        cancelLabel={c0.cancel}
        confirmLabel={c0.save}
        onCancel={() => { setPendingCutoff(null); setCutoffInput(cutoffDay); }}
        onConfirm={() => { setCutoffDay(pendingCutoff); setPendingCutoff(null); }}
      />

      <ConfirmDialog
        open={formatConfirmOpen}
        title={t.formatDataWarningTitle}
        body={t.formatDataWarningBody}
        cancelLabel={c0.cancel}
        confirmLabel={t.formatDataConfirmButton}
        destructive
        requireTypedWord={t.formatDataWord}
        typedWordHint={t.formatDataTypedWordHint}
        onCancel={() => setFormatConfirmOpen(false)}
        onConfirm={handleFormatConfirm}
      />

      <InfoDialog open={formatDoneOpen} title={t.formatDataWarningTitle} closeLabel={c0.close} onClose={() => setFormatDoneOpen(false)}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.forest700 }}><Check size={14} />{t.formatDataSuccess}</span>
      </InfoDialog>

      {pwModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closePwModal}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: 420, maxWidth: "100%", borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>{t.changePasswordModalTitle}</div>

            {pwDone ? (
              <>
                <div style={{ fontSize: 13.5, color: COLORS.forest700, display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                  <Check size={14} />{t.changePasswordSuccess}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="primary" onClick={() => setPwModalOpen(false)}>{c0.close}</Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <div style={styles.defSettingLabel}>{t.changePasswordNewLabel}</div>
                    <input
                      type="password" autoComplete="new-password" style={styles.defTextInput} placeholder="••••••••"
                      value={pwNew} onChange={(e) => { setPwNew(e.target.value); setPwError(null); }}
                    />
                  </div>
                  <div>
                    <div style={styles.defSettingLabel}>{t.changePasswordCurrentLabel}</div>
                    <input
                      type="password" style={styles.defTextInput} placeholder="••••••••"
                      value={pwCurrent} onChange={(e) => { setPwCurrent(e.target.value); setPwError(null); }}
                    />
                    {pwError && <div style={{ fontSize: 12, color: COLORS.alert, marginTop: 6 }}>{pwError}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                  <Button variant="secondary" onClick={closePwModal} disabled={pwBusy}>{c0.cancel}</Button>
                  <Button
                    variant="primary" onClick={handlePwConfirm} disabled={pwBusy || pwNew.trim().length < 6 || !pwCurrent.trim()}
                    disabledReason={pwBusy ? undefined : pwNew.trim().length < 6 ? t.changePasswordTooShort : !pwCurrent.trim() ? c0.requiredField : undefined}
                  >
                    {pwBusy ? t.changePasswordBusy : t.changePasswordConfirmButton}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DefinicoesScreen;
