import { useState } from "react";
import { Home as HouseIcon, RefreshCw, UsersRound } from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { AGENDA_DAYS, TODAY, LANG_NAMES } from "../../models/data.js";
import {
  staffById, pad2, fmtMinutes, startOfISOWeek, addDays, isoDateStr, clientAppliesThisWeek,
  weekLabelPT, isStaffActive, monthAbbr,
} from "../../models/utils.js";
import { T, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { PageHeader, Pill } from "../shared/ui/index.js";
import { ChevronLeftMini, ChevronRightMini } from "../shared/Icons.jsx";

// Mesma divisão de nome usada em EmployeeClientesScreen.jsx/ClientesScreen.jsx
// (duplicada de propósito, ver o comentário lá) — só usada aqui no resumo de
// uma linha do dia fechado (5.3, "Novo"), pra não encher esse resumo com o
// nome da filial. O cartão aberto mostra o nome completo (ver mais abaixo).
function splitClientName(name) {
  const idx = (name || "").indexOf(" - ");
  if (idx === -1) return [name, null];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

// Pílula de recorrência (documento, 5.3): "escrever a palavra 'Quinzenal' ou
// 'Mensal' numa pílula (não só o ícone)" — antes só havia o ícone RefreshCw
// discretamente ao lado da duração. `label` já vem traduzido de T[lang].
function RecurringPill({ label }) {
  return (
    <Pill variant="neutral" icon={RefreshCw}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Pill>
  );
}

// Agenda (documento de design, secção 5.3) — "ver a semana a partir do seu
// lado". `staff` (lista completa) é novo nesta etapa: precisa dela por dois
// motivos — (1) `isStaffActive` pra aplicar a regra já prevista em
// `isStaffActive` (utils.js): "os dias a seguir à validade ficam sem
// clientes" pra uma conta Replacement expirada, igual já feito em
// EmployeeHorasScreen/EmployeeInicioScreen (Etapa 4j); (2) contar quantas
// pessoas partilham um cliente num dia certo (`teamSizeFor`, mesma conta de
// AgendasScreen.jsx, gerência, 4.3) — sem isso não dá pra saber se um
// cliente é partilhado nem qual é "a parte" do próprio funcionário.
function EmployeeAgendaScreen({ lang, setLang, onHome, staffId, staff, clients, assignments, desktop }) {
  const t = T[lang].employeeAgenda;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const me = staffById(staff, staffId);
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(TODAY));
  const todayDay = TODAY.getDay() === 0 ? 7 : TODAY.getDay();
  const [expandedDay, setExpandedDay] = useState(todayDay);

  const weekDates = AGENDA_DAYS.map((_, i) => addDays(weekStart, i));
  const isCurrentWeek = isoDateStr(weekStart) === isoDateStr(startOfISOWeek(TODAY));

  function teamSizeFor(day, clientId) {
    return staff.filter((s) => (assignments[`${s.id}-${day}`] || []).includes(clientId)).length;
  }

  // Cliente partilhado: a "parte" do próprio é duração ÷ nº de pessoas
  // nesse cliente, nesse dia — mesma conta de AgendasScreen.staffWeekMinutes
  // (4.3), só que por dia em vez de somada na semana.
  function occurrenceMeta(day, client) {
    const teamSize = teamSizeFor(day, client.id) || 1;
    const shared = teamSize > 1;
    const perPersonMin = Math.round(client.duration / teamSize);
    const recurring = client.frequency === "biweekly" || client.frequency === "monthly";
    const freqLabel = client.frequency === "biweekly" ? t.freqBiweekly : t.freqMonthly;
    return { teamSize, shared, perPersonMin, recurring, freqLabel };
  }

  // `isStaffActive(me, date)` por DATA (não por hoje): uma conta Replacement
  // que expira a meio da semana mostrada continua a ver os clientes dos
  // dias anteriores à validade, só os de depois ficam sem clientes.
  function getDayOccurrences(day) {
    const date = weekDates[day - 1];
    if (!isStaffActive(me, date)) return [];
    const clientIds = assignments[`${staffId}-${day}`] || [];
    return clientIds
      .map((id) => clients.find((c) => c.id === id))
      .filter((c) => c && clientAppliesThisWeek(c, weekStart));
  }
  // Total do dia (pílula): soma da PARTE do próprio em cada cliente, não a
  // duração bruta — senão um cliente partilhado conta a dobrar no total do
  // funcionário (a conta antiga desta tela tinha esse erro).
  function getDayTotalMinutes(day, occ) {
    return occ.reduce((s, c) => s + occurrenceMeta(day, c).perPersonMin, 0);
  }
  // Resumo de uma linha pro dia fechado (documento, 5.3, "Novo"): primeiros
  // dois nomes + "+N" pro resto — "Cliente 33 · Cliente 5 +1".
  function daySummaryLine(occ) {
    if (occ.length === 0) return null;
    const names = occ.map((c) => splitClientName(c.name)[0]);
    if (names.length <= 2) return names.join(" · ");
    return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
  }
  function goWeek(delta) { setWeekStart((w) => addDays(w, delta * 7)); }

  const weekNav = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <button type="button" onClick={() => goWeek(-1)} aria-label={t.previousWeek} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <ChevronLeftMini />
      </button>
      <span style={{ fontSize: desktop ? 14.5 : 22, fontWeight: 700, color: COLORS.ink, minWidth: desktop ? 120 : undefined, textAlign: "center" }}>
        {weekLabelPT(weekStart, lang)}
      </span>
      <button type="button" onClick={() => goWeek(1)} aria-label={t.nextWeek} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <ChevronRightMini />
      </button>
    </div>
  );

  // Cartão de cliente, telemóvel (dia aberto): nome completo + duração/parte
  // + janela horária (`c.availability`, texto livre já existente), pílula de
  // recorrência à parte, separador + descrição. Partilhado: cartão clay-tint
  // com ícone de pessoas (documento, 5.3).
  function ClientCard({ day, client }) {
    const { shared, perPersonMin, recurring, freqLabel, teamSize } = occurrenceMeta(day, client);
    return (
      <div
        style={{
          borderRadius: RADIUS.chip, border: `1px solid ${shared ? "#F3D9CB" : COLORS.line}`,
          background: shared ? COLORS.clayTint : COLORS.card, padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: shared ? COLORS.clayInk : COLORS.ink }}>{client.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: shared ? COLORS.clayInk : COLORS.ink2, marginTop: 2 }}>
              {shared && <UsersRound size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />}
              <span>
                {shared ? `${t.peopleLabel(teamSize)} · ${fmtMinutes(perPersonMin)} ${t.each}` : fmtMinutes(client.duration)}
                {client.availability ? ` · ${client.availability}` : ""}
              </span>
            </div>
          </div>
          {recurring && <div style={{ flexShrink: 0 }}><RecurringPill label={freqLabel} /></div>}
        </div>
        {client.description && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${shared ? "#F3D9CB" : COLORS.lineSoft}` }}>
            <span style={{ fontSize: 12, color: shared ? COLORS.clayInk : COLORS.ink2, lineHeight: 1.4 }}>{client.description}</span>
          </div>
        )}
      </div>
    );
  }

  // Chip compacto, PC/tablet (todos os dias em linha, "chips de cliente ao
  // centro") — mesmo visual dos chips de AgendasScreen.jsx (gerência, 4.3),
  // sem descrição (vista de relance, não de detalhe).
  function ClientChip({ day, client }) {
    const { shared, perPersonMin, recurring, teamSize } = occurrenceMeta(day, client);
    const tooltip = `${client.name} · ${fmtMinutes(client.duration)}${shared ? ` · ${t.peopleLabel(teamSize)}, ${fmtMinutes(perPersonMin)} ${t.each}` : ""}`;
    return (
      <div
        title={tooltip}
        style={{
          display: "flex", alignItems: "center", gap: 4, height: 28, borderRadius: RADIUS.chip, padding: "0 9px",
          background: shared ? COLORS.clayTint : COLORS.lineSoft, fontSize: 12.5, maxWidth: 220,
        }}
      >
        {shared && <UsersRound size={11} style={{ flexShrink: 0, color: COLORS.clayInk }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, color: shared ? COLORS.clayInk : COLORS.ink }}>
          {client.name}
        </span>
        <span style={{ flexShrink: 0, fontWeight: 600, color: shared ? COLORS.clayInk : COLORS.ink2 }}>
          {fmtMinutes(shared ? perPersonMin : client.duration)}
        </span>
        {recurring && <RefreshCw size={10} style={{ flexShrink: 0, color: shared ? COLORS.clayInk : COLORS.ink3 }} />}
      </div>
    );
  }

  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} actions={weekNav} />

        {/* Legenda (documento, 5.3: "a sua parte da visita, laranja = com
            mais pessoas, quinzenal"). */}
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

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label={t.backLabel}>
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <h1 style={mobStyles.title}>{t.title}</h1>
      <div style={mobStyles.weekNav}>
        <button type="button" aria-label={t.previousWeek} style={{ ...mobStyles.periodNav, width: 48, height: 48 }} onClick={() => goWeek(-1)}><ChevronLeftMini /></button>
        <span style={mobStyles.weekLabel}>{weekLabelPT(weekStart, lang)}</span>
        <button type="button" aria-label={t.nextWeek} style={{ ...mobStyles.periodNav, width: 48, height: 48 }} onClick={() => goWeek(1)}><ChevronRightMini /></button>
      </div>
      <div style={mobStyles.dayList}>
        {AGENDA_DAYS.map((day) => {
          const occ = getDayOccurrences(day);
          const totalMin = getDayTotalMinutes(day, occ);
          const isExpanded = expandedDay === day;
          const isToday = isCurrentWeek && day === todayDay;
          const summary = daySummaryLine(occ);
          return (
            <div key={day} style={mobStyles.dayCard}>
              <button
                style={{ ...mobStyles.agendaDayHeader, minHeight: 72, borderBottom: isExpanded ? `1px solid ${COLORS.border}` : "none" }}
                onClick={() => setExpandedDay(isExpanded ? null : day)}
              >
                <span style={{ ...mobStyles.dayHeaderLeft, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={mobStyles.dayAbbrBold}>{dayLabels[day]}</span>
                    {isToday && <span style={{ ...mobStyles.todayDot, background: COLORS.clay }} />}
                  </span>
                  {/* Novo (documento, 5.3): resumo dos clientes numa linha
                      quando o dia está fechado, pra dar pra ver sem abrir. */}
                  {!isExpanded && summary && (
                    <span style={{ fontSize: 11.5, color: COLORS.ink3 }}>{summary}</span>
                  )}
                </span>
                {occ.length === 0
                  ? <span style={{ fontSize: 12, color: COLORS.ink3 }}>{t.noClientsShort}</span>
                  : <Pill>{fmtMinutes(totalMin)}</Pill>}
              </button>
              {isExpanded && (
                <div style={mobStyles.agendaDayBody}>
                  {occ.length === 0 ? (
                    <div style={mobStyles.emptyDay}>{t.noClients}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {occ.map((c) => <ClientCard key={c.id} day={day} client={c} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EmployeeAgendaScreen;
