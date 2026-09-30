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
import { T } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { SupervisorTag } from "../shared/AvisosWidgets.jsx";

function EmployeeAvisosScreen({ lang, setLang, onHome, staffId, clients, staff, assignments, missingItems, setMissingItems, sentItems, setSentItems, isSupervisor }) {
  const t = T[lang].employeeAvisos;
  const tr = T[lang].reportar;
  const c0 = T[lang].common;
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

  // Secção extra, só para supervisores: reportar reclamação/elogio/aviso
  // sobre um colega para a gerência (antiga tela "Reportar", agora fundida
  // aqui porque tinha o mesmo formato de formulário e confundia as pessoas).
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState("reclamacao");
  const [reportStaffId, setReportStaffId] = useState("");
  const [reportClientId, setReportClientId] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportPhoto, setReportPhoto] = useState(false);
  const [reportSentToast, setReportSentToast] = useState(false);
  const [reportSentOpen, setReportSentOpen] = useState(false);
  const reportTargets = staff.filter((s) => s.id !== staffId);
  const mySentReports = sentItems.filter((i) => i.sentByStaffId === staffId);

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
    setMissingItems((prev) => [{ id: Date.now(), staffId, clientId: Number(clientId), kind: "produto", text: body.trim(), date: isoDateStr(TODAY), resolved: false, response: "" }, ...prev]);
    setSentToast(true); setSubject(""); setClientId(""); setBody("");
    setTimeout(() => setSentToast(false), 1800);
  }
  function toggleFeedbackItem(id) {
    setExpandedFeedback(expandedFeedback === id ? null : id);
    setSentItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  }
  function handleSendReport() {
    if (!reportStaffId || !reportClientId || !reportText.trim()) return;
    setSentItems((prev) => [
      { id: Date.now(), type: reportType, staffId: Number(reportStaffId), clientId: Number(reportClientId), text: reportText.trim(), date: isoDateStr(TODAY), hasPhoto: reportPhoto, sentBy: "supervisor", sentByStaffId: staffId },
      ...prev,
    ]);
    setReportStaffId(""); setReportClientId(""); setReportText(""); setReportPhoto(false);
    setReportSentToast(true); setTimeout(() => setReportSentToast(false), 1800);
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
                  <div style={mobStyles.feedbackClient}>{m.kind === "correcao" ? T[lang].avisos.correctionOfHours : (c ? c.name : "")}</div>
                  <div style={mobStyles.sentDate}>{m.date} · {m.resolved ? c0.resolved : c0.pending}</div>
                  <div style={mobStyles.feedbackText}>{m.text}</div>
                  {m.response && <div style={{ ...mobStyles.feedbackText, marginTop: 6, fontStyle: "italic" }}>{T[lang].avisos.yourReply}: {m.response}</div>}
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
                  {f.sentBy === "supervisor" && <SupervisorTag lang={lang} />}
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
                    {f.sentBy === "supervisor" && <SupervisorTag lang={lang} />}
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
                    {f.sentBy === "supervisor" && <SupervisorTag lang={lang} />}
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

      {isSupervisor && (
        <div style={{ marginTop: 4 }}>
          <button style={mobStyles.avisosSection} onClick={() => setReportOpen((o) => !o)}>
            <span style={mobStyles.avisosSectionTitle}>
              <ChevronDown size={14} style={{ marginRight: 6, transform: reportOpen ? "rotate(180deg)" : "none" }} />
              {t.reportColleagueSection}
            </span>
            <span style={mobStyles.avisosCount}>{mySentReports.length}</span>
          </button>
          {reportOpen && (
            <div>
              <div style={{ ...styles.avTypeToggleRow, marginTop: 10 }}>
                <button style={{ ...styles.avTypeToggle, ...(reportType === "reclamacao" ? styles.avTypeActiveComplaint : {}) }} onClick={() => setReportType("reclamacao")}>
                  <MessageSquare size={13} style={{ marginRight: 6 }} />{tr.typeComplaint}
                </button>
                <button style={{ ...styles.avTypeToggle, ...(reportType === "elogio" ? styles.avTypeActivePraise : {}) }} onClick={() => setReportType("elogio")}>
                  <ThumbsUp size={13} style={{ marginRight: 6 }} />{tr.typePraise}
                </button>
                <button style={{ ...styles.avTypeToggle, ...(reportType === "aviso" ? styles.avTypeActiveNotice : {}) }} onClick={() => setReportType("aviso")}>
                  <Info size={13} style={{ marginRight: 6 }} />{tr.typeNotice}
                </button>
              </div>
              <div style={mobStyles.avisosForm}>
                <div style={mobStyles.avisosFieldsRow}>
                  <div style={{ flex: 1 }}>
                    <div style={mobStyles.avisosLabel}>{tr.formStaff}</div>
                    <select style={mobStyles.avisosSelect} value={reportStaffId} onChange={(e) => setReportStaffId(e.target.value)}>
                      <option value="">{tr.formStaffPlaceholder}</option>
                      {reportTargets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={mobStyles.avisosLabel}>{tr.formClient}</div>
                    <select style={mobStyles.avisosSelect} value={reportClientId} onChange={(e) => setReportClientId(e.target.value)}>
                      <option value="">{tr.formClientPlaceholder}</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={mobStyles.avisosLabel}>{tr.formText}</div>
                  <textarea style={mobStyles.avisosTextarea} rows={4} placeholder={tr.formTextPlaceholder} value={reportText} onChange={(e) => setReportText(e.target.value)} />
                </div>
                <button style={{ ...styles.avAttachButton, ...(reportPhoto ? styles.avAttachActive : {}), width: "100%", justifyContent: "center" }} onClick={() => setReportPhoto((p) => !p)}>
                  <span style={{ marginRight: 6 }}>📎</span>{reportPhoto ? tr.photoAttached : tr.attachPhoto}
                </button>
                <button
                  onClick={handleSendReport}
                  disabled={!reportStaffId || !reportClientId || !reportText.trim()}
                  style={{ ...mobStyles.avisosSendButton, opacity: !reportStaffId || !reportClientId || !reportText.trim() ? 0.5 : 1 }}
                >
                  {tr.send}
                </button>
                {reportSentToast && <div style={mobStyles.avisosSentNote}>{tr.sentToast}</div>}
              </div>

              <button style={mobStyles.avisosSection} onClick={() => setReportSentOpen((o) => !o)}>
                <span style={mobStyles.avisosSectionTitle}>
                  <ChevronDown size={14} style={{ marginRight: 6, transform: reportSentOpen ? "rotate(180deg)" : "none" }} />
                  {tr.sentSection}
                </span>
                <span style={mobStyles.avisosCount}>{mySentReports.length}</span>
              </button>
              {reportSentOpen && (
                <div style={mobStyles.feedbackList}>
                  {mySentReports.length === 0 ? <div style={mobStyles.noDetails}>{tr.noSent}</div> : mySentReports.map((it) => {
                    const s = staffById(staff, it.staffId), c = clientById(clients, it.clientId);
                    return (
                      <div key={it.id} style={mobStyles.feedbackCard}>
                        <div style={mobStyles.feedbackClient}>{s ? s.name : "—"} · {c ? c.name : "—"}</div>
                        <div style={mobStyles.sentDate}>{it.date}</div>
                        <div style={mobStyles.feedbackText}>{it.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployeeAvisosScreen;
