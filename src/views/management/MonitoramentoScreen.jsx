import { useState } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import {
  getOpenPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, formatPeriodLabel, isoDateStr, pad2,
  clientById, clientAppliesThisWeek, startOfISOWeek, dayIsCovered, isStaffActive,
} from "../../models/utils.js";
import { T, DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import {
  PageHeader, MobileHeader, Card, Pill, Avatar, FilterChip, SearchField, Button, Drawer, DataTable,
} from "../shared/ui/index.js";

// Monitoramento — documento de design, secções 4.4/4.5 (mesmo ficheiro; o
// texto do documento fala em "4.4, 4.5" para a gerência) e 5.8 (a mesma
// extração, mais compacta, para o supervisor). Ambos os ramos partilham a
// mesma lógica de blocos/furos (`weeksInfoFor`) — só a apresentação muda.
//
// Decisão sem confirmação prévia do Iago (a registar no LEIA-ME): a secção
// 5.8 não está listada explicitamente na ordem "4a-4k" da secção 7 do
// documento (só "4c Horas e Monitoramento da gerência (4.4, 4.5)" aparece
// nomeado) — mas como os dois ramos vivem neste mesmo ficheiro/componente,
// redesenhar só um deles deixaria o outro com um visual completamente
// desencontrado (tabela/gaveta novas dum lado, cartões antigos do outro).
// Optei por redesenhar os dois já nesta leva.
function MonitoramentoScreen({ lang, setLang, staff, clients, horasData, assignments, cutoffDay, closedPeriods, onHome }) {
  const t = T[lang].monitoramento;
  const th = T[lang].horas;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [openStaffId, setOpenStaffId] = useState(null);
  const tier = useBreakpoint();
  const isSupervisorView = !!onHome;

  // Período aberto pelo histórico real de fechamentos (não por TODAY puro —
  // ver getOpenPeriod), em blocos "opção B" (6.1): normalmente 4, dois deles
  // com 8 dias quando há fusão nas pontas.
  const payPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const periodLabel = formatPeriodLabel(payPeriod, lang);
  const blocks = weekBlocksOfPayPeriod(payPeriod, cutoffDay);

  function isoWeekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }

  // Tinha cliente agendado nesse dia? (assignments + frequência real da
  // semana, igual ao que a Agenda do funcionário já usa.) Sem isto, todo dia
  // sem lançamento contava como "furo" — incluindo sábados/domingos sem
  // agenda nenhuma, ou semanas de clientes quinzenais/mensais que nem
  // deviam aparecer naquela semana. Duplicado (de propósito, ver LEIA-ME)
  // do helper interno de `staffWithGapsCount` (utils.js, Etapa 4b): aquela
  // função só devolve uma contagem, e aqui precisamos do detalhe por bloco
  // (dias, estados) tanto para a tabela da gerência como para a gaveta de
  // extrato — consolidar as duas exigiria mudar a assinatura pública de
  // `staffWithGapsCount`, o que ficou fora do risco aceitável desta leva.
  function hasAgendaOnDay(staffId, d) {
    const clientIds = assignments[`${staffId}-${isoWeekday(d)}`] || [];
    const weekStart = startOfISOWeek(d);
    return clientIds.some((id) => {
      const c = clientById(clients, id);
      return c && clientAppliesThisWeek(c, weekStart);
    });
  }

  // Calculado à parte (não só dentro do .map de `monitored`) porque também é
  // usado para o funcionário aberto na gaveta, que pode não estar mais na
  // lista filtrada se a pesquisa mudar enquanto a gaveta está aberta.
  function weeksInfoFor(s) {
    const h = horasData[s.id] || { entries: [], lockedWeeks: {}, noClientDays: [] };
    const migratedLocked = migrateLockedWeeksToBlocks(h.lockedWeeks, payPeriod, cutoffDay);
    return blocks.map((chunk) => {
      const chunkKey = isoDateStr(chunk.start);
      const locked = !!migratedLocked[chunkKey];
      const notStarted = chunk.start > TODAY;
      const days = calPeriodDays(chunk);
      const dayStatuses = days.map((d) => {
        const dKey = isoDateStr(d);
        if (dayIsCovered(h, dKey)) return "filled";
        if (!hasAgendaOnDay(s.id, d)) return "no-agenda";
        if (d > TODAY) return "future";
        return "missed";
      });
      const gaps = locked || notStarted ? 0 : dayStatuses.filter((st) => st === "missed").length;
      return { chunk, locked, notStarted, days, dayStatuses, gaps };
    });
  }

  const monitored = staff
    // Etapa 4j (4.9): troca `s.status === "ativo"` pelo auxiliar único
    // isStaffActive — sem mudança de comportamento hoje, porque este ecrã
    // já excluía TODO o Replacement (não só o expirado, ver t.inactiveNote
    // logo abaixo, decisão de desenho anterior a esta etapa), mas fica
    // coerente com o resto do app caso essa exclusão mude no futuro.
    .filter((s) => isStaffActive(s, TODAY) && s.accountType === "fixo")
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .map((s) => {
      const weeksInfo = weeksInfoFor(s);
      const totalGaps = weeksInfo.reduce((sum, w) => sum + w.gaps, 0);
      return { staffMember: s, weeksInfo, totalGaps };
    })
    .sort((a, b) => b.totalGaps - a.totalGaps || a.staffMember.name.localeCompare(b.staffMember.name));

  const totalWithGaps = monitored.filter((m) => m.totalGaps > 0).length;
  const totalOk = monitored.length - totalWithGaps;
  const totalGapsSum = monitored.reduce((s, m) => s + m.totalGaps, 0);
  const visibleMonitored = onlyGaps ? monitored.filter((m) => m.totalGaps > 0) : monitored;

  const openStaff = staff.find((s) => s.id === openStaffId);
  const openWeeksInfo = openStaff ? weeksInfoFor(openStaff) : [];
  // Regra do documento (4.5): a frase solta "Ainda não há lançamentos neste
  // período" só aparece se não houver NENHUM lançamento no período *e* não
  // houver nenhum bloco já começado (senão os cartões por bloco já contam a
  // história toda, e a frase ficaria redundante/alarmista à toa).
  const openHorasEntries = openStaffId ? (horasData[openStaffId]?.entries || []) : [];
  const openHasAnyEntryInPeriod = openHorasEntries.some((e) => !e.voided && e.date >= isoDateStr(payPeriod.start) && e.date <= isoDateStr(payPeriod.end));
  const openHasAnyPastBlock = openWeeksInfo.some((w) => !w.notStarted);
  const showEmptyExtractMessage = !!openStaff && !openHasAnyEntryInPeriod && !openHasAnyPastBlock;

  // ---------------------------------------------------------------------
  // Gaveta de extrato (comum aos dois ramos, "mesmas regras de 4.5").
  // ---------------------------------------------------------------------
  const extractDrawer = (
    <Drawer
      open={!!openStaff}
      onClose={() => setOpenStaffId(null)}
      width={560}
      avatar={openStaff && <Avatar name={openStaff.name} size={36} />}
      title={openStaff && t.staffReportTitle(openStaff.name)}
    >
      {openStaff && (
        showEmptyExtractMessage ? (
          <div style={{ ...styles.noResults }}>{t.noEntriesYet}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {openWeeksInfo.map((w, wi) => {
              const hasGaps = !w.locked && !w.notStarted && w.gaps > 0;
              return (
                <div
                  key={wi}
                  style={{
                    borderRadius: RADIUS.card,
                    border: `1px solid ${hasGaps ? COLORS.alert : COLORS.line}`,
                    borderLeft: hasGaps ? `4px solid ${COLORS.alert}` : `1px solid ${COLORS.line}`,
                    padding: "12px 14px",
                    background: hasGaps ? COLORS.alertTint : COLORS.card,
                    opacity: w.notStarted ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.ink }}>{calPeriodLabel(w.chunk, lang)}</div>
                    {w.notStarted ? (
                      <span style={{ color: COLORS.ink3, fontWeight: 700, fontSize: 12 }}>–</span>
                    ) : hasGaps ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.alert, fontWeight: 700, fontSize: 12 }}>
                        <AlertTriangle size={13} />{t.staffDaysMissing(w.gaps)}
                      </span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.ok, fontWeight: 700, fontSize: 12 }}>
                        <Check size={13} />{t.weekUpToDate}
                      </span>
                    )}
                  </div>
                  {hasGaps && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {w.days.map((d, di) => (
                        w.dayStatuses[di] === "missed" && (
                          <span
                            key={di}
                            style={{
                              fontSize: 11, fontWeight: 700, color: COLORS.alert, background: COLORS.card,
                              border: `1px solid ${COLORS.alert}`, borderRadius: 6, padding: "3px 8px",
                            }}
                          >
                            {dayAbbr[d.getDay()].toLowerCase()} {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </Drawer>
  );

  // Colunas da DataTable (2.8) — uma por bloco do período, geradas
  // dinamicamente a partir de `blocks` (normalmente 4), mais a coluna do
  // nome e a de total em falta com o botão "Ver extrato" (documento, 4.5:
  // "última coluna: total em falta + botão 'Ver extrato'").
  const tableColumns = [
    {
      key: "staff", label: th.colStaff, width: 2,
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <Avatar name={row.staffMember.name} size={32} />
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.staffMember.name}</span>
        </div>
      ),
    },
    ...blocks.map((chunk, bi) => ({
      key: `block-${bi}`, label: calPeriodLabel(chunk, lang), width: 1,
      render: (row) => {
        const w = row.weeksInfo[bi];
        if (w.locked) return <span style={{ display: "inline-flex", alignItems: "center", color: COLORS.ink3 }}><Lock size={13} /></span>;
        if (w.notStarted) return <span style={{ color: COLORS.ink3 }}>–</span>;
        if (w.gaps > 0) return <Pill variant="missing">{t.cellGaps(w.gaps)}</Pill>;
        return <Pill variant="paid">{t.cellOk}</Pill>;
      },
    })),
    {
      key: "gaps", label: t.colGaps, width: 1.4,
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={(ev) => ev.stopPropagation()}>
          {row.totalGaps > 0 && <span style={{ fontWeight: 700, color: COLORS.alert, fontSize: 13 }}>{row.totalGaps}</span>}
          <Button variant="secondary" onClick={() => setOpenStaffId(row.staffMember.id)}>{t.viewExtract}</Button>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------
  // Ramo gerência (4.5): PageHeader + faixa de 3 números + chips + pesquisa
  // + tabela (uma coluna por bloco) + gaveta de extrato.
  // ---------------------------------------------------------------------
  if (!isSupervisorView) {
    return (
      <div style={styles.content}>
        <PageHeader
          title={t.title} subtitle={t.subtitlePeriodUpdated(periodLabel)}
          lang={lang} setLang={setLang} langNames={LANG_NAMES}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <Card style={{ flex: "1 1 160px", padding: "14px 16px" }}>
            <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.summaryOk}</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 24, color: COLORS.ok }}>{totalOk}</div>
          </Card>
          <Card style={{ flex: "1 1 160px", padding: "14px 16px" }}>
            <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.summaryWithGaps}</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 24, color: totalWithGaps > 0 ? COLORS.alert : COLORS.ink }}>{totalWithGaps}</div>
          </Card>
          <Card style={{ flex: "1 1 160px", padding: "14px 16px" }}>
            <div style={{ fontSize: 11.5, color: COLORS.ink2, marginBottom: 4 }}>{t.summaryTotalGaps}</div>
            <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 24, color: totalGapsSum > 0 ? COLORS.alert : COLORS.ink }}>{totalGapsSum}</div>
          </Card>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FilterChip active={onlyGaps} onClick={() => setOnlyGaps(true)} count={totalWithGaps}>{t.chipOnlyGaps}</FilterChip>
            <FilterChip active={!onlyGaps} onClick={() => setOnlyGaps(false)} count={monitored.length}>{t.chipAllStaff}</FilterChip>
          </div>
          <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
        </div>

        <DataTable
          columns={tableColumns}
          rows={visibleMonitored}
          getRowId={(row) => row.staffMember.id}
          onRowClick={(row) => setOpenStaffId(row.staffMember.id)}
          emptyMessage={t.noResults}
        />

        <div style={{ ...styles.defSettingHint, marginTop: 12 }}>{t.inactiveNote}</div>

        {extractDrawer}
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Ramo supervisor (5.8): cabeçalho mobile + faixa de 2 números + lista
  // neutra de cartões + a mesma gaveta de extrato de cima. `useBreakpoint`
  // (em vez do antigo `useIsMobile`/`mobStyles.phone` fixo) segue o mesmo
  // padrão já usado em `EmployeeHorasScreen.jsx` (Etapa 4a): o ecrã ganha
  // uma largura máxima maior em tablet/PC em vez de ficar sempre
  // encaixotado num "telemóvel" de 460px independentemente do ecrã real.
  // ---------------------------------------------------------------------
  const containerMaxWidth = tier === "desktop" ? 720 : tier === "tablet" ? 640 : 460;
  return (
    <div style={{ padding: "16px 16px 32px", maxWidth: containerMaxWidth, margin: "0 auto" }}>
      <MobileHeader onBack={onHome} backLabel={t.backLabel} title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 4 }}>{t.subtitlePeriodOnly(periodLabel)}</div>
      <div style={{ fontSize: 14, color: COLORS.ink2, marginBottom: 16 }}>{t.tapToSeeDetail}</div>

      <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} mobile style={{ marginBottom: 14 }} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: RADIUS.control, background: totalWithGaps > 0 ? COLORS.alertTint : COLORS.okTint, color: totalWithGaps > 0 ? COLORS.alert : COLORS.okInk, fontSize: 13, fontWeight: 700 }}>
          {totalWithGaps > 0 ? <AlertTriangle size={15} /> : <Check size={15} />}
          {t.summaryWithGapsCount(totalWithGaps)}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: RADIUS.control, background: COLORS.okTint, color: COLORS.okInk, fontSize: 13, fontWeight: 700 }}>
          <Check size={15} />
          {t.summaryOkCount(totalOk)}
        </div>
      </div>

      {monitored.length === 0 ? (
        <div style={styles.noResults}>{t.noResults}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {monitored.map(({ staffMember: s, totalGaps }) => (
            <button
              key={s.id}
              onClick={() => setOpenStaffId(s.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: 64, padding: "0 16px",
                borderRadius: RADIUS.card, border: `1px solid ${COLORS.line}`, background: COLORS.card, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={s.name} size={36} />
                <span style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </div>
              {totalGaps > 0 ? (
                <Pill variant="missing">{t.staffDaysMissing(totalGaps)}</Pill>
              ) : (
                <Pill variant="paid"><Check size={11} /> {t.summaryOk}</Pill>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ ...styles.defSettingHint, marginTop: 14 }}>{t.inactiveNote}</div>

      {extractDrawer}
    </div>
  );
}

export default MonitoramentoScreen;
