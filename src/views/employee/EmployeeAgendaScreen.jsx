import { useState } from "react";
import { ChevronRight, RefreshCw, UsersRound, MapPin } from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { AGENDA_DAYS, TODAY, LANG_NAMES } from "../../models/data.js";
import {
  staffById, pad2, fmtMinutes, startOfISOWeek, addDays, isoDateStr, clientAppliesOnDate,
  weekLabelPT, isStaffActive, monthAbbr, clientDurationOnDow, clientPartMinutes,
  agendaClientIdsOn, coveringOn, coveredAwayOn,
} from "../../models/utils.js";
import { T, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { PageHeader, Pill, MobileHeader } from "../shared/ui/index.js";
import { PeriodNav } from "../shared/ui/PeriodNav.jsx";
import { WeekStrip } from "../shared/ui/mobile/WeekStrip.jsx";
import { findContractor } from "../../models/contractors.js";

function splitClientName(name) {
  const idx = (name || "").indexOf(" - ");
  if (idx === -1) return [name, null];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

function RecurringPill({ label }) {
  return (
    <Pill variant="neutral" icon={RefreshCw}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Pill>
  );
}

function EmployeeAgendaScreen({ lang, setLang, onHome, staffId, staff, clients, assignments, covers = [], contractors = [], onOpenClient, desktop }) {
  const t = T[lang].employeeAgenda;
  const tCov = T[lang].coberturas;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const me = staffById(staff, staffId);
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(TODAY));
  const todayDay = TODAY.getDay() === 0 ? 7 : TODAY.getDay();
  const [expandedDay, setExpandedDay] = useState(todayDay);
  // Mobile: dia selecionado no WeekStrip (hoje, incluindo sábado/domingo)
  const [selectedDay, setSelectedDay] = useState(todayDay);

  const weekDates = AGENDA_DAYS.map((_, i) => addDays(weekStart, i));
  const isCurrentWeek = isoDateStr(weekStart) === isoDateStr(startOfISOWeek(TODAY));

  function teamSizeFor(day, clientId) {
    return staff.filter((s) => agendaClientIdsOn(assignments, covers, s.id, weekDates[day - 1]).includes(clientId)).length;
  }
  function firstNameOf(id) { const m = staffById(staff, id); return m ? m.name.split(" ")[0] : "—"; }
  function coveringFor(day) { return coveringOn(assignments, covers, staffId, weekDates[day - 1]); }
  function awayFor(day) {
    if (!isStaffActive(me, weekDates[day - 1])) return [];
    return coveredAwayOn(assignments, covers, staffId, weekDates[day - 1])
      .map((x) => ({ ...x, client: clients.find((c) => c.id === x.clientId) }))
      .filter((x) => x.client && clientAppliesOnDate(x.client, weekDates[day - 1]));
  }

  function occurrenceMeta(day, client) {
    const teamSize = teamSizeFor(day, client.id) || 1;
    const shared = teamSize > 1 && client.hoursMode !== "individual";
    const dur = clientDurationOnDow(client, day);
    const perPersonMin = clientPartMinutes(client, day, teamSize);
    const recurring = client.frequency === "biweekly" || client.frequency === "monthly" || client.frequency === "alternate";
    const freqLabel = client.frequency === "biweekly" ? t.freqBiweekly : client.frequency === "monthly" ? t.freqMonthly : t.freqAlternate;
    return { teamSize, shared, perPersonMin, recurring, freqLabel, dur };
  }

  function getDayOccurrences(day) {
    const date = weekDates[day - 1];
    if (!isStaffActive(me, date)) return [];
    const clientIds = agendaClientIdsOn(assignments, covers, staffId, date);
    return clientIds
      .map((id) => clients.find((c) => c.id === id))
      .filter((c) => c && clientAppliesOnDate(c, date));
  }

  function getDayTotalMinutes(day, occ) {
    return occ.reduce((s, c) => s + occurrenceMeta(day, c).perPersonMin, 0);
  }

  function daySummaryLine(occ) {
    if (occ.length === 0) return null;
    const names = occ.map((c) => splitClientName(c.name)[0]);
    if (names.length <= 2) return names.join(" · ");
    return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
  }

  function openProps(client) {
    if (!onOpenClient) return {};
    return {
      role: "button", tabIndex: 0, "aria-label": client.name,
      onClick: () => onOpenClient(client.id),
      onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClient(client.id); } },
    };
  }
  function goWeek(delta) { setWeekStart((w) => addDays(w, delta * 7)); }

  // Cor do contratante de um cliente
  function contractorColorOf(client) {
    const ct = findContractor(contractors, client.origin);
    return ct ? ct.color : null;
  }

  const weekNav = (
    <PeriodNav
      label={weekLabelPT(weekStart, lang)} size={40}
      onPrev={() => goWeek(-1)} onNext={() => goWeek(1)}
      prevLabel={t.previousWeek} nextLabel={t.nextWeek}
      style={{ margin: "0 auto" }}
      labelStyle={{ fontSize: desktop ? 14.5 : 20, minWidth: desktop ? 120 : undefined }}
    />
  );

  function coverTagOf(day, clientId) {
    const x = coveringFor(day).find((c) => c.clientId === clientId);
    return x ? tCov.coveringTag(firstNameOf(x.cover.fromStaffId)) : null;
  }
  function AwayNote({ day }) {
    const items = awayFor(day);
    if (items.length === 0) return null;
    return (
      <>
        {items.map(({ cover, client }) => (
          <span key={cover.id} title={`${client.name} · ${tCov.awayTag(firstNameOf(cover.toStaffId))}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, borderRadius: RADIUS.chip, padding: "0 9px", border: `1.5px dashed ${COLORS.line}`, fontSize: 12.5, color: COLORS.ink2, maxWidth: 260 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</span>
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700 }}>{tCov.awayTag(firstNameOf(cover.toStaffId))}</span>
          </span>
        ))}
      </>
    );
  }

  // ── Cartão de cliente mobile (novo design) ──
  // Barra colorida do contratante à esquerda, nome, morada com pin, intervalo horário
  function MobileClientCard({ day, client }) {
    const { shared, perPersonMin, recurring, freqLabel, teamSize, dur } = occurrenceMeta(day, client);
    const ctColor = contractorColorOf(client);
    return (
      <div
        {...openProps(client)}
        style={{
          borderRadius: 14, border: `1px solid ${COLORS.line}`,
          background: COLORS.card, overflow: "hidden",
          cursor: onOpenClient ? "pointer" : "default",
          display: "flex",
        }}
      >
        {/* Barra colorida do contratante */}
        <div style={{
          width: 5, flexShrink: 0, borderRadius: "14px 0 0 14px",
          background: ctColor || COLORS.ink3,
        }} />
        <div style={{ flex: 1, minWidth: 0, padding: "12px 14px" }}>
          {/* Nome + chevron */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{client.name}</div>
              {coverTagOf(day, client.id) && <div style={{ marginTop: 3 }}><Pill variant="neutral">{coverTagOf(day, client.id)}</Pill></div>}
            </div>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {recurring && <RecurringPill label={freqLabel} />}
              {onOpenClient && <ChevronRight size={16} color={COLORS.ink3} />}
            </div>
          </div>

          {/* Morada com pin */}
          {client.address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 6, fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.4 }}>
              <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              {/* A morada muitas vezes já termina na cidade: não a repetir ("…, Ottignies, Ottignies"). */}
              <span>{client.address}{client.city && !String(client.address).toLowerCase().includes(String(client.city).toLowerCase()) ? `, ${client.city}` : ""}</span>
            </div>
          )}

          {/* Intervalo horário + duração */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12.5, color: COLORS.ink2 }}>
            {shared && <UsersRound size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
            <span>
              {shared ? `${t.peopleLabel(teamSize)} · ${fmtMinutes(perPersonMin)} ${t.each}` : fmtMinutes(dur)}
              {client.availability ? ` · ${client.availability}` : ""}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Cartão de cliente desktop (existente, sem alteração) ──
  function ClientCard({ day, client }) {
    const { shared, perPersonMin, recurring, freqLabel, teamSize, dur } = occurrenceMeta(day, client);
    return (
      <div
        {...openProps(client)}
        style={{
          borderRadius: RADIUS.chip, border: `1px solid ${shared ? "#F3D9CB" : COLORS.line}`,
          background: shared ? COLORS.clayTint : COLORS.card, padding: "12px 14px",
          cursor: onOpenClient ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: shared ? COLORS.clayInk : COLORS.ink }}>{client.name}</div>
            {coverTagOf(day, client.id) && <div style={{ marginTop: 3 }}><Pill variant="neutral">{coverTagOf(day, client.id)}</Pill></div>}
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: shared ? COLORS.clayInk : COLORS.ink2, marginTop: 2 }}>
              {shared && <UsersRound size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
              <span>
                {shared ? `${t.peopleLabel(teamSize)} · ${fmtMinutes(perPersonMin)} ${t.each}` : fmtMinutes(dur)}
                {client.availability ? ` · ${client.availability}` : ""}
              </span>
            </div>
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {recurring && <RecurringPill label={freqLabel} />}
            {onOpenClient && <ChevronRight size={16} color={shared ? COLORS.clayInk : COLORS.ink3} />}
          </div>
        </div>
        {client.description && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${shared ? "#F3D9CB" : COLORS.lineSoft}` }}>
            <span style={{ fontSize: 12, color: shared ? COLORS.clayInk : COLORS.ink2, lineHeight: 1.4 }}>{client.description}</span>
          </div>
        )}
      </div>
    );
  }

  // Chip compacto, PC/tablet
  function ClientChip({ day, client }) {
    const { shared, perPersonMin, recurring, teamSize, dur } = occurrenceMeta(day, client);
    const tooltip = `${client.name} · ${fmtMinutes(dur)}${shared ? ` · ${t.peopleLabel(teamSize)}, ${fmtMinutes(perPersonMin)} ${t.each}` : ""}`;
    return (
      <div
        title={tooltip}
        {...openProps(client)}
        style={{
          display: "flex", alignItems: "center", gap: 4, height: 28, borderRadius: RADIUS.chip, padding: "0 9px",
          background: shared ? COLORS.clayTint : COLORS.lineSoft, fontSize: 12.5, maxWidth: 220,
          cursor: onOpenClient ? "pointer" : "default",
        }}
      >
        {shared && <UsersRound size={11} style={{ flexShrink: 0, color: COLORS.clayInk }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, color: shared ? COLORS.clayInk : COLORS.ink }}>
          {client.name}
        </span>
        <span style={{ flexShrink: 0, fontWeight: 600, color: shared ? COLORS.clayInk : COLORS.ink2 }}>
          {fmtMinutes(shared ? perPersonMin : dur)}
        </span>
        {coverTagOf(day, client.id) && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "1px 7px", background: COLORS.vivo, color: "#fff" }}>{coverTagOf(day, client.id)}</span>}
        {recurring && <RefreshCw size={10} style={{ flexShrink: 0, color: shared ? COLORS.clayInk : COLORS.ink3 }} />}
      </div>
    );
  }

  // ── Vista desktop (sem alterações) ──
  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} actions={weekNav} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginBottom: 16, fontSize: 12.5, color: COLORS.ink2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 8, padding: "0 8px", background: COLORS.lineSoft, fontSize: 11.5, fontWeight: 600, color: COLORS.ink }}>
              {t.legendSampleName} <b>1h</b>
            </span>
            <span>{t.legendDuration}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 8, padding: "0 8px", background: COLORS.clayTint, fontSize: 11.5, fontWeight: 600, color: COLORS.clayInk }}>
              <UsersRound size={11} /> {t.legendSampleName} <b>1h</b>
            </span>
            <span>{t.legendShared}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 8, padding: "0 8px", background: COLORS.lineSoft, fontSize: 11.5, fontWeight: 600, color: COLORS.ink }}>
              {t.legendSampleName} <b>1h</b> <RefreshCw size={10} />
            </span>
            <span>{t.legendRecurring}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {AGENDA_DAYS.map((day) => {
            const date = weekDates[day - 1];
            const isToday = isCurrentWeek && day === todayDay;
            const occ = getDayOccurrences(day);
            return (
              <div
                key={day}
                style={{
                  display: "flex", alignItems: "center", gap: 18, padding: "14px 18px", borderRadius: RADIUS.card,
                  border: isToday ? `2px solid ${COLORS.forest500}` : `1px solid ${COLORS.line}`,
                  background: COLORS.card,
                }}
              >
                <div style={{ width: 110, flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>{dayLabels[day]}</div>
                  <div style={{ fontSize: 12, color: COLORS.ink2 }}>{pad2(date.getDate())} {monthAbbr(lang, date.getMonth())}</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {occ.length === 0
                    ? <span style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noClientsShort}</span>
                    : occ.map((c) => <ClientChip key={c.id} day={day} client={c} />)}
                  <AwayNote day={day} />
                </div>
                <div style={{ flexShrink: 0, width: 70, textAlign: "right" }}>
                  {isToday && <Pill variant="paid">{t.todayPill}</Pill>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Vista mobile (novo design) ──
  // Faixa Seg–Sex; sábado e domingo entram quando há clientes (ou é hoje / o dia
  // escolhido) — antes ficavam sempre de fora e quem trabalha ao fim de semana não
  // via esses clientes nem as horas no total da semana.
  const WORK_DAYS = AGENDA_DAYS.filter((d) => d <= 5 || getDayOccurrences(d).length > 0 || (isCurrentWeek && d === todayDay) || d === selectedDay);
  const DAY_ABBR = { pt: ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"], en: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], fr: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"] };
  const abbrs = DAY_ABBR[lang] || DAY_ABBR.pt;

  const stripDays = WORK_DAYS.map((day, i) => {
    const date = weekDates[day - 1];
    const occ = getDayOccurrences(day);
    const isToday = isCurrentWeek && day === todayDay;
    let state = "default";
    if (day === selectedDay) state = "selected";
    else if (occ.length === 0) state = "noClients";
    else state = "registered";
    return { key: day, dayLabel: abbrs[day - 1], dayNumber: date.getDate(), state, isToday };
  });

  const selOcc = getDayOccurrences(selectedDay);
  const selTotalMin = getDayTotalMinutes(selectedDay, selOcc);

  // Resumo semanal: dias × horas (os mesmos dias da faixa)
  const weekSummary = WORK_DAYS.map((day) => {
    const occ = getDayOccurrences(day);
    return { day, minutes: getDayTotalMinutes(day, occ) };
  });
  const weekTotalMin = weekSummary.reduce((s, d) => s + d.minutes, 0);

  return (
    <div style={mobStyles.phone}>
      <MobileHeader onBack={onHome} backLabel={t.backLabel} title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      {/* Navegação de semana */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <PeriodNav
          label={weekLabelPT(weekStart, lang)} size={40}
          onPrev={() => goWeek(-1)} onNext={() => goWeek(1)}
          prevLabel={t.previousWeek} nextLabel={t.nextWeek}
          labelStyle={{ fontSize: 20 }}
        />
      </div>

      {/* WeekStrip de 5 dias */}
      <WeekStrip
        days={stripDays}
        onSelectDay={(key) => setSelectedDay(key)}
        legendItems={{
          done: t.legendStripDone || "Com clientes",
          none: t.legendStripNone || "Sem clientes",
          today: t.todayPill,
        }}
      />

      {/* Cartões do dia selecionado */}
      <div style={{ marginTop: 18, minHeight: 120 }}>
        {selOcc.length === 0 ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "40px 16px", textAlign: "center",
          }}>
            <span style={{ fontSize: 14, color: COLORS.ink3 }}>{t.noClients}</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Total do dia */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink2 }}>
                {selOcc.length} {selOcc.length === 1 ? (t.clientSingular || "cliente") : (t.clientPlural || "clientes")}
              </span>
              <Pill>{fmtMinutes(selTotalMin)}</Pill>
            </div>
            {selOcc.map((c) => <MobileClientCard key={c.id} day={selectedDay} client={c} />)}
          </div>
        )}
        {awayFor(selectedDay).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <AwayNote day={selectedDay} />
          </div>
        )}
      </div>

      {/* Resumo semanal em tabela */}
      <div style={{
        marginTop: 24, borderRadius: 14, border: `1px solid ${COLORS.line}`,
        background: COLORS.card, overflow: "hidden",
      }}>
        <div style={{
          padding: "10px 14px", fontSize: 13, fontWeight: 700, color: COLORS.ink,
          borderBottom: `1px solid ${COLORS.line}`,
        }}>
          {t.weeklySummary || "Resumo semanal"}
        </div>
        <div style={{ display: "flex" }}>
          {weekSummary.map(({ day, minutes }) => {
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "10px 0", border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: isSelected ? "var(--p1-8)" : "transparent",
                  borderBottom: isSelected ? "2px solid var(--p1)" : "2px solid transparent",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink2, letterSpacing: "0.03em" }}>
                  {abbrs[day - 1]}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: minutes > 0 ? COLORS.ink : COLORS.ink3,
                }}>
                  {minutes > 0 ? fmtMinutes(minutes) : "—"}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", borderTop: `1px solid ${COLORS.line}`,
          fontSize: 13, fontWeight: 700, color: COLORS.ink,
        }}>
          <span>{t.weekTotal || "Total"}</span>
          <span>{fmtMinutes(weekTotalMin)}</span>
        </div>
      </div>
    </div>
  );
}

export default EmployeeAgendaScreen;
