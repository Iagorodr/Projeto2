import { AlertTriangle, Bell, Eye, Clock, CalendarDays, UsersRound, ChevronRight } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { FONT, RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint, useControlSize } from "../../hooks/useBreakpoint.js";
import {
  dayScheduledClients, thisWeekSummary, periodMissingDays, staffWithGapsCount, isStaffActive,
  fmtHoursScreen, pad2, isoDateStr, notesForOwner, fmtNoteDate,
  getOpenPeriod, weekBlocksOfPayPeriod,
} from "../../models/utils.js";
import { T, formatTodayLabel, WEEKDAY_FULL_BY_LANG, DAY_ABBR_SUN0_BY_LANG, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { Card, Button, Pill, ProgressBar, PageHeader, ClientCheckCard } from "../shared/ui/index.js";

const cardTitleStyle = { fontFamily: FONT.heading, fontWeight: 600, fontSize: 16, color: COLORS.ink };

// Estado visual de cada um dos 7 pontos do cartão "Esta semana" — ver
// comentário de `thisWeekSummary` em utils.js pros 4 estados possíveis.
function dotStyle(state) {
  switch (state) {
    case "registered": return { background: COLORS.forest600, border: `2px solid ${COLORS.forest600}` };
    case "missing": return { background: "transparent", border: `2px solid ${COLORS.alert}` };
    case "noClients": return { background: "transparent", border: `2px dashed ${COLORS.line}` };
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
  clients, staff, assignments, horasData, cutoffDay, closedPeriods, personalNotes,
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
  const isSupervisor = me.role === "supervisor";
  const horasEntry = horasData[me.id] || { entries: [], noClientDays: [] };
  const todayKey = isoDateStr(TODAY);

  // --- Hero "Hoje" ---
  // Etapa 4j (4.9): um dia já fora da validade de uma conta Replacement
  // mostra-se como "sem clientes", mesmo que a atribuição ainda exista.
  const todayClients = isStaffActive(me, TODAY) ? dayScheduledClients(clients, assignments, me.id, TODAY) : [];
  const totalTodayHours = todayClients.reduce((s, c) => s + (c.duration || 0) / 60, 0);
  function isClientCheckedToday(clientId) {
    return (horasEntry.entries || []).some(
      (e) => !e.voided && e.clientId === clientId && (e.date === todayKey || e.replacesDate === todayKey)
    );
  }

  // --- "Esta semana" ---
  const week = thisWeekSummary(clients, assignments, me.id, horasEntry, TODAY, me);

  // --- "Precisa da sua atenção" ---
  const payPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const payPeriodChunks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);
  const missingDays = periodMissingDays(clients, assignments, me.id, horasEntry, payPeriodChunks, TODAY, me);
  // QA pós-auditoria (Lote 2, "dias em falta na equipa" contando dias):
  // `staffWithGapsCount` passou a devolver { staffCount, totalDays } — o
  // cartão mostra `totalDays` (bate com o total do Monitoramento) e usa
  // `staffCount` só na legenda de apoio ("X funcionários").
  const teamGaps = isSupervisor
    ? staffWithGapsCount(staff, horasData, clients, assignments, payPeriod, payPeriodChunks, cutoffDay, TODAY)
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

  const heroCard = (
    <Card variant="hero">
      <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 20, marginBottom: todayClients.length ? 4 : 8 }}>
        {t.heroTitle}
      </div>
      {todayClients.length === 0 ? (
        <div style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.4 }}>{t.heroEmptyTitle}</div>
      ) : (
        <>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 14 }}>{tHoras.forecast(fmtHoursScreen(totalTodayHours))}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todayClients.map((cl) => (
              <ClientCheckCard
                key={cl.id}
                name={cl.name}
                subtitle={tHoras.forecast(fmtHoursScreen((cl.duration || 0) / 60))}
                checked={isClientCheckedToday(cl.id)}
                readOnly
              />
            ))}
          </div>
          <Button variant="secondary" onClick={() => onNavigate("horas")} style={{ marginTop: 16, width: "100%" }}>
            {t.heroRegisterButton}
          </Button>
        </>
      )}
    </Card>
  );

  const weekCard = (
    <Card>
      <div style={cardTitleStyle}>{t.weekCardTitle}</div>
      <ProgressBar
        value={week.registeredHours} max={week.scheduledHours || 1}
        label={t.weekRegisteredLabel(fmtHoursScreen(week.registeredHours), fmtHoursScreen(week.scheduledHours))}
        style={{ marginTop: 12 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 16 }}>
        {week.days.map((d, i) => (
          <div key={d.dateKey} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.ink3 }}>{dayLabels17[i + 1]?.[0]}</span>
            <span
              style={{
                width: 20, height: 20, borderRadius: "50%", boxSizing: "border-box",
                ...dotStyle(d.state),
                outline: d.isToday ? `2px solid ${COLORS.forest200}` : "none", outlineOffset: 2,
              }}
            />
          </div>
        ))}
      </div>
    </Card>
  );

  const attentionCard = (
    <Card>
      <div style={cardTitleStyle}>{t.attentionTitle}</div>
      {attentionItems.length === 0 ? (
        <div style={{ fontSize: 14, color: COLORS.ink2, marginTop: 10 }}>{t.attentionAllOk}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {attentionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key} type="button" onClick={item.onClick}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  padding: "10px 12px", borderRadius: RADIUS.chip, border: `1px solid ${COLORS.line}`,
                  background: COLORS.card, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: COLORS.alertTint, color: COLORS.alert,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>
                    {item.label} ({item.count})
                  </span>
                  {item.subtitle && (
                    <span style={{ display: "block", fontSize: 12, color: COLORS.ink2, marginTop: 2 }}>{item.subtitle}</span>
                  )}
                </span>
                <ChevronRight size={16} color={COLORS.ink3} />
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  const notesCard = (
    <Card variant="warm">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={cardTitleStyle}>{tNotas.widgetTitle}</div>
        <button
          type="button" onClick={() => onNavigate("notas")}
          style={{
            border: "none", background: "transparent", color: COLORS.forest700, fontSize: 12.5, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", height: seeAllHeight, padding: "0 4px", display: "inline-flex", alignItems: "center",
          }}
        >
          {tNotas.seeAll}
        </button>
      </div>
      {notes.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 10 }}>{tNotas.noNotes}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.clayInk, minWidth: 34, flexShrink: 0 }}>{fmtNoteDate(n.date)}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: COLORS.ink, lineHeight: 1.4 }}>{n.text}</span>
              {n.date <= todayKey && <Pill variant="missing">{tNotas.dueTag}</Pill>}
            </div>
          ))}
        </div>
      )}
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
              padding: "16px 8px", borderRadius: RADIUS.chip, border: `1px solid ${COLORS.line}`,
              background: COLORS.card, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Icon size={20} strokeWidth={1.8} color={COLORS.forest700} />
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
    const dateShort = `${dayAbbrSun0[TODAY.getDay()]} ${pad2(TODAY.getDate())}/${pad2(TODAY.getMonth() + 1)}`;
    return (
      <div>
        <div
          style={{
            background: "linear-gradient(160deg, #2A8A73 0%, #1F6F5C 45%, #0F3129 100%)",
            borderRadius: RADIUS.card, padding: "18px 20px 34px", color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {isSupervisor ? (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", height: 24, padding: "3px 10px",
                  borderRadius: 999, fontSize: 12, fontWeight: 600, background: COLORS.clay, color: "#3A1A0D",
                }}
              >
                {T[lang].acessos.roleSupervisor}
              </span>
            ) : <span />}
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{dateShort}</span>
          </div>
          <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, marginTop: 14 }}>
            {tMenu.hello}, {me.name}
          </div>
        </div>
        <div style={{ padding: "0 4px", marginTop: -22, display: "flex", flexDirection: "column", gap: 16 }}>
          {heroCard}
          {weekCard}
          {attentionCard}
          {notesCard}
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
          {heroCard}
          {weekCard}
        </div>
        <div style={{ flex: "5 1 300px", minWidth: 280 }}>
          {attentionCard}
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
