import { Users, Building2, RotateCcw, Clock, Undo2, Bell, Calendar, Check } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { useBreakpoint, useControlSize } from "../../hooks/useBreakpoint.js";
import { TODAY, LANG_NAMES } from "../../models/data.js";
import {
  clientById, parseDMY, getOpenPeriod, formatPeriodLabel, staffTotalHours, staffTotalPay,
  recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner, fmtEuro, compactEuro, fmtHoursScreen,
  monthAbbr, isStaffActive, boardStaff, activeClientsCount,
} from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import {
  PageHeader, Card, KpiCard, SegmentedBar, Avatar, ReclamacoesCard, PeriodBarChart, PeriodLineChart,
} from "../shared/ui/index.js";

// Pequeno "tile" de data (documento, 4.1 — cartão de Notas): 46×46, dia
// grande + mês em maiúsculas, clay-ink. Nenhum dos formatadores que já
// existiam (`fmtNoteDate`, que devolve "DD/MM" numa única linha) desenha
// isto — por isso um componente novo, só para este cartão.
function NoteDateTile({ iso, lang }) {
  const [, m, d] = iso.split("-");
  return (
    <div
      style={{
        width: 46, height: 46, borderRadius: RADIUS.chip, background: COLORS.clayTint,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: 17, lineHeight: 1, color: COLORS.clayInk }}>
        {Number(d)}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.clayInk, marginTop: 3 }}>
        {monthAbbr(lang, Number(m) - 1)}
      </div>
    </div>
  );
}

// Linha de "Pendências" (documento, 4.1): bloco de ícone 38, texto,
// contagem em quadrado 34 — ou, quando a contagem é 0, a linha inteira
// esbatida com "✓ Em dia" no lugar do quadrado. A cor âmbar (documento:
// só a linha "Horas extra por aprovar") só aparece quando há mesmo
// alguma coisa pendente — com contagem 0 fica neutra como as outras,
// pela mesma regra de QA geral do documento ("nenhuma cor de alerta em
// elementos que não sejam erro ou falta").
function PendingRow({ icon: Icon, label, count, amber, onClick, okLabel, last }) {
  const isZero = count === 0;
  const useAmber = amber && !isZero;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 2px",
        border: "none", borderBottom: last ? "none" : `1px solid ${COLORS.line}`, background: "transparent",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit", opacity: isZero ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: 38, height: 38, borderRadius: RADIUS.chip, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: useAmber ? COLORS.amberBg : COLORS.forest50,
          color: useAmber ? COLORS.amberInk : COLORS.forest600,
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, fontSize: 13.5, color: COLORS.ink }}>{label}</div>
      {isZero ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: COLORS.ok, flexShrink: 0 }}>
          <Check size={14} /> {okLabel}
        </div>
      ) : (
        <div
          style={{
            width: 34, height: 34, borderRadius: RADIUS.chip, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: useAmber ? COLORS.amberBg : COLORS.lineSoft,
            color: useAmber ? COLORS.amberInk : COLORS.ink,
            fontWeight: 700, fontSize: 14,
          }}
        >
          {count}
        </div>
      )}
    </button>
  );
}

