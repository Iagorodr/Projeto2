import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Lock, ArrowLeft, Bell } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT, SHADOW } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import {
  getOpenPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, formatPeriodLabel, isoDateStr, pad2,
  clientById, clientAppliesOnDate, startOfISOWeek, dayIsCovered, isStaffActive, absenceOn, agendaClientIdsOn,
} from "../../models/utils.js";
import { T, DAY_ABBR_SUN0_BY_LANG } from "../../models/i18n.js";
import {
  PageHeader, MobileHeader, Card, Pill, Avatar, FilterChip, SearchField, Button, Drawer, DataTable, InfoTip, ChevronCircle, ConfirmDialog, Toast,
} from "../shared/ui/index.js";

// Botões das linhas: mais baixos que os do resto do ecrã (a tabela fica mais leve).
const ROW_BTN = { height: 34, padding: "0 12px", whiteSpace: "nowrap" };
import EmployeeHorasScreen from "../employee/EmployeeHorasScreen.jsx";

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
const fmtH = (h) => { const m = Math.round(h * 60); const hh = Math.floor(m / 60); const mm = m % 60; return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`; };

function MonitoramentoScreen({ lang, setLang, staff, clients, horasData, assignments, covers, cutoffDay, closedPeriods, absences, sentItems, setSentItems, onHome, company, setHorasData, setMissingItems }) {
  const t = T[lang].monitoramento;
  const th = T[lang].horas;
  const c0 = T[lang].common;
  const dayAbbr = DAY_ABBR_SUN0_BY_LANG[lang];
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [openStaffId, setOpenStaffId] = useState(null);
  // Gerência a preencher as horas de um funcionário: { staffId, date } (sub-página dentro do Monitoramento).
  const [fill, setFill] = useState(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [remindedIds, setRemindedIds] = useState([]); // lembrados nesta sessão (evita repetir sem querer)
  const tier = useBreakpoint();
  // Largura real da área do ecrã: abaixo de ~940px a tabela não cabe com uma
  // coluna por bloco (e rolar para o lado não é aceitável) — nesse caso só
  // ficam o funcionário e o total em falta; o detalhe por bloco continua no
  // extrato (gaveta).
  const wrapRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 940));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const isSupervisorView = !!onHome;
  const [weekIdx, setWeekIdx] = useState(null); // aba da semana (gerência); null = a semana de hoje

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
    if (absenceOn(absences, staffId, isoDateStr(d))) return false;
    const clientIds = agendaClientIdsOn(assignments, covers, staffId, d);
    return clientIds.some((id) => {
      const c = clientById(clients, id);
      return c && clientAppliesOnDate(c, d, covers);
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
        // Hoje ainda não acabou: aparece "hoje" e só conta como em falta a partir de amanhã.
        if (dKey === isoDateStr(TODAY)) return "today";
        return "missed";
      });
      const gaps = locked || notStarted ? 0 : dayStatuses.filter((st) => st === "missed").length;
      return { chunk, locked, notStarted, days, dayStatuses, gaps };
    });
  }

  // "Lembrar funcionário": deixa um aviso na caixa de Avisos dele (com o selo
  // de não lido no app). Um por funcionário e por dia, para não encher a caixa.
  // "Lembrar" é uma ação leve: sem pop-up, com "Desfazer" (documento, Confirmar vs. desfazer).
  const [undoRemind, setUndoRemind] = useState(null); // { id, staffId, name }
  const undoTimer = useRef(null);
  function remindStaff(staffId, gaps) {
    const today = isoDateStr(TODAY);
    const id = Date.now();
    setSentItems((prev) => [
      { id, type: "aviso", staffId, clientId: null, text: t.remindText(gaps), date: today, hasPhoto: false, seenByManagement: true },
      ...prev,
    ]);
    setRemindedIds((ids) => [...ids, staffId]);
    const who = (staff.find((s) => s.id === staffId) || {}).name || "";
    clearTimeout(undoTimer.current);
    setUndoRemind({ id, staffId, name: who.split(" ")[0] });
    undoTimer.current = setTimeout(() => setUndoRemind(null), 6000);
  }
  function undoLastRemind() {
    if (!undoRemind) return;
    const { id, staffId } = undoRemind;
    setSentItems((prev) => prev.filter((x) => x.id !== id));
    setRemindedIds((ids) => ids.filter((x) => x !== staffId));
    clearTimeout(undoTimer.current);
    setUndoRemind(null);
  }
  const remindToast = undoRemind ? (
    <Toast message={t.b1Reminded(undoRemind.name)} actionLabel={t.b1Undo} onAction={undoLastRemind}
      onDismiss={() => { clearTimeout(undoTimer.current); setUndoRemind(null); }} closeLabel={T[lang].common.close} />
  ) : null;

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
                  {!w.notStarted && !isSupervisorView && setHorasData && (
                    <div style={{ marginTop: 8 }}>
                      <Button
                        variant="secondary" style={{ padding: "0 12px" }}
                        onClick={() => {
                          const firstMissed = w.days.find((d, di) => w.dayStatuses[di] === "missed");
                          setOpenStaffId(null);
                          setFill({ staffId: openStaff.id, date: isoDateStr(firstMissed || w.chunk.start) });
                        }}
                      >
                        {hasGaps ? t.fillWeek : t.openWeek}
                      </Button>
                    </div>
                  )}
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
  const allColumns = [
    {
      key: "staff", label: th.colStaff, width: 2, minWidth: 120,
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <Avatar name={row.staffMember.name} size={32} />
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.staffMember.name}</span>
        </div>
      ),
    },
    ...blocks.map((chunk, bi) => ({
      key: `block-${bi}`, label: calPeriodLabel(chunk, lang), width: 1, minWidth: 84,
      render: (row) => {
        const w = row.weeksInfo[bi];
        if (w.locked) return <span style={{ display: "inline-flex", alignItems: "center", color: COLORS.ink3 }}><Lock size={13} /></span>;
        if (w.notStarted) return <span style={{ color: COLORS.ink3 }}>–</span>;
        if (w.gaps > 0) return <Pill variant="missing">{t.cellGaps(w.gaps)}</Pill>;
        return <Pill variant="paid">{t.cellOk}</Pill>;
      },
    })),
    {
      // QA (achado do Iago): mesmo problema já corrigido em
      // ClientesScreen.jsx ("Horas no período") — só `width` relativo, sem
      // `minWidth` próprio, então em janelas mais estreitas a célula
      // encolhia abaixo do que o botão "Ver extrato" precisa e ele saía
      // cortado (sem reticências, porque o `overflow: hidden` de
      // DataTable.jsx não aplica elipse a um filho em flex/bloco como um
      // `<Button>`, só a texto que estoura direto na célula).
      key: "gaps", label: t.colGaps, width: 1.4, minWidth: 290, allowOverflow: true, mobileFull: true,
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(ev) => ev.stopPropagation()}>
          {row.totalGaps > 0 && <span style={{ fontWeight: 700, color: COLORS.alert, fontSize: 13 }}>{row.totalGaps}</span>}
          {row.totalGaps > 0 && setSentItems && (
            <Button variant="secondary" icon={remindedIds.includes(row.staffMember.id) ? undefined : Bell} style={ROW_BTN} disabled={remindedIds.includes(row.staffMember.id)} onClick={() => remindStaff(row.staffMember.id, row.totalGaps)}>
              {remindedIds.includes(row.staffMember.id) ? t.reminded : t.remind}
            </Button>
          )}
          {setHorasData && <Button variant="secondary" style={ROW_BTN} onClick={() => setFill({ staffId: row.staffMember.id, date: null })}>{t.fillHours}</Button>}
          {/* "Ver mês" é secundário: texto, para a linha não ter três botões iguais. */}
          <Button variant="ghost" style={{ ...ROW_BTN, padding: "0 6px" }} onClick={() => setOpenStaffId(row.staffMember.id)}>{t.viewExtract}</Button>
        </div>
      ),
    },
  ];
  // Aba da semana: por defeito a de hoje (ou a última já começada).
  const todayIdx = Math.max(0, blocks.reduce((a, ch, i) => (ch.start <= TODAY ? i : a), 0));
  const wi = weekIdx == null ? todayIdx : Math.min(weekIdx, blocks.length - 1);
  const weekDays = blocks[wi] ? calPeriodDays(blocks[wi]) : [];
  const hoursOn = (sid, iso) => ((horasData[sid] && horasData[sid].entries) || []).filter((e) => !e.voided && e.date === iso).reduce((sum, e) => sum + (e.hours || 0), 0);
  const dayColumns = weekDays.map((d, di) => ({
    key: `day-${di}`, label: `${dayAbbr[d.getDay()]} ${d.getDate()}`, width: 0.8, minWidth: 64,
    render: (row) => {
      const w = row.weeksInfo[wi];
      const st = w ? w.dayStatuses[di] : "no-agenda";
      if (w && w.locked) return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: COLORS.ink3, fontSize: 12.5 }}><Lock size={12} />{st === "filled" ? fmtH(hoursOn(row.staffMember.id, isoDateStr(d))) : ""}</span>;
      if (st === "filled") { const h = hoursOn(row.staffMember.id, isoDateStr(d)); return <span style={{ fontWeight: 700, color: COLORS.ink }}>{h > 0 ? fmtH(h) : "✓"}</span>; }
      if (st === "missed") return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 800, color: "#B8343A", background: "#FCE5E5", borderRadius: 8, padding: "3px 7px", whiteSpace: "nowrap" }}>{t.dayMissingShort}</span>;
      if (st === "today") return <span title={t.dayTodayTitle} style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: COLORS.amberInk, background: COLORS.amberBg, borderRadius: 8, padding: "3px 7px", whiteSpace: "nowrap" }}>{t.dayTodayShort}</span>;
      if (st === "future") return <span style={{ color: "#C3C8C2" }}>·</span>;
      return <span style={{ color: COLORS.ink3 }}>–</span>;
    },
  }));
  const tableColumns = narrow
    ? allColumns.filter((c) => !c.key.startsWith("block-"))
    : [allColumns[0], ...dayColumns, ...allColumns.filter((c) => c.key === "gaps")];

  // ---------------------------------------------------------------------
  // Gerência a preencher as horas de um funcionário: o mesmo ecrã de Horas do funcionário (dias, semanas,
  // mês, reabrir), com tudo o que se grava marcado "pela gerência".
  // ---------------------------------------------------------------------
  const fillStaff = fill ? staff.find((s) => String(s.id) === String(fill.staffId)) : null;
  if (!isSupervisorView && fillStaff && setHorasData) {
    const fh = horasData[fillStaff.id] || {};
    const canReopenMonth = fh.status === "finalizado" && !fh.paid;
    return (
      <div style={styles.content}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <Button variant="secondary" icon={ArrowLeft} onClick={() => setFill(null)}>{t.fillBack}</Button>
          <Avatar name={fillStaff.name} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 20, color: COLORS.ink }}>{fillStaff.name}</div>
            <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{periodLabel}</div>
          </div>
          {canReopenMonth && <Button variant="secondary" onClick={() => setReopenOpen(true)}>{th.reopenForCorrection}</Button>}
        </div>
        <div style={{ background: COLORS.amberBg, color: COLORS.amberInk, borderRadius: RADIUS.control, padding: "10px 14px", fontSize: 13, marginBottom: 6 }}>
          {t.fillBanner(fillStaff.name)}
        </div>
        <EmployeeHorasScreen
          key={`${fillStaff.id}-${fill.date || "now"}`}
          lang={lang} setLang={setLang} onHome={() => setFill(null)} staffId={fillStaff.id} company={company}
          clients={clients} staff={staff} assignments={assignments} horasData={horasData} setHorasData={setHorasData}
          cutoffDay={cutoffDay} closedPeriods={closedPeriods} setMissingItems={setMissingItems || (() => {})}
          absences={absences} covers={covers} asManager startDate={fill.date}
        />
        <ConfirmDialog
          open={reopenOpen} title={th.reopenConfirmTitle} body={th.reopenConfirmBody(fillStaff.name)}
          cancelLabel={c0.cancel} confirmLabel={th.reopenConfirmConfirm}
          onCancel={() => setReopenOpen(false)}
          onConfirm={() => {
            setHorasData((prev) => {
              const h = prev[fillStaff.id] || {};
              const { finalizedBy: _fb, lockedBy: _lb, ...rest } = h;
              return { ...prev, [fillStaff.id]: { ...rest, status: "pendente", lockedWeeks: {}, reopened: true } };
            });
            setReopenOpen(false);
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Ramo gerência (4.5): PageHeader + faixa de 3 números + chips + pesquisa
  // + tabela (uma coluna por bloco) + gaveta de extrato.
  // ---------------------------------------------------------------------
  if (!isSupervisorView) {
    return (
      <div style={styles.content} ref={wrapRef}>
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
          <div className="chip-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
            <FilterChip active={onlyGaps} onClick={() => setOnlyGaps(true)} count={totalWithGaps}>{t.chipOnlyGaps}</FilterChip>
            <FilterChip active={!onlyGaps} onClick={() => setOnlyGaps(false)} count={monitored.length}>{t.chipAllStaff}</FilterChip>
            {/* Lote 4, 4.5 (achado da Marta): a nota sobre inativos/
                replacement vira (i) ao lado do filtro "Todos", em vez de
                ficar sempre visível abaixo da tabela. */}
            <InfoTip text={t.inactiveNote} label={c0.moreInfoLabel} />
          </div>
          <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
        </div>

        {!narrow && (
          <div role="tablist" aria-label={t.weeksAria} className="chip-row" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {blocks.map((ch, i) => {
              const started = ch.start <= TODAY;
              const missing = monitored.reduce((sum, m) => sum + (m.weeksInfo[i] ? m.weeksInfo[i].gaps : 0), 0);
              const on = i === wi;
              return (
                <button key={i} type="button" role="tab" aria-selected={on} onClick={() => setWeekIdx(i)} className="b1-rise"
                  style={{ animationDelay: `${i * 60}ms`, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 120, padding: "10px 14px", borderRadius: 16, border: `1.5px solid ${on ? "var(--p1)" : COLORS.line}`, background: on ? "var(--p1)" : COLORS.card, color: on ? "#fff" : COLORS.ink, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>S{i + 1} · {calPeriodLabel(ch, lang)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, opacity: on ? 0.9 : 1, color: on ? "#fff" : !started ? COLORS.ink3 : missing > 0 ? "#B8343A" : "#167049" }}>
                    {!started ? t.weekNotStarted : missing > 0 ? t.staffDaysMissing(missing) : `✓ ${t.weekUpToDate}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <DataTable
          columns={tableColumns}
          rows={visibleMonitored}
          getRowId={(row) => row.staffMember.id}
          onRowClick={(row) => setOpenStaffId(row.staffMember.id)}
          emptyMessage={t.noResults}
          fit
        />

        {extractDrawer}
        {remindToast}
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
  //
  // QA (achado do Iago, 2ª rodada — "continua sem ser responsivo, em
  // desktop e em tablet"): a 1ª correção só deu sombra/cantos, mas o
  // layout em si continuava igual ao do celular — uma única coluna
  // estreita (720 no máximo) centrada numa tela que pode ter o triplo
  // disso de largura, com cabeçalho `MobileHeader` (de seta "Voltar", que
  // não faz sentido ao lado da barra lateral já visível em tablet/PC).
  // Corrigido pro mesmo padrão que `EmployeeInicioScreen.jsx` já usa:
  // `PageHeader` (sem seta — a barra lateral já é a navegação) a partir do
  // tablet, container bem mais largo, e a lista de funcionários em
  // `flexWrap` (mesma receita de `flex: "1 1 <base>px"` que o resto do
  // app redesenhado usa pra reflow — não é grid CSS à parte) pra ocupar
  // várias colunas em vez de uma única coluna esticada.
  // ---------------------------------------------------------------------
  const isMobileTier = tier === "mobile";
  const containerMaxWidth = tier === "desktop" ? 1100 : tier === "tablet" ? 800 : 460;
  return (
    <div
      style={
        isMobileTier
          ? { padding: "16px 16px 32px", maxWidth: containerMaxWidth, margin: "0 auto" }
          // Tablet/PC: sem padding/margin-auto próprios — a mesma receita
          // de EmployeeInicioScreen.jsx ("Tablet/PC"), que já conta com o
          // wrapper de App.jsx (`padding: "24px 24px 40px"` +
          // `justifyContent: "center"`) pra dar o respiro e centrar.
          : { width: "100%", maxWidth: containerMaxWidth }
      }
    >
      {isMobileTier ? (
        <MobileHeader onBack={onHome} backLabel={t.backLabel} title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
      ) : (
        <PageHeader title={t.title} subtitle={t.subtitlePeriodOnly(periodLabel)} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
      )}

      {isMobileTier && (
        <>
          <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 4 }}>{t.subtitlePeriodOnly(periodLabel)}</div>
          <div style={{ fontSize: 14, color: COLORS.ink2, marginBottom: 16 }}>{t.tapToSeeDetail}</div>
        </>
      )}

      <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} mobile style={{ marginBottom: 14 }} />

      {/* QA (achado do Iago, "parece a tela antiga/não responsiva"): este
          ramo era a única parte do ecrã sem o acabamento do resto do app
          redesenhado — divs soltas sem `boxShadow` nem borda (o ramo de
          gerência, acima, já embrulha os números equivalentes num `Card`),
          e a faixa de resumo sem `flexWrap`, então num telemóvel estreito
          os dois blocos + o (i) podiam espremer/estourar em vez de quebrar
          linha. Mantido o mesmo esquema de cor (verde/alerta conforme
          `totalWithGaps`), só com `RADIUS.card` + `SHADOW.sh1` (os mesmos
          tokens que todo cartão do app usa) e `flexWrap: "wrap"`. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: RADIUS.card, boxShadow: SHADOW.sh1, background: totalWithGaps > 0 ? COLORS.alertTint : COLORS.okTint, color: totalWithGaps > 0 ? COLORS.alert : COLORS.okInk, fontSize: 13, fontWeight: 700 }}>
          {totalWithGaps > 0 ? <AlertTriangle size={15} /> : <Check size={15} />}
          {t.summaryWithGapsCount(totalWithGaps)}
        </div>
        <div style={{ flex: "1 1 180px", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: RADIUS.card, boxShadow: SHADOW.sh1, background: COLORS.okTint, color: COLORS.okInk, fontSize: 13, fontWeight: 700 }}>
          <Check size={15} />
          {t.summaryOkCount(totalOk)}
        </div>
        {/* Lote 4, 4.5: mesma nota de 4.4 (ramo gerência), sem filtro
            "Todos" aqui pra ancorar — fica junto do resumo. */}
        <InfoTip text={t.inactiveNote} label={c0.moreInfoLabel} />
      </div>

      {monitored.length === 0 ? (
        <div style={styles.noResults}>{t.noResults}</div>
      ) : (
        // QA (2ª rodada): era `flexDirection: "column"` sempre — uma
        // coluna só de botões de 64px esticados, por mais larga que a
        // tela fosse (o oposto de "responsivo"). Em `flexWrap` com
        // `flex: "1 1 300px"` cada cartão fica com no mínimo 300px e
        // reflui pra 2-3 colunas sozinho conforme o espaço disponível,
        // igual à receita já usada em EmployeeInicioScreen.jsx — no
        // celular (containerMaxWidth 460) só cabe 1 por linha mesmo, então
        // o visual aí não muda.
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {monitored.map(({ staffMember: s, totalGaps }) => (
            <button
              key={s.id}
              onClick={() => setOpenStaffId(s.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, height: 64, padding: "0 16px",
                borderRadius: RADIUS.card, border: `1px solid ${COLORS.line}`, background: COLORS.card, boxShadow: SHADOW.sh1, cursor: "pointer", textAlign: "left",
                flex: isMobileTier ? "1 1 100%" : "1 1 300px", minWidth: 0, boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={s.name} size={36} />
                <span style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {totalGaps > 0 ? (
                  <Pill variant="missing">{t.staffDaysMissing(totalGaps)}</Pill>
                ) : (
                  <Pill variant="paid"><Check size={11} /> {t.summaryOk}</Pill>
                )}
                <ChevronCircle />
              </span>
            </button>
          ))}
        </div>
      )}

      {extractDrawer}
      {remindToast}
    </div>
  );
}

export default MonitoramentoScreen;
