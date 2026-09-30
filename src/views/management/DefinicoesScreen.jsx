import { useState, useRef } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, MENU_ITEMS,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours,
} from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";
import { supabase } from "../../models/supabaseClient.js";

function DefinicoesScreen({ lang, setLang, company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays, reclamacaoBaseClients, setReclamacaoBaseClients, reclamacaoExcelenteCount, setReclamacaoExcelenteCount, reclamacaoRazoavelCount, setReclamacaoRazoavelCount, clients, onFormatData, onVerifyPassword }) {
  const t = T[lang].definicoes;
  const c0 = T[lang].common;
  const [nameDraft, setNameDraft] = useState(company.name);
  const [emailDraft, setEmailDraft] = useState(company.email);
  const [photoDraft, setPhotoDraft] = useState(company.photoUrl || null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [formatPassword, setFormatPassword] = useState("");
  const [formatError, setFormatError] = useState(false);
  const [formatBusy, setFormatBusy] = useState(false);
  const [formatDone, setFormatDone] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwNew, setPwNew] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwError, setPwError] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);

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
    setCompany((c) => ({
      ...c,
      name: nameDraft,
      email: emailDraft,
      photoUrl: photoDraft,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function openFormatModal() {
    setFormatPassword("");
    setFormatError(false);
    setFormatDone(false);
    setFormatModalOpen(true);
  }
  function closeFormatModal() {
    if (formatBusy) return;
    setFormatModalOpen(false);
  }
  async function handleFormatConfirm() {
    if (!formatPassword.trim()) return;
    setFormatBusy(true);
    setFormatError(false);
    const ok = await onVerifyPassword(formatPassword);
    if (!ok) {
      setFormatBusy(false);
      setFormatError(true);
      return;
    }
    await onFormatData();
    setFormatBusy(false);
    setFormatDone(true);
    setFormatPassword("");
  }

  function openPwModal() {
    setPwNew(""); setPwCurrent(""); setPwError(null); setPwDone(false); setPwModalOpen(true);
  }
  function closePwModal() {
    if (pwBusy) return;
    setPwModalOpen(false);
  }
  // Muda a senha real de login da própria gerência (Supabase Auth), via a
  // mesma Edge Function update-staff-password usada em Acessos — exige
  // reconfirmar a senha atual antes, igual ao fluxo de "Formatar dados".
  async function handlePwConfirm() {
    if (pwNew.trim().length < 6) { setPwError(t.changePasswordTooShort); return; }
    if (!pwCurrent.trim()) return;
    setPwBusy(true);
    setPwError(null);
    const ok = await onVerifyPassword(pwCurrent);
    if (!ok) {
      setPwBusy(false);
      setPwError(c0.wrongPassword);
      return;
    }
    if (!supabase) {
      setPwBusy(false);
      setPwError(t.changePasswordFailed);
      return;
    }
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

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />
      <h1 style={styles.title}>{t.title}</h1>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>{t.companyProfile}</div>
        <div style={styles.defProfileRow}>
          <div style={styles.defPhotoBlock}>
            <div style={styles.defPhotoCircle}>
              {photoDraft ? (
                <img src={photoDraft} alt="" style={styles.defPhotoImg} />
              ) : (
                <span style={styles.defPhotoInitial}>{nameDraft.slice(0, 1)}</span>
              )}
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
              <div style={styles.defSettingLabel}>{t.newPassword}</div>
              <button type="button" style={styles.editButton} onClick={openPwModal}>{t.changePasswordButton}</button>
              <div style={styles.defSettingHint}>{t.changePasswordHint}</div>
            </div>
            {profileDirty && <div style={{ ...styles.defSettingHint, color: COLORS.extra }}>{t.unsavedChanges}</div>}
          </div>
        </div>
      </div>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>{t.payment}</div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>{t.cutoffLabel}</div>
            <div style={styles.defSettingHint}>{t.cutoffHint}</div>
          </div>
          <input type="number" min={1} max={31} style={styles.defNumberInput} value={cutoffDay} onChange={(e) => setCutoffDay(Number(e.target.value))} />
        </div>
      </div>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>{t.alerts}</div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>{t.contractAlertLabel}</div>
          </div>
          <input type="number" min={1} style={styles.defNumberInput} value={contractAlertDays} onChange={(e) => setContractAlertDays(Number(e.target.value))} />
        </div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>{t.gaugeBaseLabel}</div>
            <div style={styles.defSettingHint}>{t.gaugeBaseHint}</div>
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
            <div style={styles.defSettingHint}>
              {t.gaugeExample(
                clients.length,
                Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1))),
                Math.max(1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3))),
                T[lang].dashboard.gaugeExcelente,
                T[lang].dashboard.gaugeRazoavel,
                T[lang].dashboard.gaugeCritico
              )}
            </div>
          </div>
          <input type="number" min={1} style={styles.defNumberInput} value={reclamacaoRazoavelCount} onChange={(e) => setReclamacaoRazoavelCount(Number(e.target.value))} />
        </div>
      </div>

      <div style={styles.defSaveRow}>
        {saved && <span style={styles.defSavedNote}><Check size={13} style={{ marginRight: 4 }} />{t.saved}</span>}
        <button style={styles.saveButton} onClick={handleSave}>{c0.saveChanges}</button>
      </div>

      <div style={{ ...styles.defSettingsCard, border: `1px solid ${COLORS.extra}` }}>
        <div style={{ ...styles.sectionTitle, color: COLORS.extra }}>{t.dangerZoneTitle}</div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingHint}>{t.formatDataWarningBody}</div>
          </div>
          <button
            style={{ ...styles.editButton, background: COLORS.extraTint, color: COLORS.extra, flexShrink: 0 }}
            onClick={openFormatModal}
          >
            {t.formatDataButton}
          </button>
        </div>
      </div>

      {formatModalOpen && (
        <div style={styles.modalOverlay} onClick={closeFormatModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{t.formatDataWarningTitle}</div>
              <button style={styles.modalClose} onClick={closeFormatModal}><X size={16} /></button>
            </div>

            {formatDone ? (
              <>
                <div style={{ ...styles.defSettingHint, marginBottom: 16, color: COLORS.primaryDark, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} />{t.formatDataSuccess}
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.saveButton} onClick={() => setFormatModalOpen(false)}>{c0.save}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ ...styles.defSettingHint, marginBottom: 16 }}>{t.formatDataWarningBody}</div>
                <div>
                  <div style={styles.defSettingLabel}>{t.formatDataPasswordLabel}</div>
                  <input
                    type="password"
                    style={styles.defTextInput}
                    placeholder="••••••••"
                    value={formatPassword}
                    onChange={(e) => { setFormatPassword(e.target.value); setFormatError(false); }}
                  />
                  {formatError && <div style={{ ...styles.defSettingHint, color: COLORS.extra }}>{c0.wrongPassword}</div>}
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.cancelButton} onClick={closeFormatModal} disabled={formatBusy}>{c0.cancel}</button>
                  <button
                    style={{ ...styles.saveButton, background: COLORS.extra, opacity: formatBusy || !formatPassword.trim() ? 0.6 : 1 }}
                    onClick={handleFormatConfirm}
                    disabled={formatBusy || !formatPassword.trim()}
                  >
                    {t.formatDataConfirmButton}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {pwModalOpen && (
        <div style={styles.modalOverlay} onClick={closePwModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{t.changePasswordModalTitle}</div>
              <button style={styles.modalClose} onClick={closePwModal}><X size={16} /></button>
            </div>

            {pwDone ? (
              <>
                <div style={{ ...styles.defSettingHint, marginBottom: 16, color: COLORS.primaryDark, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} />{t.changePasswordSuccess}
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.saveButton} onClick={() => setPwModalOpen(false)}>{c0.save}</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={styles.defSettingLabel}>{t.changePasswordNewLabel}</div>
                  <input
                    type="password"
                    style={styles.defTextInput}
                    placeholder="••••••••"
                    value={pwNew}
                    onChange={(e) => { setPwNew(e.target.value); setPwError(null); }}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={styles.defSettingLabel}>{t.changePasswordCurrentLabel}</div>
                  <input
                    type="password"
                    style={styles.defTextInput}
                    placeholder="••••••••"
                    value={pwCurrent}
                    onChange={(e) => { setPwCurrent(e.target.value); setPwError(null); }}
                  />
                  {pwError && <div style={{ ...styles.defSettingHint, color: COLORS.extra }}>{pwError}</div>}
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.cancelButton} onClick={closePwModal} disabled={pwBusy}>{c0.cancel}</button>
                  <button
                    style={{ ...styles.saveButton, opacity: pwBusy || pwNew.trim().length < 6 || !pwCurrent.trim() ? 0.6 : 1 }}
                    onClick={handlePwConfirm}
                    disabled={pwBusy || pwNew.trim().length < 6 || !pwCurrent.trim()}
                  >
                    {pwBusy ? t.changePasswordBusy : t.changePasswordConfirmButton}
                  </button>
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
