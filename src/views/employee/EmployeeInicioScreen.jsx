import { AlertTriangle, Bell, Eye, Clock, CalendarDays, UsersRound, Plus, ChevronRight, Info, StickyNote } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { FONT, RADIUS, SHADOW } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint, useControlSize } from "../../hooks/useBreakpoint.js";
import {
  dayScheduledClients, thisWeekSummary, periodMissingDays, staffWithGapsCount, isStaffActive, expectedShare,
  fmtHoursScreen, pad2, isoDateStr, notesForOwner, fmtNoteDate,
  getOpenPeriod, getCutoffPeriod, weekBlocksOfPayPeriod, staffTotalPay, staffTotalHours, fmtEuro, calPeriodLabel,
  isSupervisorRole, recentClosedPeriodsChronological, shortMonthFromIso, addDays, staffExpensesPending, calPeriodDays, expectedTeamIds, staffById,
} from "../../models/utils.js";
import { T, formatTodayLabel, WEEKDAY_FULL_BY_LANG, DAY_ABBR_SUN0_BY_LANG, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { Card, Button, Pill, ProgressBar, PageHeader, ClientCheckCard, ChevronCircle, SaveChip, OfflineBar } from "../shared/ui/index.js";
import { findContractor, normalizeContractorColor } from "../../models/contractors.js";

const cardTitleStyle = { fontFamily: FONT.heading, fontWeight: 800, fontSize: 19, color: COLORS.ink };
const sideLink = { fontSize: 13, fontWeight: 600, color: COLORS.ink2, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: "6px 2px" };

// Estado visual de cada um dos 7 pontos do cartão "Esta semana" — ver
// comentário de `thisWeekSummary` em utils.js pros 4 estados possíveis.
function dotStyle(state) {
  switch (state) {
    case "registered": return { background: COLORS.forest600, border: `2px solid ${COLORS.forest600}` };
    case "missing": return { background: "transparent", border: `2px solid ${COLORS.alert}` };
    case "noClients": return { background: "transparent", border: `2px dashed ${COLORS.line}` };
    case "outside": return { background: COLORS.lineSoft, border: "2px solid transparent", opacity: 0.6 };
    case "future":
    default: return { background: "transparent", border: `2px solid ${COLORS.line}` };
  }
}

// Início (documento de design, secção 5.1) — ecrã partilhado entre
// funcionário e supervisor (a "regra de ouro" do documento, secção 5):
// mesmo componente, só muda o que entra no array de "Precisa da sua
// atenção" (item "Dias em falta na equipa" é só supervisor) e o selo de
// papel no topo em mobile/tablet. A casca à volta (sidebar/AppSidebar em
// PC/tablet, MobileBottomBar+MoreSheet em telemóvel) é responsabilidade
// de App.jsx, não deste componente — ver Etapa 3.
//
// `onNavigate` troca `empScreen` (mesma função já usada por
// EmployeeMenuScreen/SupervisorDashboardScreen antes deste ecrã existir).
function EmployeeInicioScreen({
  lang, setLang, me, onNavigate, avisosBadge,
  clients, staff, assignments, horasData, cutoffDay, closedPeriods, personalNotes, absences, covers,
  contractors = [], saveState = "saved", onRetrySave,
}) {
  const t = T[lang].employeeInicio;
  const tMenu = T[lang].employeeMenu;
  const tHoras = T[lang].employeeHoras;
  const tNotas = T[lang].notas;
  const tSidebar = T[lang].supervisorSidebar;
  const weekdayFull = WEEKDAY_FULL_BY_LANG[lang];
  const dayAbbrSun0 = DAY_ABBR_SUN0_BY_LANG[lang];
  const dayLabels17 = DAY_LABELS_1_7_BY_LANG[lang];
  const tier = useBreakpoint();
  // Lote 4, 4.4 (achado da Marta, item "Ver todas →" 87×19): usado no link
  // "Ver todas" do cartão de Notas, mesma régua do resto.
  const { height: seeAllHeight } = useControlSize();
  const isSupervisor = isSupervisorRole(me.role);
  const horasEntry = horasData[me.id] || { entries: [], noClientDays: [] };
  const todayKey = isoDateStr(TODAY);

  // --- Hero "Hoje" ---
  // Etapa 4j (4.9): um dia já fora da validade de uma conta Replacement
  // mostra-se como "sem clientes", mesmo que a atribuição ainda exista.
  const todayClients = isStaffActive(me, TODAY) ? dayScheduledClients(clients, assignments, me.id, TODAY, covers) : [];
  // A minha parte prevista (duração ÷ equipa da agenda), não a duração inteira do cliente.
  const shareCtx = { staff, assignments, covers, absences };
  const shareMinutes = (c) => expectedShare(shareCtx, c, todayKey, me.id).minutes;
  const totalTodayHours = todayClients.reduce((s, c) => s + shareMinutes(c) / 60, 0);
  function isClientCheckedToday(clientId) {
    return (horasEntry.entries || []).some(
      (e) => !e.voided && e.clientId === clientId && (e.date === todayKey || e.replacesDate === todayKey)
    );
  }

  // --- "Esta semana" ---
  // O período "aberto" só muda quando a gerência fecha. Se o funcionário já finalizou o dele e o
  // calendário já entrou no período novo, o Início mostra o período novo (começa limpo) e deixa o
  // anterior para o Histórico ("em análise pela gerência").
  const openPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const prevDone = horasEntry.status === "finalizado" && openPeriod.end < TODAY;
  const payPeriod = prevDone ? getCutoffPeriod(TODAY, cutoffDay, 0) : openPeriod;
  const week = thisWeekSummary(clients, assignments, me.id, horasEntry, TODAY, me, covers, { staff, assignments, covers, absences }, prevDone ? payPeriod.start : undefined);

  // --- "Precisa da sua atenção" ---
  const payPeriodChunks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);
  const openPeriodChunks = weekBlocksOfPayPeriod(openPeriod, cutoffDay);
  const missingDays = periodMissingDays(clients, assignments, me.id, horasEntry, payPeriodChunks, TODAY, me, absences, covers);
  // QA pós-auditoria (Lote 2, "dias em falta na equipa" contando dias):
  // `staffWithGapsCount` passou a devolver { staffCount, totalDays } — o
  // cartão mostra `totalDays` (bate com o total do Monitoramento) e usa
  // `staffCount` só na legenda de apoio ("X funcionários").
  const teamGaps = isSupervisor
    ? staffWithGapsCount(staff, horasData, clients, assignments, openPeriod, openPeriodChunks, cutoffDay, TODAY, absences, covers)
    : { staffCount: 0, totalDays: 0 };

  const attentionItems = [];
  if (missingDays.length > 0) {
    const first = missingDays[0];
    attentionItems.push({
      key: "missing", icon: AlertTriangle, count: missingDays.length, label: t.attentionMissingDaysLabel,
      subtitle: t.attentionMissingDaysSubtitle(weekdayFull[first.getDay()], `${pad2(first.getDate())}/${pad2(first.getMonth() + 1)}`),
      onClick: () => onNavigate("horas"),
    });
  }
  if (avisosBadge > 0) {
    attentionItems.push({
      key: "avisos", icon: Bell, count: avisosBadge, label: t.attentionUnreadLabel,
      onClick: () => onNavigate("avisos"),
    });
  }
  if (isSupervisor && teamGaps.totalDays > 0) {
    attentionItems.push({
      key: "team", icon: Eye, count: teamGaps.totalDays, label: t.attentionTeamGapsLabel,
      subtitle: t.attentionTeamGapsSubtitle(teamGaps.staffCount),
      onClick: () => onNavigate("monitoramento"),
    });
  }

  // --- Notas ---
  const notes = notesForOwner(personalNotes, me.id).slice(0, 2);

  const earnedPay = staffTotalPay(horasEntry, clients, payPeriod);
  const earnedHours = staffTotalHours(horasEntry, payPeriod);
  const dm = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  const firstName = String(me.name || "").trim().split(/\s+/)[0] || me.name;
  const clientColor = (cl) => {
    const k = findContractor(contractors, cl && cl.origin);
    return k ? normalizeContractorColor(k.color) : "var(--p1)";
  };
  // Colegas previstos na mesma visita (para "com Bruno").
  const teammates = (cl) => {
    const ids = expectedTeamIds(shareCtx, cl, todayKey).filter((id) => String(id) !== String(me.id));
    return ids.map((id) => (staffById(staff, id) || {}).name).filter(Boolean).map((n) => n.split(/\s+/)[0]);
  };

  // 1 · Hoje: clientes do dia + o botão grande ao alcance do polegar.
  const heroCard = (
    <Card style={{ padding: "18px 18px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={cardTitleStyle}>{t.heroTitle}</div>
        {todayClients.length > 0 && <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink2 }}>{t.todaySummary(todayClients.length, fmtHoursScreen(totalTodayHours))}</span>}
      </div>
      {todayClients.length === 0 ? (
        <div style={{ fontSize: 14.5, color: COLORS.ink2, marginTop: 10, lineHeight: 1.45 }}>{t.heroEmptyTitle}</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            {todayClients.map((cl) => {
              const done = isClientCheckedToday(cl.id);
              const mates = teammates(cl);
              return (
                <div key={cl.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px dashed ${COLORS.line}` }}>
                  <span style={{ width: 4, alignSelf: "stretch", minHeight: 26, borderRadius: 4, background: clientColor(cl), flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: done ? "line-through" : "none", textDecorationColor: COLORS.ink3 }}>{cl.name}</span>
                  <span style={{ fontSize: 14, color: COLORS.ink2, whiteSpace: "nowrap" }}>
                    {fmtHoursScreen(shareMinutes(cl) / 60)}{mates.length ? ` · ${t.withNames(mates.join(", "))}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => onNavigate("horas")} style={{
            marginTop: 16, width: "100%", height: 64, borderRadius: 20, border: "none", background: "var(--p1)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer",
            fontFamily: FONT.heading, fontSize: 20, boxShadow: "0 10px 24px -10px var(--p1-shadow)",
          }}>
            <Plus size={24} strokeWidth={2.8} /> {t.heroRegisterButton}
          </button>
        </>
      )}
    </Card>
  );

  // Neste período (cartão escuro): valor que conta + barras da semana.
  const weekDone = week.days.filter((d) => d.state === "registered").length;
  const weekDue = week.days.filter((d) => d.state === "registered" || d.state === "missing").length;
  const earningsCard = (
    <button type="button" onClick={() => onNavigate("horas")} className="b1-lift" style={{
      display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      background: "#151816", color: "#fff", border: "none", borderRadius: RADIUS.card, padding: "18px 20px 16px", boxShadow: SHADOW.sh2,
    }}>
      <div style={{ fontSize: 14, opacity: 0.8 }}>{t.earningsTitle}</div>
      <div style={{ fontFamily: FONT.heading, fontSize: 40, lineHeight: 1.1, marginTop: 2 }}>{fmtEuro(earnedPay)}</div>
      <div style={{ fontSize: 13.5, opacity: 0.7, marginTop: 4 }}>{t.earningsSub(fmtHoursScreen(earnedHours))}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64, marginTop: 16 }}>
        {week.days.map((d, i) => {
          const reg = d.state === "registered", miss = d.state === "missing";
          return (
            <div key={d.dateKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <span style={{
                width: "100%", borderRadius: 6, transformOrigin: "bottom", animation: reg ? `b1-grow-y .5s var(--ease) ${i * 0.05}s both` : undefined,
                height: reg ? 40 : 4, background: reg ? "var(--p1-60)" : miss ? "#E2A93B" : "rgba(255,255,255,.18)",
                outline: d.isToday ? "2px solid rgba(255,255,255,.7)" : "none", outlineOffset: 2,
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>{dayLabels17[i + 1]?.[0]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 10 }}>{t.weekDaysLabel(weekDone, weekDue || weekDone)}</div>
    </button>
  );
  // A antiga "Esta semana" agora vive dentro do cartão escuro.
  const weekCard = null;

  const attentionCard = (
    <Card>
      <div style={cardTitleStyle}>{t.attentionTitle}</div>
      {attentionItems.length === 0 ? (
        <div style={{ fontSize: 14.5, color: COLORS.ok, fontWeight: 600, marginTop: 10 }}>{t.attentionAllOk}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
          {attentionItems.map((item, k) => (
            <button key={item.key} type="button" onClick={item.onClick} style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", minHeight: 64,
              padding: "10px 0", border: "none", borderTop: k ? `1px dashed ${COLORS.line}` : "none",
              background: "transparent", cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT.heading, fontSize: 17,
                background: item.key === "avisos" ? "var(--p1-12)" : COLORS.amberBg, color: item.key === "avisos" ? "var(--p2)" : COLORS.amberInk,
              }}>{item.count}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{item.label}</span>
                <span style={{ display: "block", fontSize: 13.5, color: COLORS.ink2, marginTop: 2 }}>{item.subtitle || t.tapToOpen}</span>
              </span>
              <ChevronRight size={20} color={COLORS.ink3} />
            </button>
          ))}
        </div>
      )}
    </Card>
  );

  const notesCard = (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={cardTitleStyle}>{tNotas.widgetTitle}</div>
        <button type="button" onClick={() => onNavigate("notas")} style={{ ...sideLink, height: seeAllHeight }}>{tNotas.seeAll.toLowerCase()}</button>
      </div>
      {notes.length === 0 ? (
        <div style={{ fontSize: 14, color: COLORS.ink2, marginTop: 10 }}>{tNotas.noNotes}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <StickyNote size={18} color={COLORS.ink2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ flex: 1, fontSize: 15, color: COLORS.ink, lineHeight: 1.4 }}>
                <b style={{ color: n.date <= todayKey ? COLORS.alert : COLORS.ink2, fontWeight: 700, marginRight: 6 }}>{fmtNoteDate(n.date)}</b>{n.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  // ---------- 1b (ao deslizar) ----------
  // Os meus ganhos: últimos períodos fechados + o atual numa caixa tracejada do habitual.
  const pastGains = recentClosedPeriodsChronological((closedPeriods || []).filter((p) => p && p.periodEnd && Array.isArray(p.staffSummaries)), 4)
    .map((p) => {
      const mine = p.staffSummaries.find((x) => String(x.staffId) === String(me.id));
      return mine ? { key: p.periodEnd, label: shortMonthFromIso(p.periodEnd, lang), value: (mine.euros || 0) + (mine.expensesTotal || 0), period: p, mine } : null;
    })
    .filter(Boolean);
  const avgPast = pastGains.length ? pastGains.reduce((a, g) => a + g.value, 0) / pastGains.length : 0;
  const curLabel = shortMonthFromIso(isoDateStr(payPeriod.end), lang);
  const gainsMax = Math.max(1, avgPast, earnedPay, ...pastGains.map((g) => g.value));
  const lastGain = pastGains[pastGains.length - 1];
  let prevSameDay = null;
  if (lastGain && lastGain.mine && Array.isArray(lastGain.mine.entries)) {
    const pStart = new Date(`${lastGain.period.periodStart}T00:00:00`);
    const elapsed = Math.round((TODAY - payPeriod.start) / 86400000);
    const cut = addDays(pStart, Math.max(0, elapsed));
    prevSameDay = staffTotalPay({ entries: lastGain.mine.entries }, clients, { start: pStart, end: cut });
  }
  const fmtShortEuro = (v) => Math.round(v).toLocaleString(lang === "en" ? "en-GB" : "fr-FR");
  const gainsCard = (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={cardTitleStyle}>{t.gainsTitle}</div>
        <span style={{ fontSize: 13, color: COLORS.ink2 }}>{t.gainsLast(pastGains.length + 1)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150, marginTop: 14 }}>
        {pastGains.map((g, i) => (
          <div key={g.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink2 }}>{fmtShortEuro(g.value)}</span>
            <span style={{ width: "100%", height: `${Math.max(6, (g.value / gainsMax) * 100)}%`, background: "var(--p1-20)", borderRadius: 8, transformOrigin: "bottom", animation: `b1-grow-y .5s var(--ease) ${i * 0.06}s both` }} />
            <span style={{ fontSize: 13, color: COLORS.ink2 }}>{g.label}</span>
          </div>
        ))}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--p1)" }}>{fmtShortEuro(earnedPay)}</span>
          <span style={{ width: "100%", height: `${Math.max(10, (Math.max(avgPast, earnedPay) / gainsMax) * 100)}%`, border: `2px dashed ${COLORS.fieldBorder}`, borderRadius: 8, display: "flex", alignItems: "flex-end", padding: 3, boxSizing: "border-box", background: "repeating-linear-gradient(45deg, #F3F4F1 0 6px, #fff 6px 12px)" }}>
            <span style={{ width: "100%", height: `${Math.min(100, (earnedPay / Math.max(1, avgPast, earnedPay)) * 100)}%`, background: "var(--p1)", borderRadius: 5, transformOrigin: "bottom", animation: "b1-grow-y .7s var(--ease) .3s both" }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink }}>{curLabel}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: prevSameDay != null ? "1fr 1fr" : "1fr", gap: 10, marginTop: 14 }}>
        <div style={{ background: "#F3F4F1", borderRadius: 14, padding: "10px 14px" }}>
          <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.gainsSoFar(curLabel)}</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 22 }}>{fmtEuro(earnedPay)}</div>
        </div>
        {prevSameDay != null && (
          <div style={{ background: "#F3F4F1", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{t.gainsSameDay(lastGain.label)}</div>
            <div style={{ fontFamily: FONT.heading, fontSize: 22, color: COLORS.ink3 }}>{fmtEuro(prevSameDay)}</div>
          </div>
        )}
      </div>
      {avgPast > 0 && (
        <div style={{ display: "flex", gap: 8, fontSize: 13, color: COLORS.ink2, marginTop: 12, lineHeight: 1.45 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t.gainsNote(fmtEuro(avgPast), dm(payPeriod.end))}</span>
        </div>
      )}
    </Card>
  );

  // Próximos dias: agenda de amanhã e dos 2 dias seguintes.
  const nextDays = [1, 2, 3].map((k) => {
    const d = addDays(TODAY, k);
    const key = isoDateStr(d);
    const list = isStaffActive(me, d) ? dayScheduledClients(clients, assignments, me.id, d, covers) : [];
    const mins = list.reduce((a, c) => a + expectedShare(shareCtx, c, key, me.id).minutes, 0);
    return { key, d, list, mins, label: k === 1 ? `${t.tomorrow} · ${dayAbbrSun0[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}` : `${dayAbbrSun0[d.getDay()].charAt(0)}${dayAbbrSun0[d.getDay()].slice(1).toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}` };
  });
  const nextDaysCard = (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitleStyle}>{t.nextDaysTitle}</div>
        <button type="button" onClick={() => onNavigate("agenda")} style={sideLink}>{t.seeAgenda}</button>
      </div>
      <div style={{ marginTop: 6 }}>
        {nextDays.map((n, k) => (
          <div key={n.key} style={{ display: "grid", gridTemplateColumns: "112px 1fr auto", gap: 10, alignItems: "center", padding: "12px 0", borderTop: k ? `1px dashed ${COLORS.line}` : "none" }}>
            <b style={{ fontSize: 14.5, color: COLORS.ink }}>{n.label}</b>
            <span style={{ fontSize: 14, color: COLORS.ink2, lineHeight: 1.35 }}>{n.list.length ? n.list.map((c) => c.name).join(" · ") : t.noClientsDay}</span>
            <b style={{ fontSize: 14.5, color: COLORS.ink }}>{n.list.length ? fmtHoursScreen(n.mins / 60) : ""}</b>
          </div>
        ))}
      </div>
    </Card>
  );

  // O meu período: semanas finalizadas, extras e despesas por aprovar, dia X de Y.
  const weeksDone = payPeriodChunks.filter((b) => horasEntry.lockedWeeks && horasEntry.lockedWeeks[isoDateStr(b.start)]).length;
  const extraMin = (horasEntry.entries || []).filter((e) => !e.voided && e.extra && !e.approved && e.date >= isoDateStr(payPeriod.start) && e.date <= isoDateStr(payPeriod.end)).reduce((a, e) => a + (e.extraMinutes || 0), 0);
  const expPending = staffExpensesPending(horasEntry, payPeriod);
  const periodDays = calPeriodDays(payPeriod).length;
  const dayX = Math.min(periodDays, Math.max(1, Math.round((TODAY - payPeriod.start) / 86400000) + 1));
  const statBox = (big, small, tone) => (
    <div style={{ flex: 1, minWidth: 0, background: "#F3F4F1", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 24, color: tone === "warn" ? COLORS.amberInk : COLORS.ink }}>{big}</div>
      <div style={{ fontSize: 12, color: COLORS.ink2, lineHeight: 1.3 }}>{small}</div>
    </div>
  );
  const myPeriodCard = (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitleStyle}>{t.myPeriodTitle}</div>
        <span style={{ fontSize: 13, color: COLORS.ink2 }}>{t.closesOn(dm(payPeriod.end))}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {statBox(`${weeksDone}/${payPeriodChunks.length}`, t.weeksDone)}
        {statBox(fmtHoursScreen(extraMin / 60), t.extraPending, extraMin > 0 ? "warn" : null)}
        {statBox(String(expPending), t.expensesPending(expPending))}
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: 10, background: "#EEF0EC", marginTop: 16 }}>
        <div style={{ position: "absolute", inset: 0, width: `${(dayX / periodDays) * 100}%`, background: "var(--p1)", borderRadius: 10, transformOrigin: "left", animation: "b1-grow-x .7s var(--ease) both" }} />
        <span style={{ position: "absolute", left: `calc(${(dayX / periodDays) * 100}% - 2px)`, top: -5, width: 4, height: 20, borderRadius: 2, background: "#151816" }} />
      </div>
      <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 8 }}>{t.dayOfPeriod(dayX, periodDays)}</div>
    </Card>
  );

  const SHORTCUTS = [
    { key: "horas", icon: Clock, label: tSidebar.horas },
    { key: "agenda", icon: CalendarDays, label: tSidebar.agenda },
    { key: "clientes", icon: UsersRound, label: tSidebar.clientes },
  ];
  const shortcutTiles = (
    <Card>
      <div style={cardTitleStyle}>{t.shortcutsTitle}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {SHORTCUTS.map(({ key, icon: Icon, label }) => (
          <button
            key={key} type="button" onClick={() => onNavigate(key)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: "16px 8px", borderRadius: RADIUS.chip, border: `1.5px solid ${COLORS.iconBorder}`,
              background: COLORS.card, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Icon size={20} strokeWidth={2} color={COLORS.vivo} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{label}</span>
          </button>
        ))}
      </div>
    </Card>
  );

  // Mobile (<640): faixa degradê + cartão herói sobreposto (5.1), depois
  // pilha única na ordem do documento: herói · esta semana · atenção ·
  // notas (sem atalhos — o documento não lista os atalhos na ordem
  // mobile). Nota: o documento descreve a faixa a sangrar até à borda do
  // ecrã (raio só em baixo, herói sobreposto em -30px); aqui ela fica
  // dentro da mesma margem de 14px que o resto dos ecrãs já usa em
  // telemóvel (raio nos 4 cantos) — sangrar até à borda exigiria mexer no
  // padding do contentor raiz do App inteiro (`pageStyle`, partilhado por
  // login/gerência/tudo), risco que não me pareceu valer a pena para este
  // único ecrã sem poder ver o resultado ao vivo. Vale confirmar se
  // compensa mesmo assim ir atrás do sangramento completo.
  if (tier === "mobile") {
    const dateLong = formatTodayLabel(lang);
    return (
      <div style={{ margin: "-14px -14px 0" }}>
        <div style={{ background: "var(--p1)", color: "#fff", padding: "18px 20px 64px", borderRadius: "0 0 28px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, opacity: 0.9 }}>{dateLong}</div>
              <div style={{ fontFamily: FONT.heading, fontSize: 34, lineHeight: 1.1, marginTop: 4 }}>{tMenu.hello}, {firstName}</div>
              {isSupervisor && (
                <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "3px 10px", marginTop: 8, borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,.2)", color: "#FFFFFF" }}>
                  {T[lang].acessos.roleSupervisor}
                </span>
              )}
            </div>
            <SaveChip state={saveState} lang={lang} onDark />
          </div>
        </div>
        <div className="b1-cascade" style={{ padding: "0 14px", marginTop: -46, display: "flex", flexDirection: "column", gap: 14 }}>
          <OfflineBar state={saveState} lang={lang} onRetry={onRetrySave} />
          {heroCard}
          {attentionCard}
          {earningsCard}
          {notesCard}
          {gainsCard}
          {nextDaysCard}
          {myPeriodCard}
        </div>
      </div>
    );
  }

  // Tablet/PC: a identidade/papel já aparece na sidebar persistente (Etapa
  // 3), por isso aqui entra o `PageHeader` normal (título = saudação,
  // subtítulo = data, igual ao resto dos ecrãs de gerência) em vez da
  // faixa degradê — e duas linhas de duas colunas (7/5 e 5/7), como descrito
  // em 5.1. A posição da "Esta semana" em tablet/PC não está descrita
  // literalmente no documento; decisão minha foi empilhá-la sob o herói,
  // na mesma coluna esquerda (7), em vez de lhe dar coluna própria — vale
  // confirmar isto na revisão.
  return (
    <div style={{ width: "100%", maxWidth: 1100 }}>
      <PageHeader title={`${tMenu.hello}, ${me.name}`} subtitle={formatTodayLabel(lang)} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "7 1 420px", display: "flex", flexDirection: "column", gap: 20, minWidth: 320 }}>
          <OfflineBar state={saveState} lang={lang} onRetry={onRetrySave} />
          {heroCard}
          {earningsCard}
          {gainsCard}
        </div>
        <div style={{ flex: "5 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 20 }}>
          {attentionCard}
          {nextDaysCard}
          {myPeriodCard}
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", marginTop: 20 }}>
        <div style={{ flex: "5 1 300px", minWidth: 280 }}>
          {notesCard}
        </div>
        <div style={{ flex: "7 1 420px", minWidth: 320 }}>
          {shortcutTiles}
        </div>
      </div>
    </div>
  );
}

export default EmployeeInicioScreen;
