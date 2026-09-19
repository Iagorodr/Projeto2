import { useState } from "react";
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
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";

function DefinicoesScreen({ lang, setLang, company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays, reclamacaoRatioClients, setReclamacaoRatioClients }) {
  const [nameDraft, setNameDraft] = useState(company.name);
  const [emailDraft, setEmailDraft] = useState(company.email);
  const [hasPhotoDraft, setHasPhotoDraft] = useState(company.hasPhoto);
  const [companyPasswordDraft, setCompanyPasswordDraft] = useState("");
  const [saved, setSaved] = useState(false);

  const profileDirty = nameDraft !== company.name || emailDraft !== company.email || hasPhotoDraft !== company.hasPhoto || companyPasswordDraft.trim() !== "";

  function handleSave() {
    setCompany((c) => ({
      ...c,
      name: nameDraft,
      email: emailDraft,
      hasPhoto: hasPhotoDraft,
      password: companyPasswordDraft.trim() ? companyPasswordDraft.trim() : c.password,
    }));
    setCompanyPasswordDraft("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />
      <h1 style={styles.title}>DEFINIÇÕES</h1>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>Perfil da empresa</div>
        <div style={styles.defProfileRow}>
          <div style={styles.defPhotoBlock}>
            <div style={styles.defPhotoCircle}>
              {!hasPhotoDraft && <span style={styles.defPhotoInitial}>{nameDraft.slice(0, 1)}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.defPhotoButton} onClick={() => setHasPhotoDraft(true)}>Alterar foto</button>
              {hasPhotoDraft && <button style={styles.defPhotoButtonOutline} onClick={() => setHasPhotoDraft(false)}>Remover foto</button>}
            </div>
          </div>
          <div style={styles.defProfileFields}>
            <div>
              <div style={styles.defSettingLabel}>Nome da empresa</div>
              <input style={styles.defTextInput} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            </div>
            <div>
              <div style={styles.defSettingLabel}>Email</div>
              <input style={styles.defTextInput} value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} />
            </div>
            <div>
              <div style={styles.defSettingLabel}>Nova senha</div>
              <input type="password" style={styles.defTextInput} placeholder="••••••••" value={companyPasswordDraft} onChange={(e) => setCompanyPasswordDraft(e.target.value)} />
              <div style={styles.defSettingHint}>Deixe em branco para manter a senha atual.</div>
            </div>
            {profileDirty && <div style={{ ...styles.defSettingHint, color: COLORS.extra }}>Há alterações no perfil ainda não guardadas.</div>}
          </div>
        </div>
      </div>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>Pagamento</div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>Dia de fechamento do período</div>
            <div style={styles.defSettingHint}>Controla tanto o relatório de pagamento em Horas quanto o corte automático de semana no registo do funcionário. Um valor único para toda a empresa.</div>
          </div>
          <input type="number" min={1} max={31} style={styles.defNumberInput} value={cutoffDay} onChange={(e) => setCutoffDay(Number(e.target.value))} />
        </div>
      </div>

      <div style={styles.defSettingsCard}>
        <div style={styles.sectionTitle}>Alertas</div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>Avisar quando um contrato estiver a vencer em (dias)</div>
          </div>
          <input type="number" min={1} style={styles.defNumberInput} value={contractAlertDays} onChange={(e) => setContractAlertDays(Number(e.target.value))} />
        </div>
        <div style={styles.defSettingRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.defSettingLabel}>Medidor de Reclamações: 1 reclamação razoável a cada quantos clientes?</div>
            <div style={styles.defSettingHint}>0 reclamações é excelente; a partir do dobro desse número, fica crítico.</div>
          </div>
          <input type="number" min={1} style={styles.defNumberInput} value={reclamacaoRatioClients} onChange={(e) => setReclamacaoRatioClients(Number(e.target.value))} />
        </div>
      </div>

      <div style={styles.defSaveRow}>
        {saved && <span style={styles.defSavedNote}><Check size={13} style={{ marginRight: 4 }} />Alterações guardadas</span>}
        <button style={styles.saveButton} onClick={handleSave}>Guardar alterações</button>
      </div>
    </div>
  );
}

export default DefinicoesScreen;
