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
import { SectionHeader, ItemListSimple } from "../shared/AvisosWidgets.jsx";

function AvisosScreen({ lang, setLang, staff, clients, missingItems, setMissingItems, sentItems, setSentItems, setHorasData }) {
  const [formType, setFormType] = useState("reclamacao");
  const [formStaffId, setFormStaffId] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formText, setFormText] = useState("");
  const [formPhoto, setFormPhoto] = useState(false);
  const [sentToast, setSentToast] = useState(false);

  const [missingOpen, setMissingOpen] = useState(true);
  const [complaintsOpen, setComplaintsOpen] = useState(false);
  const [praiseOpen, setPraiseOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [replyingId, setReplyingId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");

  const complaints = sentItems.filter((i) => i.type === "reclamacao");
  const praises = sentItems.filter((i) => i.type === "elogio");
  const notices = sentItems.filter((i) => i.type === "aviso");

  function handleSend() {
    if (!formStaffId || !formClientId || !formText.trim()) return;
    setSentItems((prev) => [{ id: Date.now(), type: formType, staffId: Number(formStaffId), clientId: Number(formClientId), text: formText.trim(), date: "16/09", hasPhoto: formPhoto }, ...prev]);
    setFormStaffId(""); setFormClientId(""); setFormText(""); setFormPhoto(false);
    setSentToast(true); setTimeout(() => setSentToast(false), 1800);
  }
  function toggleResolved(id) {
    const item = missingItems.find((m) => m.id === id);
    setMissingItems((prev) => prev.map((m) => (m.id === id ? { ...m, resolved: !m.resolved } : m)));
    if (item && item.kind === "correcao" && !item.resolved) {
      setHorasData((prev) => ({
        ...prev,
        [item.staffId]: { ...(prev[item.staffId] || { entries: [], paid: false }), status: "pendente", lockedWeeks: {}, reopened: true },
      }));
    }
  }
  function startReply(id, current) { setReplyingId(id); setReplyDraft(current || ""); }
  function sendReply(id) { setMissingItems((prev) => prev.map((m) => (m.id === id ? { ...m, response: replyDraft.trim() } : m))); setReplyingId(null); }

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />
      <h1 style={styles.title}>AVISOS</h1>

      <div style={styles.avFormCard}>
        <div style={styles.avTypeToggleRow}>
          <button style={{ ...styles.avTypeToggle, ...(formType === "reclamacao" ? styles.avTypeActiveComplaint : {}) }} onClick={() => setFormType("reclamacao")}>
            <MessageSquare size={13} style={{ marginRight: 6 }} />Reclamação
          </button>
          <button style={{ ...styles.avTypeToggle, ...(formType === "elogio" ? styles.avTypeActivePraise : {}) }} onClick={() => setFormType("elogio")}>
            <ThumbsUp size={13} style={{ marginRight: 6 }} />Elogio
          </button>
          <button style={{ ...styles.avTypeToggle, ...(formType === "aviso" ? styles.avTypeActiveNotice : {}) }} onClick={() => setFormType("aviso")}>
            <Info size={13} style={{ marginRight: 6 }} />Aviso
          </button>
        </div>

        <div style={styles.avFormRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.fieldLabel}>Funcionário</div>
            <select style={styles.input} value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)}>
              <option value="">Escolha</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.fieldLabel}>Cliente</div>
            <select style={styles.input} value={formClientId} onChange={(e) => setFormClientId(e.target.value)}>
              <option value="">Escolha</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={styles.fieldLabel}>Texto</div>
          <textarea style={styles.textarea} rows={3} placeholder="Escreva a mensagem..." value={formText} onChange={(e) => setFormText(e.target.value)} />
        </div>

        <div style={styles.avFormFooterRow}>
          <button style={{ ...styles.avAttachButton, ...(formPhoto ? styles.avAttachActive : {}) }} onClick={() => setFormPhoto((p) => !p)}>
            <span style={{ marginRight: 6 }}>📎</span>{formPhoto ? "Foto anexada" : "Anexar foto (opcional)"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {sentToast && <span style={styles.avSentNote}>Enviado</span>}
            <button style={{ ...styles.saveButton, opacity: formStaffId && formClientId && formText.trim() ? 1 : 0.5 }} disabled={!formStaffId || !formClientId || !formText.trim()} onClick={handleSend}>Enviar</button>
          </div>
        </div>
      </div>

      <SectionHeader icon={PackageX} title="Solicitações" count={missingItems.filter((m) => !m.resolved).length} open={missingOpen} onToggle={() => setMissingOpen((o) => !o)} />
      {missingOpen && (
        <div style={styles.avItemsList}>
          {missingItems.length === 0 ? <div style={styles.avNoItems}>Nada por aqui ainda.</div> : missingItems.map((m) => {
            const s = staffById(staff, m.staffId), c = m.clientId ? clientById(clients, m.clientId) : null;
            return (
              <div key={m.id} style={styles.avItemCard}>
                <div style={styles.avItemTopRow}>
                  <div>
                    <div style={styles.avItemTitle}>
                      {s ? s.name : "—"} · {m.kind === "correcao" ? "Correção de horas" : c ? c.name : "—"}
                    </div>
                    <div style={styles.avItemDate}>{m.date}</div>
                  </div>
                  <span style={{ ...styles.statusBadge, ...(m.resolved ? styles.statusActive : styles.statusInactive) }}>{m.resolved ? "Resolvido" : "Pendente"}</span>
                </div>
                <div style={styles.avItemText}>{m.text}</div>
                {m.response && replyingId !== m.id && (
                  <div style={styles.avResponseBox}><div style={styles.avResponseLabel}>Sua resposta</div><div style={styles.avItemText}>{m.response}</div></div>
                )}
                {replyingId === m.id ? (
                  <div style={styles.avResponseBox}>
                    <textarea style={styles.textarea} rows={2} placeholder="Escreva uma resposta..." value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
                    <button style={styles.avSendButtonSmall} onClick={() => sendReply(m.id)}>Enviar resposta</button>
                  </div>
                ) : (
                  <div style={styles.avItemActions}>
                    <button style={styles.avActionOutline} onClick={() => startReply(m.id, m.response)}>Responder</button>
                    <button style={styles.avActionOutline} onClick={() => toggleResolved(m.id)}>
                      {m.resolved ? "Marcar como pendente" : m.kind === "correcao" ? "Aprovar e reabrir período" : "Marcar como resolvido"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SectionHeader icon={MessageSquare} title="Reclamações enviadas" count={complaints.length} open={complaintsOpen} onToggle={() => setComplaintsOpen((o) => !o)} />
      {complaintsOpen && <ItemListSimple items={complaints} staff={staff} clients={clients} />}

      <SectionHeader icon={ThumbsUp} title="Elogios" count={praises.length} open={praiseOpen} onToggle={() => setPraiseOpen((o) => !o)} />
      {praiseOpen && <ItemListSimple items={praises} staff={staff} clients={clients} />}

      <SectionHeader icon={Info} title="Avisos gerais" count={notices.length} open={noticesOpen} onToggle={() => setNoticesOpen((o) => !o)} />
      {noticesOpen && <ItemListSimple items={notices} staff={staff} clients={clients} />}
    </div>
  );
}

export default AvisosScreen;
