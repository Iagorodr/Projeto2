import { useState, useEffect, useId } from "react";
import { Plus, X, UsersRound, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { useControlSize } from "../../hooks/useBreakpoint.js";
import { AGENDA_DAYS, TODAY, LANG_NAMES } from "../../models/data.js";
import {
  clientById, staffById, startOfISOWeek, addDays, isoDateStr, pad2, fmtMinutes, fmtHoursScreen,
  isStaffActive, formatPeriodLabel, partnerOf, clientAppliesThisWeek, absenceOn,
} from "../../models/utils.js";
import { T, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import {
  PageHeader, SegmentedControl, SearchField, FilterChip, Avatar, Pill, SupervisorTag, DataTable, Toast, InfoTip,
} from "../shared/ui/index.js";

// Coluna de "hoje" (documento, 4.3): fundo #F5FAF7 — valor literal do
// documento, não um token em colors.js (é específico desta grelha,
// mesmo padrão já usado noutros sítios para cores pontuais, ex.:
// `ruleBg` em ReclamacoesCard.jsx). Estendido também ao corpo das
// células da coluna (o documento só descreve o cabeçalho; manter a
// mesma cor a descer pela coluna inteira dá mais coerência visual, sem
// mudar o que o cabeçalho já faz).
const TODAY_COLUMN_BG = "#F5FAF7";

// QA (achado do Iago — "Agendas"): a grade "Por funcionário" tinha
// colunas de dia com largura fixa (170px); com 7 dias + a coluna de
// funcionário (230px) isso passava de 1400px, muito mais do que a área
// de conteúdo tinha disponível — sobrava uma faixa enorme de fundo vazio
// à direita do cartão (nem usava a largura que o `shell` mais largo desta
// tela já dá, ver App.jsx) e ainda obrigava a rolar pro lado pra ver
// qui/sex/sáb/dom, escondendo "hoje" quando calha de ser um desses dias.
// Grid com colunas elásticas (`minmax`) estica os 7 dias pra preencher o
// espaço disponível, cabendo sem rolar na maioria dos PCs (o `shell` mais
// largo desta tela, em App.jsx, ajuda bastante aqui).
//
// QA (achado do Iago, 2ª volta): mesmo com `minmax`, a largura MÍNIMA
// somada (coluna de funcionário + 7×110px) ainda passava da área de
// conteúdo disponível em portáteis comuns (1280-1366px), sobrando a
// barra de scroll horizontal que se queria evitar. A coluna de
// funcionário (230px) é onde dava pra cortar mais sem perder nada: o
// layout horizontal (avatar + nome + etiquetas todos numa linha, que
// quebrava em várias) só existia por causa da largura generosa; empilhar
// avatar/nome/etiquetas/horas verticalmente (ver `renderStaffRow` mais
// abaixo) lê tão bem numa coluna estreita quanto na larga, e os 90px
// que isso liberta (230 -> 140) vão inteiros pros 7 dias, que é a parte
// que a gerência realmente quer ver sem rolar.
const AGENDA_GRID_COLS = "140px repeat(7, minmax(110px, 1fr))";

// QA (achado do Iago — "Agendas"): os dois popovers desta tela ("quem
// está no cliente" e "adicionar cliente", ambos abaixo) eram pedaços de
// UI `position: absolute` ancorados à célula clicada — dentro de uma
// grade com `overflowX: auto` (ver `AGENDA_GRID_COLS` mais abaixo) isso
// cortava o popover sempre que a célula estava perto da borda ou numa
// linha perto do fim, daí toda a lógica de `popoverDir`/`dir` só pra
// decidir se abria pra cima ou pra baixo — e mesmo assim nem sempre
// cabia. Virar diálogo modal centrado (mesmo padrão do `ConfirmDialog`:
// fundo `rgba(15,49,41,.45)`, cartão branco com `RADIUS.card`/
// `SHADOW.sh2`, Esc e clique fora fecham) resolve de raiz — um modal
// `position: fixed` nunca é cortado pelo scroll da grade, e sobra o
// mesmo componente pros dois popovers (`AgendaModal`, com cabeçalho +
// botão fechar padronizados), em vez de reimplementar o fecho por
// Esc/clique-fora em cada um.
function AgendaModal({ title, titleId, onClose, closeLabel, width = 340, children }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog" aria-labelledby={titleId}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, width, maxWidth: "100%", maxHeight: "min(80vh, 480px)",
          display: "flex", flexDirection: "column", borderRadius: RADIUS.card, boxShadow: SHADOW.sh2,
          padding: 18, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div id={titleId} style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{title}</div>
          <button
            type="button" onClick={onClose} aria-label={closeLabel}
            style={{
              width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              color: COLORS.ink3, flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: "auto", minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// QA (achado do Iago — "Agendas"): a grade "Por funcionário" só mostrava
// a semana corrente (`startOfISOWeek(TODAY)`, fixo) — sem jeito de ver
// outra semana, mesmo sendo a MESMA semana-tipo em todas elas (ver
// `subtitle` do ecrã: "repete-se todas as semanas"). Isto não muda os
// clientes mostrados (continuam vindo de `assignments`, que não varia
// por semana) — só QUAL semana (datas, "hoje") está em exibição; serve
// pra planear à frente (ex.: em que dia cai cada cliente daqui a 2
// meses). `WeekPickerCalendar` é a grelha de mês pra saltar direto a
// qualquer semana, em vez de clicar "seguinte" dezenas de vezes.
function WeekPickerCalendar({ weekStart, lang, t, c0, onSelectWeek, onClose }) {
  const [viewMonth, setViewMonth] = useState(() => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  const titleId = useId();
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const todayIso = isoDateStr(TODAY);
  const weekEndIso = isoDateStr(addDays(weekStart, 6));
  const weekStartIso = isoDateStr(weekStart);

  // Grelha de 6 semanas (42 dias) a partir da segunda-feira da semana que
  // contém o dia 1 do mês em exibição — cobre o mês inteiro mesmo quando
  // ele começa perto do fim de uma semana (ex.: mês a começar num
  // domingo), com dias de meses vizinhos esmaecidos mas clicáveis (saltar
  // pra "semana de 30 set" a partir da grelha de outubro, por exemplo).
  const gridStart = startOfISOWeek(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(AGENDA_DAYS.map((_, d) => addDays(gridStart, w * 7 + d)));
  }

  const monthLabel = `${T[lang].months[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  return (
    <AgendaModal
      titleId={titleId} title={t.pickWeek} closeLabel={c0.close}
      onClose={onClose} width={320}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button
          type="button" onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label={t.previousWeek}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink, textTransform: "capitalize" }}>{monthLabel}</span>
        <button
          type="button" onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label={t.nextWeek}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {AGENDA_DAYS.map((day) => (
          <div key={day} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: COLORS.ink3, letterSpacing: "0.03em" }}>
            {dayLabels[day][0]}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {weeks.map((week, wi) => {
          const inSelectedWeek = isoDateStr(week[0]) === weekStartIso;
          return (
            <div
              key={wi}
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, borderRadius: RADIUS.chip, background: inSelectedWeek ? COLORS.clayTint : "transparent" }}
            >
              {week.map((day) => {
                const iso = isoDateStr(day);
                const outsideMonth = day.getMonth() !== viewMonth.getMonth();
                const isToday = iso === todayIso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelectWeek(day)}
                    style={{
                      height: 32, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
                      borderRadius: RADIUS.chip, fontSize: 12.5, fontWeight: isToday ? 800 : 500,
                      color: outsideMonth ? COLORS.ink3 : inSelectedWeek ? COLORS.clayInk : COLORS.ink,
                      opacity: outsideMonth ? 0.45 : 1, position: "relative",
                    }}
                  >
                    {day.getDate()}
                    {isToday && (
                      <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: COLORS.clay }} />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {!(weekStartIso <= todayIso && todayIso <= weekEndIso) && (
        <button
          type="button" onClick={() => onSelectWeek(TODAY)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 10,
            border: `1.5px dashed ${COLORS.lineInput}`, background: "transparent", color: COLORS.forest700,
            cursor: "pointer", borderRadius: RADIUS.chip, padding: "8px 0", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          <CalendarDays size={13} /> {t.backToToday}
        </button>
      )}
    </AgendaModal>
  );
}

// Lote 4, 4.6 (achado da Marta): "quem está no cliente" — o bloco
// compartilhado (chip na vista "Por funcionário", avatares na coluna
// "Quem" da vista "Por dia") vira um botão focável; isto é o modal que
// abre, com nomes+mini-avatares+duração de cada um, "Remover" sempre
// visível (sem precisar de hover) e "Adicionar" pra juntar outro
// funcionário a este cliente neste dia.
function ClientTeamPopover({ client, team, perPerson, t, c0, staff, onRemove, onAdd, onClose }) {
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const titleId = useId();

  const availableStaff = staff
    .filter((s) => !team.some((m) => m.id === s.id))
    .filter((s) => s.name.toLowerCase().includes(addSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AgendaModal titleId={titleId} title={`${client.name} · ${t.peopleLabel(team.length)}`} onClose={onClose} closeLabel={c0.close}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {team.map((member) => (
          <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar name={member.name} size={22} />
            <span style={{ flex: 1, fontSize: 12.5, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {member.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: COLORS.ink2 }}>
              {fmtMinutes(perPerson)}
            </span>
            <button
              type="button" onClick={() => onRemove(member.id)} aria-label={t.remove}
              style={{ flexShrink: 0, border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, padding: 2, display: "flex" }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <SearchField value={addSearch} onChange={setAddSearch} placeholder={t.addStaffPlaceholder} style={{ flex: 1 }} />
            <button
              type="button" onClick={() => { setAdding(false); setAddSearch(""); }} aria-label={c0.cancel}
              style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, flexShrink: 0, display: "flex" }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {availableStaff.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.ink2, padding: "6px 4px" }}>{t.noStaffAvailable}</div>
            ) : availableStaff.map((s) => (
              <button
                key={s.id} type="button" onClick={() => { onAdd(s.id); setAdding(false); setAddSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, textAlign: "left", border: "none", background: "transparent",
                  cursor: "pointer", padding: "6px 4px", borderRadius: RADIUS.chip, fontSize: 12.5, fontFamily: "inherit", color: COLORS.ink,
                }}
              >
                <Avatar name={s.name} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button" onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%", border: `1.5px dashed ${COLORS.lineInput}`,
            background: "transparent", color: COLORS.ink3, cursor: "pointer", borderRadius: RADIUS.chip, padding: "6px 8px",
            fontSize: 12.5, fontFamily: "inherit", marginTop: 8,
          }}
        >
          <Plus size={13} /> {t.addPerson}
        </button>
      )}
    </AgendaModal>
  );
}

// Agendas (documento de design, secção 4.3) — "ver e mudar quem faz que
// cliente em cada dia da semana". `assignments` é uma semana-tipo (repete
// todas as semanas), independente de `client.days`/`frequency` — isso já
// era assim no ecrã antigo e não muda aqui; só a apresentação muda.
function AgendasScreen({ lang, setLang, absences, setAbsences, clients, setClients, staff, assignments, setAssignments }) {
  const t = T[lang].agendas;
  const c0 = T[lang].common;
  const tc = T[lang].clientes;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const [search, setSearch] = useState("");
  const [view, setView] = useState("staff"); // "staff" | "day"
  // Lote 4, 4.6 (achado do Iago — "a busca de cliente aparece muito em
  // baixo"): o popover de adicionar cliente/ver equipa já abriu PARA
  // BAIXO (`top: 100%`) ancorado à célula — numa linha perto do fim da
  // tabela ele nascia fora da vista, obrigando a rolar a página só pra
  // achar o campo de busca que tinha acabado de abrir. Virou modal
  // centrado (ver `AgendaModal`, mais acima) nesta volta de QA, o que já
  // resolve isto por conta própria — sem precisar mais de saber a direção
  // de abertura.
  const [openCell, setOpenCell] = useState(null);
  const [cellSearch, setCellSearch] = useState("");
  const [hoverCell, setHoverCell] = useState(null);
  const [toast, setToast] = useState(null);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  // Lote 4, 4.6: chave do popover "quem está no cliente" aberto (vista
  // "Por funcionário": `${staffId}-${day}-${clientId}`; vista "Por dia":
  // `day-${day}-${clientId}`, sem staffId porque ali o botão não pertence
  // a uma linha de funcionário) — null quando nenhum está aberto.
  const [openTeam, setOpenTeam] = useState(null);
  const [weekendOpen, setWeekendOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState(null); // funcionário de origem do "Copiar agenda"
  const [copyTarget, setCopyTarget] = useState("");
  const tAbs = T[lang].absences;
  const { height: ctrlHeight, radius: ctrlRadius } = useControlSize();
  // QA (achado do Iago — "Agendas"): antes era `const weekStart =
  // startOfISOWeek(TODAY)`, fixo — só dava pra ver a semana corrente.
  // Vira estado pra poder navegar; os CLIENTES mostrados não mudam (é a
  // mesma semana-tipo sempre, ver `t.subtitle`), só as datas/"hoje" em
  // exibição — ver `WeekPickerCalendar` mais acima.
  const [weekStart, setWeekStart] = useState(() => startOfISOWeek(TODAY));
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const weekDates = AGENDA_DAYS.map((_, i) => addDays(weekStart, i));
  const todayIso = isoDateStr(TODAY);
  // Token 1 (segunda) a 7 (domingo) do dia de hoje de verdade — não depende
  // de `weekDates`/`weekStart` (que agora navegam) porque a vista "Por
  // dia" seleciona por DIA DA SEMANA (mesma semana-tipo em qualquer
  // semana em exibição, ver comentário acima de `weekStart`), não por
  // data; `getDay()` do JS devolve 0 (domingo) a 6 (sábado), daí o ajuste.
  const todayDow = TODAY.getDay();
  const todayAgendaDay = todayDow === 0 ? 7 : todayDow;
  const [selectedDay, setSelectedDay] = useState(todayAgendaDay);

  function goToWeek(anyDateInWeek) {
    setWeekStart(startOfISOWeek(anyDateInWeek));
    setWeekPickerOpen(false);
  }

  function showToast(message, opts) {
    setToast({ message, ...opts });
    setTimeout(() => setToast((cur) => (cur && cur.message === message ? null : cur)), 5000);
  }

  function cellKey(staffId, day) { return `${staffId}-${day}`; }
  // Só os clientes que realmente têm visita na SEMANA EM EXIBIÇÃO: quinzenal
  // aparece de 15 em 15 dias, mensal a cada 4 semanas (ver
  // `clientAppliesThisWeek`). O molde semanal em `assignments` não muda.
  function getCellClientIds(staffId, day) {
    return (assignments[cellKey(staffId, day)] || []).filter((cid) => {
      const c = clientById(clients, cid);
      return !c || clientAppliesThisWeek(c, weekStart);
    });
  }
  function teamSizeFor(day, clientId) { return staff.filter((s) => getCellClientIds(s.id, day).includes(clientId)).length; }
  // Lote 4, 4.6: mesma lista que `teamSizeFor` conta, mas devolvendo quem
  // são (não só quantos) — pro popover "quem está no cliente".
  function staffOnClient(day, clientId) { return staff.filter((s) => getCellClientIds(s.id, day).includes(clientId)); }
  // Ausências desta semana (avisos de falta), por funcionário e dia.
  function absenceFor(staffId, day) { return absenceOn(absences, staffId, isoDateStr(weekDates[day - 1])); }
  // Cliente de quem falta sem nenhum colega presente nesse dia: "sem cobertura".
  function isUncovered(staffId, day, clientId) {
    if (!absenceFor(staffId, day)) return false;
    return !staff.some((o) => o.id !== staffId && !absenceFor(o.id, day) && getCellClientIds(o.id, day).includes(clientId));
  }
  function teamKey(staffId, day, clientId) { return `${staffId}-${day}-${clientId}`; }
  function dayTeamKey(day, clientId) { return `day-${day}-${clientId}`; }

  function mergeAdd(key, clientId) {
    setAssignments((prev) => {
      const current = prev[key] || [];
      if (current.includes(clientId)) return prev;
      const next = [...current, clientId].sort((a, b) => (clientById(clients, a)?.name || "").localeCompare(clientById(clients, b)?.name || ""));
      return { ...prev, [key]: next };
    });
  }
  // Dupla: marcas "automático" guardadas junto das atribuições, em chaves
  // `auto:<staffId>-<dia>` (lista de clientes que vieram do parceiro, não de
  // uma escolha manual naquela célula).
  function autoKey(staffId, day) { return `auto:${cellKey(staffId, day)}`; }
  function getAutoIds(staffId, day) { return assignments[autoKey(staffId, day)] || []; }
  function setAuto(staffId, day, clientId, on) {
    setAssignments((prev) => {
      const k = autoKey(staffId, day);
      const cur = prev[k] || [];
      const has = cur.includes(clientId);
      if (on === has) return prev;
      const next = on ? [...cur, clientId] : cur.filter((id) => id !== clientId);
      return { ...prev, [k]: next };
    });
  }
  function addClient(staffId, day, clientId) {
    // Cliente quinzenal/mensal colocado numa semana em que não teria visita:
    // a semana mostrada passa a ser a "semana de referência" dele, e a
    // próxima aparição conta a partir daqui.
    const picked = clientById(clients, clientId);
    if (picked && !clientAppliesThisWeek(picked, weekStart) && setClients) {
      const anchor = isoDateStr(weekStart);
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, frequencyAnchor: anchor } : c)));
      showToast(t.anchoredToast(picked.name));
    }
    mergeAdd(cellKey(staffId, day), clientId);
    setAuto(staffId, day, clientId, false); // escolha manual nesta célula
    const p = partnerOf(staff, staffId, TODAY);
    if (p && !getCellClientIds(p.id, day).includes(clientId)) {
      mergeAdd(cellKey(p.id, day), clientId);
      setAuto(p.id, day, clientId, true);
      const client = clientById(clients, clientId);
      showToast(t.autoAddedToast(client?.name || "", p.name.split(" ")[0]));
    }
    setCellSearch(""); setOpenCell(null);
  }
  function removeClient(staffId, day, clientId) {
    const key = cellKey(staffId, day);
    const client = clientById(clients, clientId);
    const member = staffById(staff, staffId);
    setAssignments((prev) => ({ ...prev, [key]: (prev[key] || []).filter((id) => id !== clientId) }));
    setAuto(staffId, day, clientId, false); // remover só desta pessoa; o parceiro fica como está
    const dayAbbr = dayLabels[day].toLowerCase();
    showToast(t.removedToast(client?.name || "", (member?.name || "").split(" ")[0], dayAbbr), {
      actionLabel: t.undo,
      onAction: () => mergeAdd(key, clientId),
    });
  }

  // "10h30 na semana" (documento, 4.3): soma, em cada dia, da PARTE do
  // funcionário em cada cliente (duração ÷ nº de pessoas nesse cliente
  // nesse dia) — não a duração bruta, senão um cliente partilhado conta
  // em dobro no total da semana de cada pessoa.
  function staffWeekMinutes(staffId) {
    return AGENDA_DAYS.reduce((sum, day) => {
      const ids = getCellClientIds(staffId, day);
      return sum + ids.reduce((s, cid) => {
        const client = clientById(clients, cid);
        if (!client) return s;
        const teamSize = teamSizeFor(day, cid) || 1;
        return s + Math.round(client.duration / teamSize);
      }, 0);
    }, 0);
  }

  // Rodapé "Clientes · horas" por dia: nº de clientes DISTINTOS (em
  // qualquer funcionário) + soma das durações BRUTAS desses clientes —
  // que bate com a soma das partes de todos os funcionários, já que
  // duração ÷ pessoas × pessoas = duração.
  function dayFooter(day) {
    const ids = new Set();
    staff.forEach((s) => getCellClientIds(s.id, day).forEach((cid) => ids.add(cid)));
    const totalMin = [...ids].reduce((s, cid) => s + (clientById(clients, cid)?.duration || 0), 0);
    return { count: ids.size, totalMin };
  }

  function staffMatchesSearch(s) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (s.name.toLowerCase().includes(q)) return true;
    return AGENDA_DAYS.some((day) => getCellClientIds(s.id, day).some((cid) => (clientById(clients, cid)?.name || "").toLowerCase().includes(q)));
  }
  // "YYYY-MM-DD" -> "23/09", pro aviso "Expirou a 23/09" (documento, 4.9).
  function dmFromIso(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  // Etapa 4j (4.9): uma conta inativa — incluindo Replacement já fora da
  // validade, via isStaffActive — sai das linhas do quadro principal e
  // passa para o grupo recolhido "Inativos" no fim, fechado por defeito.
  // As atribuições em si não se tocam (`assignments` continua intacto),
  // só a apresentação muda, para a prolongação da validade continuar a
  // trazer a pessoa de volta às linhas normais sem perder nada.
  const weekendHasData = [6, 7].some((day) => staff.some((s) => getCellClientIds(s.id, day).length > 0 || absenceFor(s.id, day)));
  const showWeekend = weekendOpen || weekendHasData;
  const shownDays = showWeekend ? AGENDA_DAYS : AGENDA_DAYS.filter((d) => d <= 5);
  const gridCols = `140px repeat(${shownDays.length}, minmax(${showWeekend ? 135 : 150}px, 1fr))`;
  const weekAbsenceRows = [];
  staff.forEach((s) => {
    AGENDA_DAYS.forEach((day) => {
      const a = absenceFor(s.id, day);
      if (!a) return;
      const uncovered = getCellClientIds(s.id, day).filter((cid) => isUncovered(s.id, day, cid)).map((cid) => clientById(clients, cid)?.name).filter(Boolean);
      weekAbsenceRows.push({ a, staffMember: s, day, uncovered });
    });
  });
  function toggleHandled(id) { setAbsences((prev) => (prev || []).map((a) => (a.id === id ? { ...a, handled: !a.handled } : a))); }

  // Copiar a agenda fixa semanal de um funcionário para outro (junta, sem apagar nada do destino).
  function doCopyAgenda() {
    if (!copyFrom || !copyTarget) return;
    const targetId = copyTarget;
    let added = 0;
    setAssignments((prev) => {
      const next = { ...prev };
      AGENDA_DAYS.forEach((day) => {
        const src = prev[cellKey(copyFrom.id, day)] || [];
        const dst = prev[cellKey(targetId, day)] || [];
        const merged = [...dst, ...src.filter((id) => !dst.includes(id))];
        if (merged.length !== dst.length) {
          added += merged.length - dst.length;
          next[cellKey(targetId, day)] = merged.sort((a, b) => (clientById(clients, a)?.name || "").localeCompare(clientById(clients, b)?.name || ""));
        }
      });
      return next;
    });
    const targetName = (staffById(staff, targetId)?.name || "").split(" ")[0];
    const fromName = copyFrom.name.split(" ")[0];
    setCopyFrom(null);
    showToast(tAbs.copyDone(fromName, targetName));
  }
  const matchingStaff = staff.filter(staffMatchesSearch);
  const visibleStaff = matchingStaff.filter((s) => isStaffActive(s, TODAY));
  const inactiveStaff = matchingStaff.filter((s) => !isStaffActive(s, TODAY));

  // Extraído do corpo do quadro "Por funcionário" para poder ser reusado
  // tanto nas linhas normais como dentro do grupo recolhido "Inativos"
  // (Etapa 4j, 4.9) — exatamente a mesma linha, só muda de onde é chamada.
  function renderStaffRow(s) {
    const inactive = !isStaffActive(s, TODAY);
    return (
      <div key={s.id} style={{ display: "grid", gridTemplateColumns: gridCols, borderBottom: `1px solid ${COLORS.lineSoft}`, opacity: inactive ? 0.6 : 1 }}>
        {/* QA (achado do Iago, 2ª volta — "Agendas"): era uma linha
            horizontal (avatar + nome + etiquetas lado a lado, quebrando
            quando não cabia) dentro de uma coluna de 230px; estreitada
            pra 140px (`AGENDA_GRID_COLS`, pra libertar espaço pros 7
            dias e matar a barra de scroll horizontal), essa disposição
            ficaria espremida. Empilhada (avatar no topo, nome/etiquetas/
            horas centrados abaixo) lê bem numa coluna estreita sem
            encolher o avatar nem cortar nomes longos. */}
        <div
          style={{
            position: "sticky", left: 0, zIndex: 1, background: COLORS.card,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", gap: 4, padding: "10px 8px",
            borderRight: `1px solid ${COLORS.line}`,
          }}
        >
          <Avatar name={s.name} size={32} />
          <span style={{ fontWeight: 600, fontSize: 12.5, color: COLORS.ink, lineHeight: 1.25, wordBreak: "break-word" }}>{s.name}</span>
          {/* Bug pré-existente (Etapa 4e) encontrado de passagem ao mexer
              nesta linha agora: `funcionarios.roleSupervisor` nunca
              existiu no i18n (só `acessos.roleSupervisor`) — a etiqueta
              renderizava a palavra "undefined" pra qualquer supervisor
              nesta grelha. Corrigido aqui (ver LEIA-ME). */}
          {(s.role === "supervisor" || inactive) && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4 }}>
              {s.role === "supervisor" && <SupervisorTag kind="role">{T[lang].acessos.roleSupervisor}</SupervisorTag>}
              {inactive && <Pill variant="missing">{T[lang].common.inactive}</Pill>}
            </div>
          )}
          {!inactive && (
            <button type="button" onClick={() => { setCopyFrom(s); setCopyTarget(""); }}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: COLORS.forest600, textDecoration: "underline", padding: 0 }}>
              {tAbs.copyBtn}
            </button>
          )}
          <div style={{ fontSize: 11, color: COLORS.ink2 }}>
            {inactive && s.accountType === "replacement" && s.validUntil
              ? t.inactiveExpiredOn(dmFromIso(s.validUntil))
              : `${fmtHoursScreen(staffWeekMinutes(s.id) / 60)} ${t.weekTotalSuffix}`}
          </div>
        </div>
        {shownDays.map((day) => {
          const i = day - 1;
          const date = weekDates[i];
          const isToday = isoDateStr(date) === todayIso;
          const clientIds = getCellClientIds(s.id, day);
          const absence = absenceFor(s.id, day);
          const key = cellKey(s.id, day);
          const isOpenPopover = openCell === key;
          const isHovered = hoverCell === key;
          const availableClients = clients
            .filter((c) => c.name.toLowerCase().includes(cellSearch.toLowerCase()) && !clientIds.includes(c.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <div
              key={day}
              onMouseEnter={() => setHoverCell(key)}
              onMouseLeave={() => setHoverCell((h) => (h === key ? null : h))}
              style={{
                position: "relative", padding: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
                minHeight: 56, background: absence ? "repeating-linear-gradient(135deg, #FBEFEA, #FBEFEA 8px, #FFF7F3 8px, #FFF7F3 16px)" : isToday ? TODAY_COLUMN_BG : "transparent", borderRight: `1px solid ${COLORS.line}`,
              }}
            >
              {absence && (
                <span title={absence.note ? `${tAbs.absentTitle(s.name.split(" ")[0])}: ${absence.note}` : tAbs.absentTitle(s.name.split(" ")[0])}
                  style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", background: COLORS.alert, color: "#fff" }}>
                  {tAbs.absentTag}{absence.handled ? " ✓" : ""}
                </span>
              )}
              {clientIds.map((cid) => {
                const client = clientById(clients, cid);
                if (!client) return null;
                const team = staffOnClient(day, cid);
                const teamSize = team.length;
                const shared = teamSize > 1;
                const perPerson = Math.round(client.duration / teamSize);
                const recurring = client.frequency === "biweekly" || client.frequency === "monthly";
                const freqLabel = client.frequency === "biweekly" ? tc.freqBiweekly : tc.freqMonthly;
                const tooltip = `${client.name} · ${fmtMinutes(client.duration)}`
                  + (recurring ? ` · ${freqLabel}` : "")
                  + (shared ? ` · ${t.peopleLabel(teamSize)}, ${fmtMinutes(perPerson)} ${t.each}` : "");

                // Lote 4, 4.6 (achado da Marta): o bloco partilhado vira um
                // botão focável que abre o popover "quem está no cliente"
                // (nomes+mini-avatares+duração, "Remover"/"Adicionar"
                // sempre visíveis ali dentro); o `title` fica só como
                // reforço, já não é a única forma de ver quem são (não
                // funcionava ao toque). O chip sem partilha não muda —
                // continua `div` simples, remover só ao `isHovered`.
                if (shared) {
                  const thisTeamKey = teamKey(s.id, day, cid);
                  const isTeamOpen = openTeam === thisTeamKey;
                  return (
                    <div key={cid} style={{ position: "relative" }}>
                      <button
                        type="button" title={tooltip}
                        aria-haspopup="dialog" aria-expanded={isTeamOpen}
                        onClick={() => setOpenTeam((k) => (k === thisTeamKey ? null : thisTeamKey))}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, minHeight: 30, width: "100%", borderRadius: RADIUS.chip,
                          padding: "4px 8px", background: COLORS.clayTint, fontSize: 12.5, border: "none", cursor: "pointer",
                          fontFamily: "inherit", textAlign: "left",
                          outline: isUncovered(s.id, day, cid) ? `1.5px dashed ${COLORS.alert}` : "none",
                        }}
                      >
                        <UsersRound size={12} style={{ flexShrink: 0, color: COLORS.clayInk }} />
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.2, fontWeight: 500, color: COLORS.clayInk }}>
                          {client.name}
                        </span>
                        {getAutoIds(s.id, day).includes(cid) && (
                          <span title={t.autoChipTitle} style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: "#2F5FB3" }} />
                        )}
                        <span style={{ flexShrink: 0, fontWeight: 600, color: COLORS.clayInk }}>
                          {fmtMinutes(perPerson)}
                        </span>
                        {recurring && <RefreshCw size={11} style={{ flexShrink: 0, color: COLORS.clayInk }} />}
                      </button>
                      {isTeamOpen && (
                        <ClientTeamPopover
                          client={client} team={team} perPerson={perPerson} t={t} c0={c0} staff={staff}
                          onRemove={(staffId) => removeClient(staffId, day, cid)}
                          onAdd={(staffId) => mergeAdd(cellKey(staffId, day), cid)}
                          onClose={() => setOpenTeam(null)}
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={cid} title={tooltip}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, minHeight: 30, borderRadius: RADIUS.chip, padding: "4px 8px",
                      background: COLORS.lineSoft, fontSize: 12.5, outline: isUncovered(s.id, day, cid) ? `1.5px dashed ${COLORS.alert}` : "none",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.2, fontWeight: 500, color: COLORS.ink }}>
                      {client.name}
                    </span>
                    {getAutoIds(s.id, day).includes(cid) && (
                          <span title={t.autoChipTitle} style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: "#2F5FB3" }} />
                        )}
                        <span style={{ flexShrink: 0, fontWeight: 600, color: COLORS.ink2 }}>
                      {fmtMinutes(perPerson)}
                    </span>
                    {recurring && <RefreshCw size={11} style={{ flexShrink: 0, color: COLORS.ink3 }} />}
                    {isHovered && (
                      <button
                        type="button" onClick={() => removeClient(s.id, day, cid)} aria-label={t.remove}
                        style={{ flexShrink: 0, border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, padding: 0, display: "flex" }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              {isOpenPopover && (
                <AgendaModal
                  titleId={`cell-add-${key}`} title={t.addClientPlaceholder} closeLabel={c0.cancel}
                  onClose={() => { setOpenCell(null); setCellSearch(""); }}
                >
                  <SearchField value={cellSearch} onChange={setCellSearch} placeholder={t.addClientPlaceholder} style={{ marginBottom: 10, width: "100%" }} />
                  <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                    {availableClients.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: COLORS.ink2, padding: "8px 6px" }}>{t.noClientsAvailable}</div>
                    ) : availableClients.map((c) => {
                      const existingTeamSize = teamSizeFor(day, c.id);
                      return (
                        <button
                          key={c.id} type="button" onClick={() => addClient(s.id, day, c.id)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, textAlign: "left",
                            border: "none", background: "transparent", cursor: "pointer", padding: "8px 6px", borderRadius: RADIUS.chip,
                            fontSize: 13, fontFamily: "inherit", color: COLORS.ink,
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ flexShrink: 0, fontSize: 11.5, color: COLORS.ink3 }}>
                            {fmtMinutes(c.duration)}{existingTeamSize > 0 ? ` · ${t.alreadyWith(existingTeamSize)}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </AgendaModal>
              )}
              {!isOpenPopover && isHovered && (
                <button
                  type="button"
                  onClick={() => setOpenCell(key)}
                  aria-label={t.addClientPlaceholder}
                  style={{
                    height: 28, borderRadius: RADIUS.chip, border: `1.5px dashed ${COLORS.lineInput}`, background: "transparent",
                    color: COLORS.ink3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // "Por dia" (documento, 4.3): "serve para ver clientes sem ninguém e
  // conflitos" — só é possível ver um cliente "sem ninguém" juntando o
  // que `assignments` já tem com os dias esperados do próprio cliente
  // (`client.days`, nunca usado pela grelha "Por funcionário", que é
  // livre); um cliente com `days` incluindo este dia MAS sem ninguém em
  // `assignments` aparece aqui com 0 pessoas.
  function dayRows(day) {
    const byClient = new Map();
    clients.forEach((c) => {
      if ((c.days || []).includes(day) && clientAppliesThisWeek(c, weekStart)) byClient.set(c.id, { client: c, staffIds: new Set() });
    });
    staff.forEach((s) => {
      getCellClientIds(s.id, day).forEach((cid) => {
        const client = clientById(clients, cid);
        if (!client) return;
        if (!byClient.has(cid)) byClient.set(cid, { client, staffIds: new Set() });
        byClient.get(cid).staffIds.add(s.id);
      });
    });
    return [...byClient.values()]
      .map(({ client, staffIds }) => ({ client, staffList: staff.filter((s) => staffIds.has(s.id)), peopleCount: staffIds.size }))
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }
  const visibleDayRows = dayRows(selectedDay).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (r.client.name.toLowerCase().includes(q)) return true;
    return r.staffList.some((s) => s.name.toLowerCase().includes(q));
  });

  const dayColumns = [
    { key: "client", label: t.colClient, width: 2, render: (r) => r.client.name },
    {
      key: "duration", label: t.colDuration, width: 1.3,
      render: (r) => {
        if (r.peopleCount < 2) return fmtMinutes(r.client.duration);
        const per = Math.round(r.client.duration / r.peopleCount);
        return `${fmtMinutes(r.client.duration)} · ${fmtMinutes(per)} ${t.each}`;
      },
    },
    {
      // Lote 4, 4.6 (achado da Marta): `allowOverflow` deixa o popover
      // "quem está no cliente" sair da célula sem ser cortado pelo
      // `overflow:hidden` padrão da DataTable (ver DataTable.jsx).
      key: "who", label: t.colWho, width: 2.2, allowOverflow: true,
      render: (r) => {
        if (r.peopleCount === 0) return <Pill variant="missing">{t.noneAssigned}</Pill>;
        // Etapa 4j (4.9): a atribuição em si não se apaga quando a pessoa
        // fica inativa (validade ultrapassada) — mas se TODA a gente
        // atribuída a este cliente, neste dia, estiver inativa, não há
        // ninguém de facto a fazê-lo; mostra o aviso para a gerência
        // reatribuir, em vez da lista de avatares (que ficaria enganosa).
        const allInactive = r.staffList.every((s) => !isStaffActive(s, TODAY));
        if (allInactive) {
          const expired = r.staffList.find((s) => s.accountType === "replacement" && s.validUntil) || r.staffList[0];
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.alert, fontSize: 12.5, fontWeight: 600 }}>
              <AlertTriangle size={13} />
              {t.noPersonWarning(expired.name, expired.validUntil ? dmFromIso(expired.validUntil) : "-")}
            </span>
          );
        }
        // Lote 4, 4.6: mesmo tratamento da vista "Por funcionário" — a
        // lista de avatares vira um botão focável que abre o popover
        // "quem está no cliente" (Remover/Adicionar sempre visíveis,
        // Esc/clique fora fecham), em vez de ser só leitura.
        const key = dayTeamKey(selectedDay, r.client.id);
        const isOpen = openTeam === key;
        const perPerson = Math.round(r.client.duration / r.peopleCount);
        return (
          <div style={{ position: "relative" }}>
            <button
              type="button" aria-haspopup="dialog" aria-expanded={isOpen}
              onClick={() => setOpenTeam((k) => (k === key ? null : key))}
              style={{
                display: "flex", flexWrap: "wrap", gap: 8, border: "none", background: "transparent",
                cursor: "pointer", padding: 0, fontFamily: "inherit", textAlign: "left",
              }}
            >
              {r.staffList.map((s) => (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, opacity: isStaffActive(s, TODAY) ? 1 : 0.5 }}>
                  <Avatar name={s.name} size={22} />
                  <span style={{ fontSize: 12.5, color: COLORS.ink }}>{s.name.split(" ")[0]}</span>
                </span>
              ))}
            </button>
            {isOpen && (
              <ClientTeamPopover
                client={r.client} team={r.staffList} perPerson={perPerson} t={t} c0={c0} staff={staff}
                onRemove={(staffId) => removeClient(staffId, selectedDay, r.client.id)}
                onAdd={(staffId) => mergeAdd(cellKey(staffId, selectedDay), r.client.id)}
                onClose={() => setOpenTeam(null)}
              />
            )}
          </div>
        );
      },
    },
    {
      key: "people", label: t.colPeople, width: 0.8, numeric: true,
      render: (r) => (
        <span style={{ fontWeight: 700, color: r.peopleCount === 0 ? COLORS.alert : r.peopleCount >= 2 ? COLORS.clayInk : COLORS.ink }}>
          {r.peopleCount}
        </span>
      ),
    },
  ];

  // Navegação de semana (ver comentário em `weekStart`, mais acima): mesmo
  // padrão visual/estrutural já usado em Horas (`HorasScreen.jsx`, seta
  // esquerda + rótulo + seta direita dentro de uma pílula) — reaproveita a
  // linguagem de navegação de período já estabelecida no app em vez de
  // inventar uma nova, só troca "mês" por "semana". O botão de calendário
  // (ícone já é o mesmo usado pra "Agendas" na sidebar, ver `tokens.js`)
  // abre `WeekPickerCalendar` pra saltar direto a qualquer semana; "Hoje"
  // só aparece quando a semana em exibição não é a corrente.
  const isCurrentWeek = isoDateStr(weekStart) === isoDateStr(startOfISOWeek(TODAY));
  const weekRangeLabel = formatPeriodLabel({ start: weekStart, end: addDays(weekStart, 6) }, lang);
  const weekNavControl = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.pill, padding: 3 }}>
        <button
          type="button" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label={t.previousWeek}
          style={{ width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, padding: "0 4px", whiteSpace: "nowrap" }}>{weekRangeLabel}</span>
        <button
          type="button" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label={t.nextWeek}
          style={{ width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <button
        type="button" onClick={() => setWeekPickerOpen(true)} aria-label={t.pickWeek} title={t.pickWeek}
        style={{
          width: ctrlHeight, height: ctrlHeight, borderRadius: ctrlRadius, border: `1px solid ${COLORS.line}`,
          background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink,
        }}
      >
        <CalendarDays size={16} />
      </button>
      {!isCurrentWeek && (
        <button
          type="button" onClick={() => setWeekStart(startOfISOWeek(TODAY))}
          style={{
            height: ctrlHeight, padding: "0 12px", borderRadius: ctrlRadius, border: "none",
            background: COLORS.forest50, color: COLORS.forest700, fontSize: 12.5, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          {t.backToToday}
        </button>
      )}
    </div>
  );

  return (
    // QA (achado do Iago — "Agendas"): `styles.content` (partilhado com
    // as outras telas de gerência) tem `overflowY: "auto"` — mas como
    // nada acima dele (`shell`, o wrapper de App.jsx) dá uma altura
    // fixa, essa div nunca chega a rolar sozinha de verdade (quem rola é
    // a página toda); na prática o único efeito real desse `auto` aqui é
    // "roubar" a referência do `position: sticky` do cabeçalho/rodapé da
    // grade logo abaixo (overflow diferente de "visible" vira a nova
    // caixa de referência do sticky) — o cabeçalho parava de prender no
    // topo assim que a página rolava, porque "prendia" a esta caixa que
    // nunca é clipada de verdade, não à janela. `overflowY: "visible"`
    // aqui (só nesta tela — `styles.content` continua igual nas outras)
    // devolve o sticky pra janela real.
    <div style={{ ...styles.content, overflowY: "visible" }}>
      <PageHeader title={t.title} subtitle={t.subtitle} actions={weekNavControl} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
      {weekPickerOpen && (
        <WeekPickerCalendar
          weekStart={weekStart} lang={lang} t={t} c0={c0}
          onSelectWeek={goToWeek}
          onClose={() => setWeekPickerOpen(false)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <SegmentedControl
          options={[{ value: "staff", label: t.viewByStaff }, { value: "day", label: t.viewByDay }]}
          value={view} onChange={setView}
        />
        <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
        {view === "staff" && !weekendHasData && (
          <button type="button" onClick={() => setWeekendOpen((v) => !v)}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: COLORS.forest600, textDecoration: "underline" }}>
            {weekendOpen ? tAbs.hideWeekend : tAbs.showWeekend}
          </button>
        )}
      </div>

      {weekAbsenceRows.length > 0 && (
        <div style={{ border: `1px solid ${COLORS.alert}`, background: "#FFF7F3", borderRadius: RADIUS.card, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>{tAbs.noCover}</div>
          {weekAbsenceRows.map(({ a, staffMember, day, uncovered }) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "5px 0", fontSize: 12.5, color: COLORS.ink, opacity: a.handled ? 0.55 : 1 }}>
              <span style={{ fontWeight: 600 }}>{staffMember.name.split(" ")[0]} · {dayLabels[day]} {pad2(weekDates[day - 1].getDate())}</span>
              <span style={{ color: COLORS.ink2, flex: "1 1 200px" }}>
                {a.note ? `${a.note} — ` : ""}{uncovered.length > 0 ? uncovered.join(", ") : tAbs.allCovered}
              </span>
              <button type="button" onClick={() => toggleHandled(a.id)}
                style={{ border: `1px solid ${COLORS.line}`, background: COLORS.card, borderRadius: RADIUS.chip, cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: "4px 10px", color: COLORS.ink }}>
                {a.handled ? tAbs.reopenAbsence : tAbs.markHandled}
              </button>
            </div>
          ))}
        </div>
      )}

      {copyFrom && (
        <AgendaModal titleId="copy-agenda" title={tAbs.copyTitle(copyFrom.name.split(" ")[0])} closeLabel={c0.cancel} onClose={() => setCopyFrom(null)}>
          <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 10 }}>{tAbs.copyHint}</div>
          <select value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)} style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }}>
            <option value="">{tAbs.copyTargetPlaceholder}</option>
            {staff.filter((o) => o.id !== copyFrom.id && isStaffActive(o, TODAY)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="button" disabled={!copyTarget} onClick={doCopyAgenda}
            style={{ width: "100%", height: 40, borderRadius: RADIUS.control, border: "none", background: copyTarget ? COLORS.forest600 : COLORS.line, color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: copyTarget ? "pointer" : "default" }}>
            {tAbs.copyConfirm}
          </button>
        </AgendaModal>
      )}

      {/* Legenda (documento, 4.3): duração, cliente partilhado, recorrência. */}
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
          {/* Lote 4, 4.5 (achado da Marta): legenda compacta (bolinha
              laranja + "Compartilhado"); o texto inteiro vai pro InfoTip. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.clay, flexShrink: 0 }} />
            {t.legendSharedCompact}
          </span>
          <InfoTip text={t.legendShared} label={c0.moreInfoLabel} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, borderRadius: 8, padding: "0 8px", background: COLORS.lineSoft, fontSize: 11.5, fontWeight: 600, color: COLORS.ink }}>
            {t.legendSampleName} <b>1h</b> <RefreshCw size={10} />
          </span>
          <span>{t.legendRecurring}</span>
        </div>
      </div>

      {view === "staff" ? (
        // QA (achado do Iago — "Agendas"): era `overflowX: "auto"` sozinho
        // numa div sem `overflowY` — por regra da especificação de CSS,
        // isso faz o browser computar o eixo vertical também como "auto"
        // (não dá pra ter só um eixo "visible" e o outro não), transformando
        // esta div num segundo contentor de rolagem por cima do scroll
        // normal da página (daí a sensação de "scroll vertical que não
        // funciona bem"). `overflowY: "hidden"` explícito ao lado do
        // `overflowX: "auto"` tira essa ambiguidade: só o eixo horizontal
        // continua como rede de segurança pra janelas estreitas (abaixo do
        // piso de `AGENDA_GRID_COLS`, ex.: muitos portáteis em 1280-1366px
        // de largura) — sem essa rede, dias inteiros ficariam escondidos
        // sem nenhuma forma de alcançá-los. (Isto NÃO resolve o
        // `position: sticky` do cabeçalho/rodapé não prender de verdade à
        // janela ao rolar a página — esse já era o comportamento de antes
        // desta QA, ver comentário em `AGENDA_GRID_COLS`; preferimos manter
        // os 7 dias sempre alcançáveis a "consertar" o sticky às custas de
        // esconder dados em telas mais estreitas.)
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflowX: "auto", overflowY: "hidden", background: COLORS.card }}>
          <div style={{ minWidth: "100%" }}>
              {/* Cabeçalho pegajoso */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, position: "sticky", top: 0, zIndex: 3, background: COLORS.headerTint, borderBottom: `1px solid ${COLORS.line}` }}>
                <div
                  style={{
                    position: "sticky", left: 0, zIndex: 4, background: COLORS.headerTint,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", height: 44,
                    fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.ink2,
                    borderRight: `1px solid ${COLORS.line}`, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                  }}
                >
                  {t.colStaff}
                </div>
                {shownDays.map((day) => {
                  const i = day - 1;
                  const date = weekDates[i];
                  const isToday = isoDateStr(date) === todayIso;
                  return (
                    <div
                      key={day}
                      style={{
                        height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0,
                        background: isToday ? TODAY_COLUMN_BG : "transparent", borderRight: `1px solid ${COLORS.line}`,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: isToday ? COLORS.forest800 : COLORS.ink2, whiteSpace: "nowrap" }}>
                        {dayLabels[day]} {pad2(date.getDate())}
                      </span>
                      {isToday && (
                        <span style={{ background: COLORS.clay, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>
                          {t.todayBadge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Corpo */}
              {visibleStaff.length === 0 && inactiveStaff.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: COLORS.ink2, fontSize: 13.5 }}>{t.noResults}</div>
              ) : (
                <>
                  {visibleStaff.map(renderStaffRow)}

                  {/* Etapa 4j (4.9): grupo recolhido "Inativos (N)", fechado
                      por defeito — as linhas, quando abertas, são as mesmas
                      (atribuições intactas), só com a aparência esmaecida e
                      a pílula "Inativo" já dadas por renderStaffRow acima. */}
                  {inactiveStaff.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setInactiveOpen((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                          border: "none", borderBottom: `1px solid ${COLORS.lineSoft}`, background: COLORS.headerTint,
                          cursor: "pointer", padding: "10px 16px", fontSize: 12.5, fontWeight: 700, color: COLORS.ink2,
                          position: "sticky", left: 0,
                        }}
                      >
                        {inactiveOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {t.inactiveGroup(inactiveStaff.length)}
                      </button>
                      {inactiveOpen && inactiveStaff.map(renderStaffRow)}
                    </>
                  )}
                </>
              )}

              {/* Rodapé pegajoso */}
              <div style={{ display: "grid", gridTemplateColumns: gridCols, position: "sticky", bottom: 0, background: COLORS.headerTint, borderTop: `1px solid ${COLORS.line}` }}>
                <div
                  style={{
                    position: "sticky", left: 0, background: COLORS.headerTint,
                    padding: "10px 8px", fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, textAlign: "center",
                    borderRight: `1px solid ${COLORS.line}`,
                  }}
                >
                  {t.footerLabel}
                </div>
                {shownDays.map((day) => {
                  const i = day - 1;
                  const date = weekDates[i];
                  const isToday = isoDateStr(date) === todayIso;
                  const { count, totalMin } = dayFooter(day);
                  return (
                    <div
                      key={day}
                      style={{
                        padding: "10px 8px", fontSize: 12, fontWeight: 600, color: COLORS.ink2, textAlign: "center", minWidth: 0,
                        background: isToday ? TODAY_COLUMN_BG : "transparent", borderRight: `1px solid ${COLORS.line}`,
                      }}
                    >
                      {t.footerSummary(count, fmtMinutes(totalMin))}
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {AGENDA_DAYS.map((day, i) => {
              const date = weekDates[i];
              const isToday = isoDateStr(date) === todayIso;
              return (
                <FilterChip key={day} active={selectedDay === day} onClick={() => setSelectedDay(day)}>
                  {dayLabels[day]} {pad2(date.getDate())}{isToday ? ` · ${t.todayBadge}` : ""}
                </FilterChip>
              );
            })}
          </div>
          <DataTable columns={dayColumns} rows={visibleDayRows} getRowId={(r) => r.client.id} emptyMessage={t.noResultsDay} />
        </>
      )}

      {toast && (
        <Toast message={toast.message} actionLabel={toast.actionLabel} onAction={toast.onAction} onDismiss={() => setToast(null)} closeLabel={c0.close} />
      )}
    </div>
  );
}

export default AgendasScreen;
