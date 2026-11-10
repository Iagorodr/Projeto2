// Dashboard da gerência — redesign B1 (protótipo "Servix Dashboard B1").
// Mesmos números de antes (as contas vêm das mesmas funções de utils.js); muda a
// apresentação: cabeçalho compacto com atalhos, régua do período, 4 números com
// mini-linha, e blocos que se podem reordenar/ocultar (Personalizar, guardado por
// pessoa). No telemóvel: 3 abas (Hoje · Período · Empresa).
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, MessageSquare, Home, Pencil, GripVertical, EyeOff, Eye, Bell, Check, AlertTriangle, ChevronUp, ChevronDown, X } from "lucide-react";
import "./dashboard.css";
import { COLORS } from "../../styles/colors.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { TODAY, LANG_NAMES } from "../../models/data.js";
import {
  clientById, parseDMY, getOpenPeriod, unseenAvisosCount, formatPeriodLabel, staffTotalHours, staffTotalPay,
  notesForOwner, fmtEuro, fmtHoursScreen, monthAbbr, isStaffActive, boardStaff, activeClientsCount, isoDateStr, dateStrInPeriod,
  fmtHM, countReviews, inReviewWindow, pendingExpenseList, staffExpensesApproved, uniqueSentCount, groupSentItems,
  addDays, weekBlocksOfPayPeriod, staffWithGaps, clientExpectedHours, dayScheduledClients, absenceOn, absenceApproved, pendingAbsenceRequests, pendingHolidayDecisions, parseClientDate,
} from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { DASH } from "../../models/i18nDash.js";
import { upcomingHolidays } from "../../models/holidays.js";
import { HOLIDAY_T } from "../../models/i18nHoliday.js";
import ClientsByCityCard from "./ClientsByCityCard.jsx";
import { contractorPeriods, periodFinance } from "../../models/contractorStats.js";
import { FIN } from "../../models/i18nFin.js";
import { Avatar, Toast, Drawer } from "../shared/ui/index.js";
import { SearchButton } from "../shared/GlobalSearch.jsx";
import { THEMES, DEFAULT_THEME, applyTheme } from "../../styles/theme.js";
import { localPrefs, loadPrefs, savePrefs } from "../../models/userPrefs.js";

const LOCALE = { pt: "pt-PT", en: "en-GB", fr: "fr-BE" };
const DAY_MS = 86400000;
// Botões da folha "Personalizar" (telemóvel): a folha fica fora dos estilos .dsh.
const SHEET_BTN = { height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid #E2E5DF", background: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#151816", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const BLOCKS = ["pend", "monit", "hoje", "mapa", "fin", "recl", "notas", "horas", "dest"];
const LAYOUT = { pend: "c1 r2", monit: "c1", hoje: "c1", mapa: "c2 r2", fin: "c2", recl: "c1", notas: "c1", horas: "c4", dest: "c2" };
const TAB_OF = { hero: "periodo", kpis: "periodo", pend: "hoje", monit: "hoje", hoje: "hoje", mapa: "empresa", fin: "periodo", recl: "periodo", notas: "empresa", horas: "periodo", dest: "periodo" };

const reduceMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// Número que conta até ao valor (≈1,2 s).
function CountUp({ value, format = (v) => Math.round(v).toLocaleString("pt-PT"), className }) {
  const [shown, setShown] = useState(reduceMotion() ? value : 0);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); return undefined; }
    let raf; const t0 = performance.now(); const from = 0; const d = 1200;
    const step = (t) => { let p = Math.min(1, (t - t0) / d); p = 1 - Math.pow(1 - p, 3); setShown(from + (value - from) * p); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}

function Spark({ values }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [4 + (i * 112) / (values.length - 1), 30 - ((v - min) / span) * 22]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="dsh-spark" viewBox="0 0 120 36" width="120" height="36" aria-hidden="true">
      <path className="sa" d={`${line} L116 36 L4 36Z`} />
      <path className="sl" d={line} pathLength="1" />
      <circle className="sd" cx={last[0]} cy={last[1]} r="3.5" />
    </svg>
  );
}

