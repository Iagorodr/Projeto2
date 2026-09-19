import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, WEEKDAY_FULL_PT, DAY_ABBR_SUN0_PT,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  startOfISOWeek, addDays, isoDateStr, weekDiff, clientAppliesThisWeek, weekLabelPT,
  getAssignedClientIds, recomputeSharedHours, getCutoffPeriod, formatPeriodLabel,
  getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk,
  buildWeekChunkSequence, weekChunksOfPayPeriod, calPeriodDays, calPeriodLabel,
} from "../../models/utils.js";
import { EMP_T } from "../../models/translations.js";
import { LangSwitcher } from "../shared/Layout.jsx";

function EmployeeAvisosScreen({ lang, setLang, onHome, staffId, clients, staff, assignments, missingItems, setMissingItems, sentItems, setSentItems }) {
  const t = EMP_T.pt.avisos;
  const myClients = clients.filter((c) => getAssignedClientIds(assignments, staffId).includes(c.id));

  const [subject, setSubject] = useState("");
  const [clientId, setClientId] = useState("");
  const [body, setBody] = useState("");
  const [sentToast, setSentToast] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [complaintsOpen, setComplaintsOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState(null);

  const myReceived = sentItems.filter((i) => i.staffId === staffId);
  const complaints = myReceived.filter((i) => i.type === "reclamacao");
  const praises = myReceived.filter((i) => i.type === "elogio");
  const notices = myReceived.filter((i) => i.type === "aviso");
  const mySent = missingItems.filter((m) => m.staffId === staffId);
  const unreadPraises = praises.filter((i) => !i.read).length;
  const unreadNotices = notices.filter((i) => !i.read).length;
  const unreadComplaints = complaints.filter((i) => !i.read).length;

  function handleSend() {
    if (!subject || !clientId || !body.trim()) return;
    setMissingItems((prev) => [{ id: Date.now(), staffId, clientId: Number(clientId), kind: "produto", text: body.trim(), date: "16/09", resolved: false, response: "" }, ...prev]);
    setSentToast(true); setSubject(""); setClientId(""); setBody("");
    setTimeout(() => setSentToast(false), 1800);
  }
  function toggleFeedbackItem(id) {
    setExpandedFeedback(expandedFeedback === id ? null : id);
    setSentItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  }

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <h1 style={mobStyles.title}>{t.title}</h1>

      <div style={mobStyles.avisosForm}>
        <div style={mobStyles.avisosFieldsRow}>
          <div style={{ flex: 1 }}>
            <div style={mobStyles.avisosLabel}>{t.subject}</div>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={mobStyles.avisosSelect}>
              <option value="">{t.subjectPlaceholder}</option>
              {t.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={mobStyles.avisosLabel}>{t.client}</div>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={mobStyles.avisosSelect}>
              <option value="">{t.clientPlaceholder}</option>
              {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.body} style={mobStyles.avisosTextarea} rows={4} />
        <button onClick={handleSend} disabled={!subject || !clientId || !body.trim()} style={{ ...mobStyles.avisosSendButton, opacity: !subject || !clientId || !body.trim() ? 0.5 : 1 }}>{t.send}</button>
        {sentToast && <div style={mobStyles.avisosSentNote}>{t.sent}</div>}
      </div>

      <div>
        <button style={mobStyles.avisosSection} onClick={() => setSentOpen((o) => !o)}>
          <span style={mobStyles.avisosSectionTitle}>
            <ChevronDown size={14} style={{ marginRight: 6, transform: sentOpen ? "rotate(180deg)" : "none" }} />
            {t.sentSection}
          </span>
          <span style={mobStyles.avisosCount}>{mySent.length}</span>
        </button>
        {sentOpen && (
          <div style={mobStyles.feedbackList}>
            {mySent.length === 0 ? <div style={mobStyles.noDetails}>{t.noSent}</div> : mySent.map((m) => {
              const c = m.clientId ? clientById(clients, m.clientId) : null;
              return (
                <div key={m.id} style={mobStyles.feedbackCard}>
                  <div style={mobStyles.feedbackClient}>{m.kind === "correcao" ? "Correção de horas" : (c ? c.name : "")}</div>
                  <div style={mobStyles.sentDate}>{m.date} · {m.resolved ? "Resolvido" : "Pendente"}</div>
                  <div style={mobStyles.feedbackText}>{m.text}</div>
                  {m.response && <div style={{ ...mobStyles.feedbackText, marginTop: 6, fontStyle: "italic" }}>Resposta: {m.response}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button style={mobStyles.avisosSection} disabled={complaints.length === 0} onClick={() => setComplaintsOpen((o) => !o)}>
        <span style={mobStyles.avisosSectionTitle}>
          <ChevronDown size={14} style={{ marginRight: 6, transform: complaintsOpen ? "rotate(180deg)" : "none" }} />
          {t.complaints}
        </span>
        <span style={mobStyles.avisosCount}>{unreadComplaints > 0 ? unreadComplaints : complaints.length}</span>
      </button>
      {complaintsOpen && complaints.length > 0 && (
        <div style={mobStyles.feedbackList}>
          {complaints.map((f) => {
            const isExpanded = expandedFeedback === f.id;
            const c = clientById(clients, f.clientId);
            return (
              <div key={f.id} style={mobStyles.feedbackCard}>
                <div style={mobStyles.feedbackClient}>
                  {c ? c.name : ""}
                  {!f.read && <span style={mobStyles.unreadDot} />}
                </div>
                <div style={mobStyles.feedbackText}>
                  {isExpanded ? f.text : `${f.text.slice(0, 45)}...`}{" "}
                  <button style={mobStyles.readMoreLink} onClick={() => toggleFeedbackItem(f.id)}>{isExpanded ? t.readLess : t.readMore}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <button style={mobStyles.avisosSection} onClick={() => setFeedbackOpen((o) => !o)}>
          <span style={mobStyles.avisosSectionTitle}>
            <ChevronDown size={14} style={{ marginRight: 6, transform: feedbackOpen ? "rotate(180deg)" : "none" }} />
            {t.praiseSection}
          </span>
          <span style={mobStyles.avisosCount}>{unreadPraises > 0 ? unreadPraises : praises.length}</span>
        </button>
        {feedbackOpen && (
          <div style={mobStyles.feedbackList}>
            {praises.length === 0 ? <div style={mobStyles.noDetails}>{t.noSent}</div> : praises.map((f) => {
              const isExpanded = expandedFeedback === f.id;
              const c = clientById(clients, f.clientId);
              return (
                <div key={f.id} style={mobStyles.feedbackCard}>
                  <div style={mobStyles.feedbackClient}>
                    {c ? c.name : ""}
                    {!f.read && <span style={mobStyles.unreadDot} />}
                  </div>
                  <div style={mobStyles.feedbackText}>
                    {isExpanded ? f.text : `${f.text.slice(0, 45)}...`}{" "}
                    <button style={mobStyles.readMoreLink} onClick={() => toggleFeedbackItem(f.id)}>{isExpanded ? t.readLess : t.readMore}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <button style={mobStyles.avisosSection} onClick={() => setNoticesOpen((o) => !o)}>
          <span style={mobStyles.avisosSectionTitle}>
            <ChevronDown size={14} style={{ marginRight: 6, transform: noticesOpen ? "rotate(180deg)" : "none" }} />
            {t.noticesSection}
          </span>
          <span style={mobStyles.avisosCount}>{unreadNotices > 0 ? unreadNotices : notices.length}</span>
        </button>
        {noticesOpen && (
          <div style={mobStyles.feedbackList}>
            {notices.length === 0 ? <div style={mobStyles.noDetails}>{t.noSent}</div> : notices.map((f) => {
              const isExpanded = expandedFeedback === f.id;
              const c = clientById(clients, f.clientId);
              return (
                <div key={f.id} style={mobStyles.feedbackCard}>
                  <div style={mobStyles.feedbackClient}>
                    {c ? c.name : ""}
                    {!f.read && <span style={mobStyles.unreadDot} />}
                  </div>
                  <div style={mobStyles.feedbackText}>
                    {isExpanded ? f.text : `${f.text.slice(0, 45)}...`}{" "}
                    <button style={mobStyles.readMoreLink} onClick={() => toggleFeedbackItem(f.id)}>{isExpanded ? t.readLess : t.readMore}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeAvisosScreen;