// Dashboard (documento de design, secção 4.1) — "dizer em 5 segundos
// quanto há a pagar, o que precisa de atenção e como vai o mês". A lógica
// de negócio por trás de cada número já estava correta (Etapas 0/4b) —
// aqui só muda a apresentação: cartão herói + 3 KPIs na mesma linha,
// Pendências com o novo comportamento "contagem 0 = em dia", o
// componente de Reclamações (2.13) no lugar do velocímetro, um único
// cartão de Notas (o documento pede explicitamente que o duplicado
// desapareça) e os dois gráficos de 6 períodos (2.14) no lugar dos SVGs
// antigos.
function DashboardScreen({ lang, setLang, company, clients, staff, horasData, missingItems, sentItems, contractAlertDays, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount, cutoffDay, closedPeriods, personalNotes, onNavigate }) {
  const t = T[lang].dashboard;
  const th = T[lang].horas;
  const tn = T[lang].notas;
  // Lote 4, 4.4 (achado da Marta, item "Ver todas →" 87×19): usado abaixo
  // no link "Ver todas" do cartão de Notas — mesma régua do resto.
  const { height: seeAllHeight } = useControlSize();
  // Lote 4, 4.7 (achado da Marta): a Linha 1 (herói + 3 KPIs) usava
  // `flex-wrap`, e a 922px o Replacement quebrava pra uma 2ª linha sozinho
  // e esticava (922×172 — 172 é o `minHeight` do próprio KpiCard). Grade
  // fixa por `tier` em vez disso: nunca quebra dentro de um nível.
  const tier = useBreakpoint();
  // Etapa 4j (4.9): usa o mesmo auxiliar isStaffActive de todo o app, em
  // vez de só `s.status === "ativo"` — uma conta Replacement cuja validade
  // já passou deixa de contar aqui também, coerente com a pílula "Inativo"
  // que já mostra em Funcionários e com o facto de já não aparecer em
  // Agendas/Monitoramento. Antes desta etapa não havia essa distinção.
  const activeStaff = staff.filter((s) => isStaffActive(s, TODAY));
  const currentPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const currentPeriodLabel = formatPeriodLabel(currentPeriod, lang);

  // Mesma fórmula do cartão herói de Horas (4.4) — os dois ecrãs mostram
  // literalmente os mesmos números (total a receber, horas, pagos/por
  // pagar/pendentes), por isso o cálculo tem de bater certo nos dois.
  const currentPeriodHours = staff.reduce((s, st) => s + staffTotalHours(horasData[st.id] || { entries: [] }, currentPeriod), 0);
  const currentPeriodEuros = staff.reduce((s, st) => s + staffTotalPay(horasData[st.id] || { entries: [] }, clients, currentPeriod), 0);
  // QA pós-auditoria (Lote 1): mesmo `board` do cartão herói de Horas (ver
  // `boardStaff` em utils.js) — antes este cartão contava `staff` inteiro
  // (incluindo inativos e contas de teste), por isso pagos+por
  // pagar+pendentes não batia com "Funcionários ativos" nem com o mesmo
  // cartão em Horas.
  const board = boardStaff(staff, horasData, currentPeriod, TODAY);
  const kpiCounts = board.reduce((acc, s) => {
    const h = horasData[s.id] || { status: "pendente", paid: false };
    if (h.status === "pendente") acc.pending += 1;
    if (h.paid) acc.paid += 1;
    if (h.status === "finalizado" && !h.paid) acc.unpaid += 1;
    return acc;
  }, { pending: 0, paid: 0, unpaid: 0 });

  let overtimePending = 0, reopenedCount = 0;
  Object.values(horasData).forEach((data) => {
    if (data.reopened) reopenedCount += 1;
    data.entries.forEach((e) => { if (e.extra && !e.approved && !e.voided) overtimePending += 1; });
  });
  // "Avisos e pedidos por ler" (documento, 4.1): não existe, em lado
  // nenhum do modelo de dados, um sinal de "a gerência ainda não viu esta
  // solicitação nova" — `.read` em `sentItems` é só do lado do
  // funcionário (se ele já viu a RESPOSTA da gerência). O próprio ecrã de
  // Avisos (gerência) já usa esta mesma contagem para o selo de
  // "Solicitações" — reaproveitada aqui tal e qual.
  const pendingRequests = missingItems.filter((m) => !m.resolved).length;

  const contractsNearExpiry = clients.filter((c) => {
    const end = parseDMY(c.contractEnd);
    const diffDays = (end - TODAY) / (24 * 60 * 60 * 1000);
    return diffDays >= 0 && diffDays <= contractAlertDays;
  }).length;
  // QA pós-auditoria (Lote 3, "Contratos a vencer"): a conta acima
  // (`diffDays >= 0`) sempre ignorou os contratos JÁ vencidos — por isso o
  // cartão de Pendências dizia "Em dia" mesmo havendo vencidos (hoje 4).
  // Conta nova, à parte (mesma regra de `kind: "expired"` de
  // `contractStatus`, ClientesScreen.jsx), com a sua própria linha —
  // somar às "a vencer" escondia de volta a urgência maior dos vencidos.
  const contractsExpired = clients.filter((c) => {
    const end = parseDMY(c.contractEnd);
    const diffDays = (end - TODAY) / (24 * 60 * 60 * 1000);
    return diffDays < 0;
  }).length;

  const replacementClientsActive = clients.filter((c) => {
    if (c.clientType !== "replacement") return false;
    if (!c.clientValidUntil) return true;
    return new Date(c.clientValidUntil) >= TODAY;
  }).length;

  const complaintsCurrent = sentItems.filter((i) => i.type === "reclamacao").length;
  // Limites escalam com o tamanho da carteira de clientes (configurado em
  // Definições como "reclamações a cada N clientes"), em vez de um valor fixo.
  const excelenteThreshold = Math.max(0, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoExcelenteCount ?? 1)));
  const razoavelThreshold = Math.max(excelenteThreshold + 1, Math.round((clients.length / (reclamacaoBaseClients || 10)) * (reclamacaoRazoavelCount ?? 3)));
  // `sentItems[].date` nem sempre é ISO: dados-exemplo antigos usam
  // "DD/MM", lançamentos novos (AvisosScreen.jsx) usam isoDateStr (ex.:
  // "2026-09-26") — o resto do app já mostra este campo em bruto, sem
  // formatar (AvisosWidgets.jsx, `{it.date}`); reaproveitado aqui do mesmo
  // jeito. (QA pós-auditoria: `fmtNoteDate` já entende os dois formatos —
  // deixou de ser o motivo de não o usar aqui; manter em bruto continua
  // sendo o comportamento certo, só não é mais por causa do bug antigo.)
  const recentComplaints = sentItems
    .filter((i) => i.type === "reclamacao")
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map((i) => ({ client: clientById(clients, i.clientId)?.name || "—", date: i.date }));

  const myNotes = notesForOwner(personalNotes, "management");

  // Gráficos de 6 períodos (documento, 2.14): os 5 períodos FECHADOS mais
  // recentes (ordem cronológica) + o período ABERTO agora como 6º/último
  // item — é esse último item que os componentes de gráfico tratam como
  // "o período atual" (destacado, gradiente/ponto). Com menos de 5
  // fechados, o gráfico simplesmente mostra menos barras/pontos — nunca
  // inventa períodos vazios.
  const recentClosed = recentClosedPeriodsChronological(closedPeriods, 5);
  const currentLabel = monthAbbr(lang, currentPeriod.end.getMonth());
  const valueChartData = [
    ...recentClosed.map((p) => ({ label: shortMonthFromIso(p.periodEnd, lang), value: p.totalEuros, dateRangeLabel: p.periodLabel })),
    { label: currentLabel, value: currentPeriodEuros, dateRangeLabel: currentPeriodLabel },
  ];
  const hoursChartData = [
    ...recentClosed.map((p) => ({ label: shortMonthFromIso(p.periodEnd, lang), value: p.totalHours, dateRangeLabel: p.periodLabel })),
    { label: currentLabel, value: currentPeriodHours, dateRangeLabel: currentPeriodLabel },
  ];

  const row = { display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 20 };
  // Lote 4, 4.7: herói com 1,5 parte e os três KPIs com 1 parte cada, na
  // mesma linha no desktop; 2 por 2 no tablet; 1 coluna no celular. Grid
  // (não flex) porque não deve quebrar dentro de um nível — é exatamente
  // isso que fazia o Replacement esticar sozinho a 922px.
  const kpiRow = {
    display: "grid",
    gridTemplateColumns: tier === "desktop" ? "1.5fr 1fr 1fr 1fr" : tier === "tablet" ? "1fr 1fr" : "1fr",
    gap: 20,
    marginBottom: 20,
  };

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} subtitle={formatTodayLabel(lang)} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      {/* Linha 1 — 4 KPIs (herói + 3), documento 4.1 */}
      <div style={kpiRow}>
        <Card variant="hero">
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>{th.heroTitle}</div>
          <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 28, marginBottom: 2 }}>{fmtEuro(currentPeriodEuros)}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 14 }}>{fmtHoursScreen(currentPeriodHours)} · {currentPeriodLabel}</div>
          <SegmentedBar
            onHero
            segments={[
              { value: kpiCounts.paid, color: "#fff" },
              { value: kpiCounts.unpaid, color: COLORS.clay },
              { value: kpiCounts.pending, color: "rgba(255,255,255,.28)" },
            ]}
          />
          <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 8 }}>
            {th.heroLegend(kpiCounts.paid, kpiCounts.unpaid, kpiCounts.pending)}
          </div>
        </Card>

        <KpiCard icon={Users} label={t.kpiStaffActive} value={activeStaff.length}>
          <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
            {activeStaff.slice(0, 5).map((s, i) => (
              <div key={s.id} style={{ marginLeft: i === 0 ? 0 : -10, borderRadius: "50%", border: "2px solid #fff", boxShadow: `0 0 0 1px ${COLORS.line}` }}>
                <Avatar name={s.name} size={28} />
              </div>
            ))}
            {activeStaff.length > 5 && (
              <div
                style={{
                  marginLeft: -10, width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: COLORS.forest700, color: "#fff", border: "2px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                }}
              >
                +{activeStaff.length - 5}
              </div>
            )}
          </div>
        </KpiCard>

        {/* QA pós-auditoria (Lote 3, item 4 do briefing — "'Ativo' com uma
            definição só"): usa a mesma `activeClientsCount` do subtítulo
            de ClientesScreen.jsx, pra nunca divergir. Reconfirmado pelo
            Iago em 04/10: conta todo cliente cadastrado (41). */}
        <KpiCard icon={Building2} label={t.kpiClients} value={activeClientsCount(clients, TODAY)} />

        <KpiCard
          icon={RotateCcw} label={t.kpiReplacementClients} value={replacementClientsActive}
          iconBg={COLORS.clayTint} iconColor={COLORS.clayInk}
        />
      </div>

      {/* Linha 2 — Pendências, Reclamações, Notas (documento 4.1) */}
      <div style={row}>
        {/* Lote 4, 4.1 (achado da Marta): `minWidth: 320` não cabia no
            conteúdo disponível em 375px com a sidebar já recolhida a
            ícones (os outros dois cartões desta linha, 240/260, cabiam —
            só este estourava, até uns 413px de ponta direita). Descia
            para 260 — o mesmo piso já usado no cartão de Notas ao lado,
            que nunca deu problema — sem mudar a largura preferida (420)
            que já era usada em telas largas. */}
        <Card style={{ flex: "1 1 420px", minWidth: 260 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>{t.pendingTitle}</div>
          <PendingRow icon={Clock} label={t.pendingOvertime} count={overtimePending} amber onClick={() => onNavigate("horas")} okLabel={t.pendingAllOk} />
          <PendingRow icon={Undo2} label={t.pendingReopened} count={reopenedCount} onClick={() => onNavigate("horas")} okLabel={t.pendingAllOk} />
          <PendingRow icon={Bell} label={t.pendingUnread} count={pendingRequests} onClick={() => onNavigate("avisos")} okLabel={t.pendingAllOk} />
          {/* "Contratos a vencer -> Clientes (filtro)": a navegação ainda não
              sabe levar um filtro pré-aplicado (Clientes em si só é
              redesenhado na 4f) — por agora só abre a tela, como o
              Dashboard antigo já fazia. */}
          <PendingRow icon={Calendar} label={t.pendingContracts} count={contractsNearExpiry} onClick={() => onNavigate("clientes")} okLabel={t.pendingAllOk} />
          {/* QA pós-auditoria (Lote 3): linha própria para os já vencidos —
              "Em dia" só aparece quando NEM esta nem a de cima têm contagem. */}
          <PendingRow icon={Calendar} label={t.pendingContractsExpired} count={contractsExpired} amber onClick={() => onNavigate("clientes")} okLabel={t.pendingAllOk} last />
        </Card>

        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <ReclamacoesCard
            current={complaintsCurrent} excelenteThreshold={excelenteThreshold} razoavelThreshold={razoavelThreshold}
            recent={recentComplaints}
            title={t.complaintsTitle} subtitle={t.complaintsSubtitle}
            labels={{ excelente: t.gaugeExcelente, razoavel: t.gaugeRazoavel, critico: t.gaugeCritico }}
          />
        </div>

        <Card variant="warm" style={{ flex: "1 1 320px", minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: myNotes.length === 0 ? 0 : 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{tn.widgetTitle}</div>
            <button
              type="button" onClick={() => onNavigate("notas")}
              style={{
                border: "none", background: "transparent", color: COLORS.clayInk, fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", height: seeAllHeight, padding: "0 4px", display: "inline-flex", alignItems: "center",
              }}
            >
              {tn.seeAll} →
            </button>
          </div>
          {myNotes.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.ink2 }}>{tn.noNotes}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myNotes.slice(0, 3).map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <NoteDateTile iso={n.date} lang={lang} />
                  <div style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.35 }}>{n.text}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 3 — gráficos de 6 períodos (documento 2.14) */}
      <div style={row}>
        <Card style={{ flex: "1 1 380px", minWidth: 300 }}>
          <PeriodBarChart
            data={valueChartData}
            valueFormatter={compactEuro}
            currentValueLabel={fmtEuro(valueChartData[valueChartData.length - 1].value)}
            title={t.historyValueTitle}
            comparisonLabel={t.vsPreviousPeriod}
          />
        </Card>
        <Card style={{ flex: "1 1 380px", minWidth: 300 }}>
          <PeriodLineChart
            data={hoursChartData}
            valueFormatter={fmtHoursScreen}
            averageLabel={t.averageHoursLabel}
            title={t.historyHoursTitle}
            comparisonLabel={t.vsPreviousPeriod}
          />
        </Card>
      </div>
    </div>
  );
}

export default DashboardScreen;