function DashboardScreen({
  lang, setLang, company, setCompany, userName, clients, staff, horasData, missingItems, sentItems, setSentItems, contractAlertDays,
  highlightsMonths = 3, highlightsRealtime = false, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount,
  cutoffDay, closedPeriods, personalNotes, absences, assignments, covers, contractors, closings, onNavigate,
}) {
  const t = T[lang].dashboard;
  const tAbs = T[lang].absences;
  const tm = T[lang].monitoramento;
  const d = DASH[lang] || DASH.pt;
  const f = FIN[lang];
  const tier = useBreakpoint();
  const isPhone = tier === "mobile";
  const loc = LOCALE[lang] || "pt-PT";
  const ctx = { staff, assignments, covers, absences };

  // ── período ──
  const period = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const totalDays = Math.round((period.end - period.start) / DAY_MS) + 1;
  const dayN = Math.min(totalDays, Math.max(1, Math.round((TODAY - period.start) / DAY_MS) + 1));
  const daysLeft = Math.round((period.end - TODAY) / DAY_MS);
  const pos = (date) => Math.max(0, Math.min(100, ((Math.round((date - period.start) / DAY_MS)) / Math.max(1, totalDays - 1)) * 100));
  const fmtDM = (date) => date.toLocaleDateString(loc, { day: "numeric", month: "short" }).replace(".", "");
  const periodMonth = period.end.toLocaleDateString(loc, { month: "long" });
  const holidaysInPeriod = upcomingHolidays(period.start, totalDays - 1, lang);

  // ── horas ──
  const periodHours = staff.reduce((s, st) => s + staffTotalHours(horasData[st.id] || { entries: [] }, period), 0);
  const expectedHours = useMemo(
    () => clients.reduce((s, c) => s + clientExpectedHours(c, period, ctx, TODAY).whole, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, period.start.getTime(), period.end.getTime(), staff, assignments, covers, absences],
  );
  const hoursPct = expectedHours > 0 ? Math.round((periodHours / expectedHours) * 100) : 0;
  const periodPay = staff.reduce((s, st) => s + staffTotalPay(horasData[st.id] || { entries: [] }, clients, period) + staffExpensesApproved(horasData[st.id], period), 0);

  // ── números ──
  const activeStaff = staff.filter((s) => isStaffActive(s, TODAY));
  const recentClosed = (closedPeriods || []).slice(0, 5).reverse();
  const hoursSeries = [...recentClosed.map((p) => p.totalHours || 0), periodHours];
  const staffSeries = [...recentClosed.map((p) => (p.staffSummaries || []).filter((x) => (x.hours || 0) > 0).length), activeStaff.length];
  const replacementActive = clients.filter((c) => c.clientType === "replacement" && (!c.clientValidUntil || new Date(c.clientValidUntil) >= TODAY)).length;
  const newClients = clients.filter((c) => { const s = parseClientDate(c.contractStart); return s && s >= period.start && s <= period.end; }).length;

  // ── pendências (mesmas contas de antes) ──
  const board = boardStaff(staff, horasData, period, TODAY);
  const hoursReviews = countReviews(horasData, clients, period, ctx, isoDateStr(TODAY));
  const visitReviewsPending = inReviewWindow(period, TODAY) ? hoursReviews.attention : 0;
  const expensesPending = pendingExpenseList(horasData).length;
  let overtimePending = 0, reopenedCount = 0, customClientPending = 0, shareReviewPending = 0;
  const staffIdSet = new Set(staff.map((s) => String(s.id)));
  Object.entries(horasData).forEach(([sid, data]) => {
    if (!data || !staffIdSet.has(String(sid))) return;
    if (data.reopened) reopenedCount += 1;
    data.entries.forEach((e) => { if (e.extra && !e.approved && !e.voided) overtimePending += 1; if (!e.voided && !e.clientId && e.custom) customClientPending += 1; if (!e.voided && e.shareReview) shareReviewPending += 1; });
  });
  const pendingRequests = unseenAvisosCount(missingItems, sentItems, period);
  const absencesPending = (absences || []).filter((a) => absenceApproved(a) && !a.handled && a.date >= isoDateStr(TODAY)).length;
  const absenceRequestsPending = pendingAbsenceRequests(absences, isoDateStr(TODAY)).length;
  // Feriados nos próximos 7 dias com clientes por decidir (a gerência decide em Agendas).
  const tHol = HOLIDAY_T[lang] || HOLIDAY_T.pt;
  const holidayPending = pendingHolidayDecisions(upcomingHolidays(TODAY, 7, lang).map((h) => h.iso), clients, staff, assignments, covers);
  const holidayFirst = holidayPending[0] || null;
  const holidayName = holidayFirst ? (upcomingHolidays(TODAY, 7, lang).find((h) => h.iso === holidayFirst.iso)?.name || tHol.tag) : "";
  const contractDiff = (c) => (parseDMY(c.contractEnd) - TODAY) / DAY_MS;
  const contractsNearExpiry = clients.filter((c) => { const x = contractDiff(c); return x >= 0 && x <= contractAlertDays; }).length;
  const contractsExpired = clients.filter((c) => contractDiff(c) < 0).length;

  const financePeriod = useMemo(
    () => contractorPeriods({ closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, today: TODAY, lang, count: 6 }),
    [closedPeriods, horasData, staff, clients, contractors, closings, cutoffDay, lang],
  );
  const curFin = financePeriod[financePeriod.length - 1];
  const finance = useMemo(() => periodFinance(curFin, contractors), [curFin, contractors]);
  const finEnded = isoDateStr(TODAY) > curFin.iso;
  const closingsToDo = finance.cards.filter((cd) => finEnded && !(cd.closing && cd.closing.status === "closed")).length
    + (closings || []).filter((r) => r.status === "reopened" && r.periodEnd !== curFin.iso).length;
  const outstanding = (closings || []).filter((r) => r.status === "closed" && !r.receivedOn && r.periodEnd !== curFin.iso)
    .reduce((s, r) => s + (Number(r.receivable) || 0), 0);

  const pendingRows = [
    { key: "overtime", tone: "warn", label: t.pendingOvertime, count: overtimePending, go: () => onNavigate("horas") },
    { key: "custom", tone: "warn", label: t.pendingCustomClient, count: customClientPending, go: () => onNavigate("horas") },
    { key: "share", tone: "warn", label: t.pendingShareReview, count: shareReviewPending, go: () => onNavigate("horas") },
    { key: "visits", tone: "warn", label: t.pendingVisitReviews, count: visitReviewsPending, go: () => onNavigate("horas") },
    { key: "repass", tone: "warn", label: t.pendingRepass, count: hoursReviews.repass, go: () => onNavigate("horas", { openReviews: true, tab: "repass" }) },
    { key: "expenses", tone: "warn", label: t.pendingExpenses, count: expensesPending, go: () => onNavigate("horas", { openExpenses: true }) },
    { key: "closings", tone: "warn", label: f.pendingClosings(closingsToDo), count: closingsToDo, go: () => onNavigate("contratantes") },
    { key: "reopened", tone: "re", label: t.pendingReopened, count: reopenedCount, go: () => onNavigate("horas") },
    { key: "unread", tone: "acc", label: t.pendingUnread, count: pendingRequests, go: () => onNavigate("avisos") },
    { key: "absenceReq", tone: "acc", label: tAbs.pendencyReq, count: absenceRequestsPending, go: () => onNavigate("notas") },
    { key: "holiday", tone: "warn", label: holidayFirst ? tHol.pendency(holidayName, `${holidayFirst.iso.slice(8, 10)}/${holidayFirst.iso.slice(5, 7)}`) : "", count: holidayPending.reduce((n, h) => n + h.undecided, 0), go: () => onNavigate("agendas", { openHoliday: holidayFirst?.iso }) },
    { key: "absence", tone: "warn", label: tAbs.pendency, count: absencesPending, go: () => onNavigate("agendas") },
    { key: "contracts", tone: "warn", label: t.pendingContracts, count: contractsNearExpiry, go: () => onNavigate("clientes") },
    { key: "expired", tone: "bad", label: t.pendingContractsExpired, count: contractsExpired, go: () => onNavigate("clientes") },
  ].filter((r) => r.count > 0);
  const pendingTotal = pendingRows.reduce((s, r) => s + r.count, 0);

  // ── monitoramento ──
  const chunks = weekBlocksOfPayPeriod(period, cutoffDay);
  const gaps = useMemo(
    () => staffWithGaps(staff, horasData, clients, assignments, period, chunks, cutoffDay, TODAY, absences, covers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, horasData, clients, assignments, period.start.getTime(), cutoffDay, absences, covers],
  );
  const monitored = staff.filter((s) => isStaffActive(s, TODAY) && s.accountType === "fixo");
  const onTrack = Math.max(0, monitored.length - gaps.length);
  const lastDay = daysLeft <= 0;
  const notFinalized = lastDay ? monitored.filter((s) => (horasData[s.id] || {}).status !== "finalizado") : [];
  const [reminded, setReminded] = useState(false);
  function remindAll() {
    if (!setSentItems || gaps.length === 0) return;
    const today = isoDateStr(TODAY);
    const base = Date.now();
    const ids = gaps.map((g, i) => base + i);
    setSentItems((prev) => [...gaps.map((g, i) => ({ id: ids[i], type: "aviso", staffId: g.id, clientId: null, text: tm.remindText(g.days), date: today, hasPhoto: false, seenByManagement: true })), ...prev]);
    setReminded(true);
    setUndo({ ids });
    setTimeout(() => setUndo((u) => (u && u.ids === ids ? null : u)), 5000);
  }
  const [undo, setUndo] = useState(null);
  function undoRemind() {
    if (!undo) return;
    const drop = new Set(undo.ids);
    setSentItems((prev) => prev.filter((i) => !drop.has(i.id)));
    setReminded(false); setUndo(null);
  }

  // ── hoje ──
  const todayInfo = useMemo(() => {
    const iso = isoDateStr(TODAY);
    const byClient = new Map(); const absentClients = new Set(); let people = 0;
    staff.filter((s) => isStaffActive(s, TODAY)).forEach((s) => {
      const list = dayScheduledClients(clients, assignments, s.id, TODAY, covers);
      if (list.length === 0) return;
      if (absenceOn(absences, s.id, iso)) { list.forEach((c) => absentClients.add(c.id)); return; }
      people += 1;
      list.forEach((c) => byClient.set(c.id, (byClient.get(c.id) || 0) + 1));
    });
    const uncovered = [...absentClients].filter((id) => !byClient.has(id)).map((id) => clientById(clients, id)).filter(Boolean);
    const week = [];
    const dow = TODAY.getDay() === 0 ? 7 : TODAY.getDay();
    const monday = addDays(TODAY, 1 - dow);
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i); const set = new Set();
      staff.filter((s) => isStaffActive(s, day)).forEach((s) => dayScheduledClients(clients, assignments, s.id, day, covers).forEach((c) => set.add(c.id)));
      week.push({ n: set.size, on: i === dow - 1, label: day.toLocaleDateString(loc, { weekday: "narrow" }).toUpperCase() });
    }
    return { clients: byClient.size + uncovered.length, people, pairs: [...byClient.values()].filter((n) => n >= 2).length, uncovered, week };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, clients, assignments, covers, absences, lang]);
  const weekMax = Math.max(1, ...todayInfo.week.map((w) => w.n));

  // ── reclamações ──
  const periodComplaints = (sentItems || []).filter((i) => i.type === "reclamacao" && dateStrInPeriod(i.date, period));
  const complaintsNow = uniqueSentCount(periodComplaints);
  const prevComplaints = closedPeriods && closedPeriods[0] ? uniqueSentCount(closedPeriods[0].reclamacoesItems || []) : null;
  const excelente = Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavel = Math.max(excelente + 1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));
  const scaleX = (n) => {
    if (n == null) return 0;
    if (n <= excelente) return (n / Math.max(1, excelente)) * 31;
    if (n <= razoavel) return 34 + ((n - excelente) / Math.max(1, razoavel - excelente)) * 31;
    return Math.min(97, 67 + ((n - razoavel) / Math.max(1, razoavel)) * 30);
  };
  const recentComplaints = groupSentItems(periodComplaints).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3)
    .map((i) => ({ client: clientById(clients, i.clientId)?.name || "—", date: i.date, key: i.id ?? `${i.clientId}-${i.date}` }));

  // ── notas ──
  const myNotes = notesForOwner(personalNotes, "management").filter((n) => n.date >= isoDateStr(addDays(TODAY, -1))).slice(0, 3);
  const holidaysSoon = upcomingHolidays(TODAY, 45, lang).slice(0, 3);
  const isoTile = (iso) => { const [, m, dd] = iso.split("-"); return { day: Number(dd), mon: monthAbbr(lang, Number(m) - 1) }; };

  // ── destaques (mesma regra de antes) ──
  const usedClosed = highlightsRealtime ? [] : (closedPeriods || []).slice(0, Math.max(1, highlightsMonths));
  const hoursByStaff = {}; const feedback = new Map();
  if (highlightsRealtime) {
    board.forEach((s) => { hoursByStaff[s.id] = staffTotalHours(horasData[s.id] || { entries: [] }, period); });
    (sentItems || []).filter((i) => dateStrInPeriod(i.date, period)).forEach((i) => feedback.set(i.id ?? JSON.stringify(i), i));
  } else {
    usedClosed.forEach((cp) => {
      (cp.staffSummaries || []).forEach((ss) => { hoursByStaff[ss.staffId] = (hoursByStaff[ss.staffId] || 0) + (ss.hours || 0); });
      [...(cp.elogiosItems || []), ...(cp.reclamacoesItems || [])].forEach((i) => feedback.set(i.id ?? JSON.stringify(i), i));
    });
  }
  const topStaff = board.map((s) => ({ id: s.id, name: s.name, hours: hoursByStaff[s.id] || 0 })).filter((s) => s.hours > 0)
    .map((s) => { const mine = [...feedback.values()].filter((i) => i.staffId === s.id); return { ...s, praises: mine.filter((i) => i.type === "elogio").length, complaints: mine.filter((i) => i.type === "reclamacao").length }; })
    .sort((a, b) => b.hours - a.hours).slice(0, 5);

  // ── horas por contratante ──
  const ctColor = (key) => (key === "none" ? "#151816" : (contractors || []).find((c) => c.id === key)?.color || "#8A918C");
  const ctName = (key) => (key === "none" ? d.noContractor : (contractors || []).find((c) => c.id === key)?.name || "—");
  const ctKeys = []; financePeriod.forEach((p) => p.contractors.forEach((v, k) => { if (v.hours > 0 && !ctKeys.includes(k)) ctKeys.push(k); }));
  ctKeys.sort((a, b) => (a === "none") - (b === "none"));
  const chartMax = Math.max(1, expectedHours, ...financePeriod.map((p) => p.totalHours || 0));

  // ── personalizar (ordem e ocultos por pessoa) ──
  const [prefs, setPrefs] = useState(() => (localPrefs().dash || {}));
  useEffect(() => { let alive = true; loadPrefs().then((p) => { if (alive && p && p.dash) setPrefs(p.dash); }); return () => { alive = false; }; }, []);
  const order = [...(prefs.order || []).filter((k) => BLOCKS.includes(k)), ...BLOCKS.filter((k) => !(prefs.order || []).includes(k))];
  const hidden = (prefs.hidden || []).filter((k) => BLOCKS.includes(k));
  const updatePrefs = (next) => { setPrefs(next); savePrefs({ dash: next }); };
  const [edit, setEdit] = useState(false);
  const dragKey = useRef(null);
  const [overKey, setOverKey] = useState(null);
  const moveBlock = (from, to, after) => {
    if (from === to) return;
    const list = order.filter((k) => k !== from);
    let i = list.indexOf(to); if (after) i += 1;
    list.splice(i, 0, from);
    updatePrefs({ ...prefs, order: list });
  };
  // Telemóvel: subir/descer um bloco (sem arrastar).
  const stepBlock = (key, dir) => {
    const list = [...order];
    const i = list.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updatePrefs({ ...prefs, order: list });
  };
  const toggleHidden = (key) => updatePrefs({ ...prefs, order, hidden: hidden.includes(key) ? hidden.filter((x) => x !== key) : [...hidden, key] });

  const [tab, setTab] = useState("hoje");
  const blockTitle = { pend: d.pendTitle, monit: d.monitTitle, hoje: d.todayTitle("").replace(/\s*·\s*$/, ""), mapa: t.citiesTitle || "Mapa", fin: d.finTitle("").replace(/\s+\S+\s*$/, ""), recl: d.reclTitle, notas: d.notesTitle, horas: d.hoursCtTitle, dest: d.highlights };
  const hr = new Date().getHours();
  const firstName = String(userName || "").trim().split(/\s+/)[0];

  const wrap = (key, i, content, extraClass = "") => {
    if (hidden.includes(key)) return null;
    const cls = ["dw", LAYOUT[key], "mv", extraClass, TAB_OF[key] === tab ? "show" : "", overKey === key ? "over" : ""].filter(Boolean).join(" ");
    return (
      <section
        key={key} className={cls} data-tab={TAB_OF[key]} style={{ "--i": i + 2 }}
        draggable={edit && !isPhone}
        onDragStart={(e) => { dragKey.current = key; e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); }}
        onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); dragKey.current = null; setOverKey(null); }}
        onDragOver={(e) => { if (edit && dragKey.current && dragKey.current !== key) { e.preventDefault(); setOverKey(key); } }}
        onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
        onDrop={(e) => {
          e.preventDefault(); setOverKey(null);
          const r = e.currentTarget.getBoundingClientRect();
          moveBlock(dragKey.current, key, (e.clientY - r.top) > r.height / 2 || (e.clientX - r.left) > r.width * 0.66);
        }}
      >
        <div className="dsh-wctl">
          <span className="dsh-grip"><GripVertical size={14} /> {blockTitle[key]}</span>
          <button type="button" className="dsh-hide" onClick={() => updatePrefs({ ...prefs, order, hidden: [...hidden, key] })}><EyeOff size={13} /> {d.hide}</button>
        </div>
        {content}
      </section>
    );
  };

  const blocks = {
    pend: (
      <>
        <h4>{d.pendTitle}{pendingTotal > 0 && <span className="kl">{d.pendTotal(pendingTotal)}</span>}</h4>
        {pendingRows.length === 0 ? <div className="dsh-ok"><Check size={18} /> {d.pendNone}</div> : (
          <div className="dsh-pl">
            {pendingRows.map((r) => (
              <button type="button" key={r.key} className="dsh-pi" onClick={r.go}>
                <b className={`dsh-pn t-${r.tone}`}>{r.count}</b>
                <div><b>{r.label}</b></div>
                <span aria-hidden="true" style={{ color: "#B4BAB5", fontWeight: 800 }}>›</span>
              </button>
            ))}
          </div>
        )}
      </>
    ),
    monit: (
      <>
        <h4>{d.monitTitle}<button type="button" onClick={() => onNavigate("monitoramento")}>{d.open}</button></h4>
        <div className="dsh-mo">
          <svg className="dsh-ring" width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
            <circle cx="43" cy="43" r="35" className="rt" />
            <circle cx="43" cy="43" r="35" className="rf" pathLength="100" style={{ strokeDasharray: `${monitored.length ? (onTrack / monitored.length) * 100 : 100} 100` }} />
          </svg>
          <div className="dsh-mt"><b><CountUp value={onTrack} />/{monitored.length}</b><span>{d.onTrack}</span></div>
        </div>
        {lastDay && notFinalized.length > 0 ? (
          <p className="dsh-ml"><b>{d.notFinalized(notFinalized.length)}</b> · {notFinalized.slice(0, 3).map((s) => s.name.split(" ")[0]).join(", ")}</p>
        ) : gaps.length > 0 ? (
          <p className="dsh-ml"><b>{d.missing(gaps.length)}</b> · {gaps.slice(0, 3).map((g) => g.name.split(" ")[0]).join(", ")}{gaps.length > 3 ? "…" : ""}</p>
        ) : <p className="dsh-ml">{d.allGood}</p>}
        {gaps.length > 0 && (
          <div className="dsh-mrow">
            <span className="dsh-stack">{gaps.slice(0, 4).map((g) => <Avatar key={g.id} name={g.name} size={32} />)}</span>
            <button type="button" className="dsh-btn k" onClick={remindAll} disabled={reminded || !setSentItems}>
              {reminded ? <><Check size={14} /> {tm.reminded}</> : <><Bell size={14} /> {d.remind(gaps.length)}</>}
            </button>
          </div>
        )}
      </>
    ),
    hoje: (
      <>
        <h4>{d.todayTitle(TODAY.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "short" }).replace(".", ""))}<button type="button" onClick={() => onNavigate("agendas")}>{d.agendas}</button></h4>
        {todayInfo.clients === 0 ? <p className="dsh-ml">{d.noAgendaToday}</p> : (
          <div className="dsh-nums">
            <div><b><CountUp value={todayInfo.clients} /></b>{d.nClients}</div>
            <div><b><CountUp value={todayInfo.people} /></b>{d.nPeople}</div>
            <div><b><CountUp value={todayInfo.pairs} /></b>{d.nPairs}</div>
          </div>
        )}
        {todayInfo.uncovered.length > 0 && (
          <div className="dsh-warn">
            <AlertTriangle size={18} color="#B7790E" />
            <div><b>{d.uncovered(todayInfo.uncovered.length)}</b><span>{todayInfo.uncovered.slice(0, 2).map((c) => c.name).join(" · ")}</span></div>
            <button type="button" className="dsh-btn k" onClick={() => onNavigate("agendas")}>{d.resolve}</button>
          </div>
        )}
        <div className="dsh-wkbar" aria-hidden="true">
          {todayInfo.week.map((w, i) => (
            <div key={i} className={w.on ? "on" : ""}><i style={{ height: `${Math.max(4, (w.n / weekMax) * 100)}%`, "--d": i }} /><span>{w.label}</span></div>
          ))}
        </div>
      </>
    ),
    mapa: (
      <ClientsByCityCard
        clients={clients} t={t} mobile={isPhone} wide={!isPhone} bare
        style={{ flex: "1 1 auto", border: 0, boxShadow: "none", padding: 0, background: "transparent" }}
        onOpenCity={(city) => onNavigate("clientes", { city })}
        onOpenClients={() => onNavigate("clientes", { filter: "nocity" })}
      />
    ),
    fin: (
      <>
        <div className="dsh-fh"><span>{d.finTitle(periodMonth)}</span><button type="button" onClick={() => onNavigate("contratantes")}>{d.contractors}</button></div>
        <div className="dsh-big"><CountUp value={finance.receivable} format={(v) => fmtEuro(v)} /></div>
        <div className="dsh-two">
          <div>{d.staffCost}<b>−{fmtEuro(finance.pricedStaff)}</b></div>
          <div>{d.margin}<b className="acc">{fmtEuro(finance.margin)}</b></div>
        </div>
        {finance.unpriced > 0 && <div className="dsh-note-dim">{d.unpriced(finance.unpriced)}</div>}
        {outstanding > 0 && <div className="dsh-note-dim">{d.outstanding}: <b style={{ color: "#fff" }}>{fmtEuro(outstanding)}</b></div>}
        {finance.cards.length > 0 ? (() => {
          const total = finance.cards.reduce((s, c) => s + (c.hours || 0), 0) || 1;
          return (
            <div className="dsh-cbox">
              <div className="dsh-cbar">{finance.cards.map((c) => <i key={c.contractor.id} style={{ flex: c.hours / total, background: c.contractor.color || "#8A918C" }} />)}</div>
              <div className="dsh-leg">{finance.cards.map((c) => <span key={c.contractor.id}><i style={{ background: c.contractor.color || "#8A918C" }} />{c.contractor.name} <em>{Math.round((c.hours / total) * 100)}%</em></span>)}</div>
            </div>
          );
        })() : <div className="dsh-note-dim">{d.noFin}</div>}
      </>
    ),
    recl: (
      <>
        <h4>{d.reclTitle}<button type="button" onClick={() => onNavigate("avisos")}>{d.seeAvisos}</button></h4>
        <div className="dsh-rq">
          <div className="dsh-rtop">
            <div className="dsh-rbig"><b><CountUp value={complaintsNow} /></b><span>{d.inPeriod}</span></div>
            {prevComplaints != null && (() => { const diff = complaintsNow - prevComplaints; return <span className={`dsh-rchip ${diff > 0 ? "bad" : diff === 0 ? "eq" : ""}`}>{d.vsPrev(diff)}</span>; })()}
          </div>
          <div className="dsh-rscale">
            <i className="dsh-sg g" /><i className="dsh-sg a" /><i className="dsh-sg r" />
            {prevComplaints != null && <b className="dsh-mark prev" style={{ left: `${scaleX(prevComplaints)}%` }} />}
            <b className="dsh-mark" style={{ left: `${scaleX(complaintsNow)}%` }}><span>{monthAbbr(lang, period.end.getMonth())}</span></b>
          </div>
          <div className="dsh-rlab"><span>{t.gaugeExcelente}</span><span>{t.gaugeRazoavel}</span><span>{t.gaugeCritico}</span></div>
          <div className="dsh-rl">
            {recentComplaints.length === 0 ? <span style={{ fontSize: 12.5, color: COLORS.ink2 }}>{d.reclNone}</span>
              : recentComplaints.map((c) => <div key={c.key}><i className="dsh-dt" /><b>{c.client}</b><span>{String(c.date).split("-").reverse().slice(0, 2).join("/")}</span></div>)}
          </div>
        </div>
      </>
    ),
    notas: (
      <>
        <h4>{d.notesTitle}<button type="button" onClick={() => onNavigate("notas")}>{d.newNote}</button></h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myNotes.length === 0 && holidaysSoon.length === 0 && <span style={{ fontSize: 13, color: COLORS.ink2 }}>{d.notesEmpty}</span>}
          {holidaysSoon.map((h) => { const x = isoTile(h.iso); return (
            <div key={h.iso} className="dsh-fer"><b className="dsh-dd">{x.day}<small>{x.mon}</small></b><div><b>{h.name}</b><span>{d.holidayTag}</span></div></div>
          ); })}
          {myNotes.map((n) => { const x = isoTile(n.date); return (
            <div key={n.id} className="dsh-fer"><b className="dsh-dd note">{x.day}<small>{x.mon}</small></b><div><b style={{ fontWeight: 600, fontSize: 13.5 }}>{n.text}</b></div></div>
          ); })}
        </div>
      </>
    ),
    horas: (
      <>
        <h4>{d.hoursCtTitle}<button type="button" onClick={() => onNavigate("historico")}>{d.history}</button></h4>
        <div className="dsh-leg" style={{ margin: "-4px 0 12px", color: "#6F776F" }}>
          {ctKeys.map((k) => <span key={k}><i style={{ background: ctColor(k) }} />{ctName(k)}</span>)}
          <span><i className="gh" />{d.expectedLegend}</span>
        </div>
        <div className="dsh-hch">
          {financePeriod.map((p, i) => {
            const cur = p.isCurrent;
            const cap = cur ? Math.max(expectedHours, p.totalHours || 0) : (p.totalHours || 0);
            const colH = (cap / chartMax) * 130;
            return (
              <div key={p.key} className={`dsh-hc${cur ? " cur" : ""}`}>
                <b>{Math.round(p.totalHours || 0).toLocaleString(loc)}{cur && expectedHours > 0 && <small> / ~{Math.round(expectedHours).toLocaleString(loc)}</small>}</b>
                <div className={`dsh-stk${cur ? " ghost" : ""}`} style={{ height: Math.max(6, colH), "--d": i }}>
                  {cur && <em>{d.expectedTag}</em>}
                  {[...ctKeys].reverse().map((k) => { const v = p.contractors.get(k); const hgt = v && cap > 0 ? (v.hours / cap) * 100 : 0; return hgt > 0 ? <i key={k} style={{ height: `${hgt}%`, background: ctColor(k) }} /> : null; })}
                </div>
                <span>{p.label}{cur && <i className="dsh-live" />}</span>
              </div>
            );
          })}
        </div>
      </>
    ),
    dest: (
      <>
        <h4>{d.highlights}<span className="kl">{highlightsRealtime ? t.highlightsSubtitleRealtime : t.highlightsSubtitleClosed(usedClosed.length || highlightsMonths)}</span></h4>
        {topStaff.length === 0 ? <span style={{ fontSize: 13, color: COLORS.ink2 }}>{highlightsRealtime ? t.highlightsEmptyRealtime : t.highlightsEmptyClosed}</span> : (
          <div className="dsh-hl">
            {topStaff.map((s, i) => (
              <div key={s.id}>
                <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: COLORS.ink3 }}>{i + 1}</span>
                <Avatar name={s.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.ink3 }}>{fmtHM(Math.round(s.hours * 60))} h</div>
                </div>
                <span title={t.highlightsPraises} style={{ fontSize: 12, fontWeight: 800, color: "var(--p1)" }}>★ {s.praises}</span>
                <span title={t.highlightsComplaints} style={{ fontSize: 12, fontWeight: 800, color: s.complaints ? "#D6454A" : COLORS.ink3 }}>⚠ {s.complaints}</span>
              </div>
            ))}
          </div>
        )}
      </>
    ),
  };

  const themeKey = (company && company.theme) || DEFAULT_THEME;
  const weekTicks = [];
  for (let i = 0; i < totalDays; i++) { const day = addDays(period.start, i); weekTicks.push({ left: (i / Math.max(1, totalDays - 1)) * 100, wk: day.getDay() === 1 }); }

  return (
    <div className={`dsh${edit && !isPhone ? " edit" : ""}`}>
      <section className="dsh-head">
        {/* Telemóvel: Personalizar como botão redondo ao lado da saudação (abre uma folha). */}
        {isPhone && (
          <button type="button" onClick={() => setEdit(true)} aria-label={d.customize} title={d.customize}
            style={{ float: "right", width: 44, height: 44, borderRadius: 22, border: "none", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#151816", cursor: "pointer", boxShadow: "0 1px 2px rgba(21,24,22,.06)", marginLeft: 10 }}>
            <Pencil size={17} />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1>{d.greet(hr)}{firstName ? `, ${firstName}` : ""}.</h1>
          <p>{TODAY.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })} · <span className="dsh-chip">{d.dayOf(dayN, totalDays)}</span></p>
        </div>
        <div className="dsh-acts">
          <button type="button" className="dsh-btn p" onClick={() => onNavigate("monitoramento")}><Plus size={16} strokeWidth={2.4} /> {d.fillHours}</button>
          <button type="button" className="dsh-btn" onClick={() => onNavigate("avisos")}><MessageSquare size={16} /> {d.sendNotice}</button>
          <button type="button" className="dsh-btn" onClick={() => onNavigate("clientes", { clientId: "new" })}><Home size={16} /> {d.newClient}</button>
          {!isPhone && <span className="dsh-sep" />}
          {!isPhone && <SearchButton size={42} style={{ borderRadius: "50%", border: 0 }} />}
          {!isPhone && (
            <select className="dsh-lang" aria-label="Língua" value={lang} onChange={(e) => setLang(e.target.value)}
              style={{ height: 42, borderRadius: 21, border: 0, background: "#fff", padding: "0 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {Object.keys(LANG_NAMES).map((k) => <option key={k} value={k}>{LANG_NAMES[k]}</option>)}
            </select>
          )}
          {!isPhone && <button type="button" className={`dsh-btn dsh-edit${edit ? " on" : ""}`} onClick={() => setEdit((v) => !v)}><Pencil size={15} /> {d.customize}</button>}
        </div>
      </section>

      {(() => {
        // Primeiros passos (empresa nova): some quando os 4 estiverem feitos.
        const hasAgenda = Object.keys(assignments || {}).some((k) => /^\d+-\d+$/.test(k) && (assignments[k] || []).length > 0);
        const steps = [
          { key: "contratantes", label: d.stepContractors, done: (contractors || []).length > 0 },
          { key: "clientes", label: d.stepClients, done: clients.length > 0 },
          { key: "funcionarios", label: d.stepStaff, done: staff.length > 0 },
          { key: "agendas", label: d.stepAgenda, done: hasAgenda },
        ];
        if (steps.every((x) => x.done) || prefs.stepsHidden) return null;
        const next = steps.findIndex((x) => !x.done);
        return (
          <section className="dw c4 fixed show" data-tab="hoje" style={{ "--i": 0 }}>
            <h4>{d.stepsTitle}<span className="kl">{d.stepsCount(steps.filter((x) => x.done).length, steps.length)}</span>
              <button type="button" onClick={() => updatePrefs({ ...prefs, order, stepsHidden: true })} aria-label={d.hideSteps}
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", borderRadius: 15, border: "1px solid #E2E5DF", background: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "#5A625C", cursor: "pointer" }}>
                <X size={13} /> {d.hideSteps}
              </button>
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {steps.map((x, i) => (
                <button key={x.key} type="button" onClick={() => onNavigate(x.key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, border: i === next ? "2px solid var(--p1)" : "1px solid #E2E5DF", background: x.done ? "var(--p1-8)" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "#151816" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 14, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, background: x.done ? "var(--p1)" : i === next ? "#151816" : "#EEF0EC", color: x.done || i === next ? "#fff" : "#6F776F" }}>
                    {x.done ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, textDecoration: x.done ? "line-through" : "none", opacity: x.done ? 0.6 : 1 }}>{x.label}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {edit && !isPhone && (
        <section className="dsh-tray">
          <div><b>{d.trayTitle}</b><span>{d.trayHint}</span></div>
          <div className="dsh-hid">
            <span className="kl">{d.hiddenLabel}</span>
            {hidden.length === 0 ? <em>{d.noneHidden}</em> : hidden.map((k) => (
              <button type="button" key={k} onClick={() => updatePrefs({ ...prefs, order, hidden: hidden.filter((x) => x !== k) })}>+ {blockTitle[k]}</button>
            ))}
            {prefs.stepsHidden && <button type="button" onClick={() => updatePrefs({ ...prefs, order, stepsHidden: false })}>+ {d.stepsTitle}</button>}
            {(hidden.length > 0 || (prefs.order || []).length > 0) && <button type="button" onClick={() => updatePrefs({ order: [], hidden: [] })}>{d.reset}</button>}
          </div>
          {setCompany && (
            <div className="dsh-th">
              <span className="kl">{d.companyColor}</span>
              {THEMES.map((th) => (
                <button key={th.key} type="button" title={th.label[lang] || th.label.pt} aria-label={th.label[lang] || th.label.pt} aria-pressed={th.key === themeKey}
                  className={`dsh-sw${th.key === themeKey ? " on" : ""}`} style={{ background: th.p1 }}
                  onClick={() => { applyTheme(th.key); setCompany((c) => ({ ...c, theme: th.key })); }} />
              ))}
            </div>
          )}
          <button type="button" className="dsh-btn p" onClick={() => setEdit(false)}>{d.done}</button>
        </section>
      )}

      {/* Telemóvel: Personalizar numa folha — subir/descer, mostrar/ocultar e cor da empresa. */}
      {isPhone && (
        <Drawer open={edit} onClose={() => setEdit(false)} title={d.customize} closeLabel={d.done}
          footer={<button type="button" style={{ ...SHEET_BTN, flex: 1, height: 52, background: "var(--p1)", color: "#fff", border: "none" }} onClick={() => setEdit(false)}>{d.done}</button>}>
          <div style={{ fontSize: 13, color: "#5A625C", marginBottom: 12 }}>{d.phoneCustomizeHint}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {order.map((k, i) => {
              const off = hidden.includes(k);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 6px 6px 14px", borderRadius: 14, background: off ? "#F4F6F2" : "#fff", border: "1px solid #E2E5DF" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: off ? "#8A918B" : "#151816", textDecoration: off ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{blockTitle[k]}</span>
                  {[[-1, ChevronUp, d.moveUp, i === 0], [1, ChevronDown, d.moveDown, i === order.length - 1]].map(([dir, Ic, lab, dis]) => (
                    <button key={dir} type="button" aria-label={`${lab}: ${blockTitle[k]}`} disabled={dis} onClick={() => stepBlock(k, dir)}
                      style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "#EEF0EC", display: "flex", alignItems: "center", justifyContent: "center", color: "#151816", opacity: dis ? 0.35 : 1, cursor: dis ? "default" : "pointer" }}><Ic size={18} /></button>
                  ))}
                  <button type="button" aria-label={`${off ? d.showBlock : d.hideBlock}: ${blockTitle[k]}`} aria-pressed={!off} onClick={() => toggleHidden(k)}
                    style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: off ? "#EEF0EC" : "var(--p1-12)", color: off ? "#6F776F" : "var(--p2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{off ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {prefs.stepsHidden && <button type="button" style={SHEET_BTN} onClick={() => updatePrefs({ ...prefs, order, stepsHidden: false })}>+ {d.stepsTitle}</button>}
            {(hidden.length > 0 || (prefs.order || []).length > 0) && <button type="button" style={SHEET_BTN} onClick={() => updatePrefs({ order: [], hidden: [] })}>{d.reset}</button>}
          </div>
          {setCompany && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#5A625C", marginBottom: 10 }}>{d.companyColor}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {THEMES.map((th) => (
                  <button key={th.key} type="button" title={th.label[lang] || th.label.pt} aria-label={th.label[lang] || th.label.pt} aria-pressed={th.key === themeKey}
                    onClick={() => { applyTheme(th.key); setCompany((c) => ({ ...c, theme: th.key })); }}
                    style={{ width: 44, height: 44, borderRadius: 14, border: "none", background: th.p1, boxShadow: th.key === themeKey ? `0 0 0 3px #fff, 0 0 0 5px ${th.p1}` : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {th.key === themeKey && <Check size={18} color="#fff" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Drawer>
      )}

      <nav className="dsh-tabs" aria-label="Dashboard">
        {["hoje", "periodo", "empresa"].map((k) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} aria-pressed={tab === k} onClick={() => { setTab(k); try { window.scrollTo({ top: 0 }); } catch { /* */ } }}>{d.tabs[k]}</button>
        ))}
      </nav>

      <section className={`dw dsh-hero c4 fixed${tab === "periodo" ? " show" : ""}`} data-tab="periodo" style={{ "--i": 0 }}>
        <div className="dsh-hero-in">
          <div>
            <span className="dsh-kick">{d.kick(periodMonth)}</span>
            <div className="dsh-day">{d.day} <b><CountUp value={dayN} /></b> <small>{d.of} {totalDays}</small></div>
            <span className="dsh-sub">{d.sub(formatPeriodLabel(period, lang), daysLeft)}</span>
          </div>
          <div className="dsh-rule">
            <div className="dsh-marks">
              {dayN > 2 && dayN < totalDays - 1 && <div className="dsh-mk today" style={{ left: `${pos(TODAY)}%` }}><b>{d.today}</b><span>{fmtDM(TODAY)}</span></div>}
              {(dayN <= 2) && <div className="dsh-mk today start" style={{ left: 0 }}><b>{d.today}</b><span>{fmtDM(TODAY)}</span></div>}
              {holidaysInPeriod.slice(0, 2).map((h) => { const [y, m, dd] = h.iso.split("-").map(Number); const hd = new Date(y, m - 1, dd); const p = pos(hd); return Math.abs(p - pos(TODAY)) > 12 && p < 86 ? <div key={h.iso} className="dsh-mk hol" style={{ left: `${p}%` }} title={h.name}><b>{d.holiday}</b><span>{fmtDM(hd)}</span></div> : null; })}
              <div className="dsh-mk end" style={{ left: "100%" }}><b>{dayN >= totalDays - 1 ? `${d.today} · ${d.close}` : d.close}</b><span>{fmtDM(period.end)}</span></div>
            </div>
            <div className="dsh-track">
              {weekTicks.map((w, i) => <i key={i} className={w.wk ? "wk" : ""} style={{ left: `${w.left}%` }} />)}
              <div className="dsh-fill" style={{ width: `${pos(TODAY)}%` }} />
              {holidaysInPeriod.map((h) => { const [y, m, dd] = h.iso.split("-").map(Number); return <div key={h.iso} className="dsh-hd" style={{ left: `${pos(new Date(y, m - 1, dd))}%` }} title={h.name} />; })}
              <div className="dsh-dot" style={{ left: `${pos(TODAY)}%` }} />
            </div>
            <div className="dsh-dates">
              {weekTicks.map((w, i) => (w.wk && w.left < 92 ? <span key={i} style={{ left: `${w.left}%` }}>{fmtDM(addDays(period.start, i))}</span> : null))}
            </div>
          </div>
          <div>
            <span className="kl">{d.hoursLogged}</span>
            <div className="dsh-hn"><b><CountUp value={periodHours} format={(v) => `${Math.round(v).toLocaleString(loc)}h`} /></b>{expectedHours > 0 && <small>/ ~{Math.round(expectedHours).toLocaleString(loc)}h</small>}</div>
            {expectedHours > 0 && <div className="dsh-bar"><i style={{ width: `${Math.min(100, hoursPct)}%` }} /></div>}
            {expectedHours > 0 && <span className="kl">{d.pct(hoursPct)} · {fmtEuro(periodPay)}</span>}
          </div>
        </div>
        <svg className="dsh-fita" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 13C35 19 29 45 50 51" /><path d="M50 13C29 19 35 45 14 51" /></svg>
      </section>

      <section className={`dsh-kpis c4${tab === "periodo" ? " show" : ""}`} data-tab="periodo">
        <button type="button" className="dsh-kp" onClick={() => onNavigate("funcionarios")}>
          <span className="kl">{d.activeStaff}</span>
          <div className="dsh-kr"><b><CountUp value={activeStaff.length} /></b><Spark values={staffSeries} /></div>
          <small>{d.ofN(staff.length)}</small>
        </button>
        <button type="button" className="dsh-kp" onClick={() => onNavigate("clientes")}>
          <span className="kl">{d.clients}</span>
          <div className="dsh-kr"><b><CountUp value={activeClientsCount(clients, TODAY)} /></b></div>
          <small className={newClients > 0 ? "up" : ""}>{d.newIn(newClients)}</small>
        </button>
        <button type="button" className="dsh-kp" onClick={() => onNavigate("clientes", replacementActive > 0 ? { filter: "replacement" } : undefined)}>
          <span className="kl">{d.replacement}</span>
          <div className="dsh-kr"><b><CountUp value={replacementActive} /></b></div>
          <small>{d.tempClients}</small>
        </button>
        <button type="button" className="dsh-kp" onClick={() => onNavigate("horas")}>
          <span className="kl">{d.hoursPeriod}</span>
          <div className="dsh-kr"><b><CountUp value={periodHours} format={(v) => `${Math.round(v).toLocaleString(loc)}h`} /></b><Spark values={hoursSeries} /></div>
          <small>{expectedHours > 0 ? d.expected(`${Math.round(expectedHours).toLocaleString(loc)}h`) : formatPeriodLabel(period, lang)}</small>
        </button>
      </section>

      {order.map((k, i) => wrap(k, i, blocks[k], k === "fin" ? "dsh-dark" : ""))}
      {undo && <Toast message={d.reminded(undo.ids.length)} actionLabel={T[lang].notas.undo} onAction={undoRemind} onDismiss={() => setUndo(null)} closeLabel={T[lang].common.close} />}
    </div>
  );
}

export default DashboardScreen;
