import { useState, useRef, useEffect, useId } from "react";
import { Plus, X, UsersRound, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { AGENDA_DAYS, TODAY, LANG_NAMES } from "../../models/data.js";
import { clientById, staffById, startOfISOWeek, addDays, isoDateStr, pad2, fmtMinutes, fmtHoursScreen, isStaffActive } from "../../models/utils.js";
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

// Lote 4, 4.6 (achado da Marta): "quem está no cliente" — o bloco
// compartilhado (chip na vista "Por funcionário", avatares na coluna
// "Quem" da vista "Por dia") vira um botão focável; isto é o popover que
// abre, com nomes+mini-avatares+duração de cada um, "Remover" sempre
// visível (sem precisar de hover) e "Adicionar" pra juntar outro
// funcionário a este cliente neste dia. Esc e clique fora fecham —
// mesmo padrão do `InfoTip.jsx` (useEffect com listeners em `document`
// só enquanto aberto), adaptado de tooltip pra popover/diálogo: aqui
// abre só por clique/Enter (não por hover/focus), e usa `role="dialog"`
// em vez de `role="tooltip"` porque o conteúdo já não é só texto.
function ClientTeamPopover({ client, team, perPerson, t, c0, staff, onRemove, onAdd, onClose }) {
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const rootRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const availableStaff = staff
    .filter((s) => !team.some((m) => m.id === s.id))
    .filter((s) => s.name.toLowerCase().includes(addSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      ref={rootRef} role="dialog" aria-labelledby={titleId}
      style={{
        position: "absolute", top: "100%", left: 0, marginTop: 4, width: 240, zIndex: 20,
        background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control,
        boxShadow: SHADOW.sh2, padding: 10,
      }}
    >
      <div id={titleId} style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>
        {client.name} · {t.peopleLabel(team.length)}
      </div>
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
    </div>
  );
}

// Agendas (documento de design, secção 4.3) — "ver e mudar quem faz que
// cliente em cada dia da semana". `assignments` é uma semana-tipo (repete
// todas as semanas), independente de `client.days`/`frequency` — isso já
// era assim no ecrã antigo e não muda aqui; só a apresentação muda.
function AgendasScreen({ lang, setLang, clients, staff, assignments, setAssignments }) {
  const t = T[lang].agendas;
  const c0 = T[lang].common;
  const tc = T[lang].clientes;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const [search, setSearch] = useState("");
  const [view, setView] = useState("staff"); // "staff" | "day"
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

  const weekStart = startOfISOWeek(TODAY);
  const weekDates = AGENDA_DAYS.map((_, i) => addDays(weekStart, i));
  const todayIso = isoDateStr(TODAY);
  const todayAgendaDay = AGENDA_DAYS[weekDates.findIndex((d) => isoDateStr(d) === todayIso)] ?? AGENDA_DAYS[0];
  const [selectedDay, setSelectedDay] = useState(todayAgendaDay);

  function showToast(message, opts) {
    setToast({ message, ...opts });
    setTimeout(() => setToast((cur) => (cur && cur.message === message ? null : cur)), 5000);
  }

  function cellKey(staffId, day) { return `${staffId}-${day}`; }
  function getCellClientIds(staffId, day) { return assignments[cellKey(staffId, day)] || []; }
  function teamSizeFor(day, clientId) { return staff.filter((s) => getCellClientIds(s.id, day).includes(clientId)).length; }
  // Lote 4, 4.6: mesma lista que `teamSizeFor` conta, mas devolvendo quem
  // são (não só quantos) — pro popover "quem está no cliente".
  function staffOnClient(day, clientId) { return staff.filter((s) => getCellClientIds(s.id, day).includes(clientId)); }
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
  function addClient(staffId, day, clientId) {
    mergeAdd(cellKey(staffId, day), clientId);
    setCellSearch(""); setOpenCell(null);
  }
  function removeClient(staffId, day, clientId) {
    const key = cellKey(staffId, day);
    const client = clientById(clients, clientId);
    const member = staffById(staff, staffId);
    setAssignments((prev) => ({ ...prev, [key]: (prev[key] || []).filter((id) => id !== clientId) }));
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
  const matchingStaff = staff.filter(staffMatchesSearch);
  const visibleStaff = matchingStaff.filter((s) => isStaffActive(s, TODAY));
  const inactiveStaff = matchingStaff.filter((s) => !isStaffActive(s, TODAY));

  // Extraído do corpo do quadro "Por funcionário" para poder ser reusado
  // tanto nas linhas normais como dentro do grupo recolhido "Inativos"
  // (Etapa 4j, 4.9) — exatamente a mesma linha, só muda de onde é chamada.
  function renderStaffRow(s) {
    const inactive = !isStaffActive(s, TODAY);
    return (
      <div key={s.id} style={{ display: "flex", borderBottom: `1px solid ${COLORS.lineSoft}`, opacity: inactive ? 0.6 : 1 }}>
        <div
          style={{
            width: 230, flexShrink: 0, position: "sticky", left: 0, zIndex: 1, background: COLORS.card,
            display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "10px 16px",
            borderRight: `1px solid ${COLORS.line}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Avatar name={s.name} size={32} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.ink }}>{s.name}</span>
            {/* Bug pré-existente (Etapa 4e) encontrado de passagem ao mexer
                nesta linha agora: `funcionarios.roleSupervisor` nunca
                existiu no i18n (só `acessos.roleSupervisor`) — a etiqueta
                renderizava a palavra "undefined" pra qualquer supervisor
                nesta grelha. Corrigido aqui (ver LEIA-ME). */}
            {s.role === "supervisor" && <SupervisorTag kind="role">{T[lang].acessos.roleSupervisor}</SupervisorTag>}
            {inactive && <Pill variant="missing">{T[lang].common.inactive}</Pill>}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.ink2, paddingLeft: 40 }}>
            {inactive && s.accountType === "replacement" && s.validUntil
              ? t.inactiveExpiredOn(dmFromIso(s.validUntil))
              : `${fmtHoursScreen(staffWeekMinutes(s.id) / 60)} ${t.weekTotalSuffix}`}
          </div>
        </div>
        {AGENDA_DAYS.map((day, i) => {
          const date = weekDates[i];
          const isToday = isoDateStr(date) === todayIso;
          const clientIds = getCellClientIds(s.id, day);
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
                width: 170, flexShrink: 0, position: "relative", padding: 8, display: "flex", flexDirection: "column", gap: 6,
                minHeight: 56, background: isToday ? TODAY_COLUMN_BG : "transparent", borderRight: `1px solid ${COLORS.line}`,
              }}
            >
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
                          display: "flex", alignItems: "center", gap: 4, height: 30, width: "100%", borderRadius: RADIUS.chip,
                          padding: "0 8px", background: COLORS.clayTint, fontSize: 12.5, border: "none", cursor: "pointer",
                          fontFamily: "inherit", textAlign: "left",
                        }}
                      >
                        <UsersRound size={12} style={{ flexShrink: 0, color: COLORS.clayInk }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, color: COLORS.clayInk }}>
                          {client.name}
                        </span>
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
                      display: "flex", alignItems: "center", gap: 4, height: 30, borderRadius: RADIUS.chip, padding: "0 8px",
                      background: COLORS.lineSoft, fontSize: 12.5,
                    }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500, color: COLORS.ink }}>
                      {client.name}
                    </span>
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

              {isOpenPopover ? (
                <div
                  style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, width: 250, zIndex: 10,
                    background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, padding: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <SearchField value={cellSearch} onChange={setCellSearch} placeholder={t.addClientPlaceholder} style={{ flex: 1 }} />
                    <button
                      type="button" onClick={() => { setOpenCell(null); setCellSearch(""); }} aria-label={c0.cancel}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, flexShrink: 0, display: "flex" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
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
                </div>
              ) : isHovered && (
                <button
                  type="button" onClick={() => setOpenCell(key)} aria-label={t.addClientPlaceholder}
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
      if ((c.days || []).includes(day)) byClient.set(c.id, { client: c, staffIds: new Set() });
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

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <SegmentedControl
          options={[{ value: "staff", label: t.viewByStaff }, { value: "day", label: t.viewByDay }]}
          value={view} onChange={setView}
        />
        <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} style={{ width: 260 }} />
      </div>

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
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden", background: COLORS.card }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: "100%", width: "max-content" }}>
              {/* Cabeçalho pegajoso */}
              <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 3, background: COLORS.headerTint, borderBottom: `1px solid ${COLORS.line}` }}>
                <div
                  style={{
                    width: 230, flexShrink: 0, position: "sticky", left: 0, zIndex: 4, background: COLORS.headerTint,
                    display: "flex", alignItems: "center", padding: "0 16px", height: 44,
                    fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.ink2,
                    borderRight: `1px solid ${COLORS.line}`,
                  }}
                >
                  {t.colStaff}
                </div>
                {AGENDA_DAYS.map((day, i) => {
                  const date = weekDates[i];
                  const isToday = isoDateStr(date) === todayIso;
                  return (
                    <div
                      key={day}
                      style={{
                        width: 170, flexShrink: 0, height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        background: isToday ? TODAY_COLUMN_BG : "transparent", borderRight: `1px solid ${COLORS.line}`,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: isToday ? COLORS.forest800 : COLORS.ink2 }}>
                        {dayLabels[day]} {pad2(date.getDate())}
                      </span>
                      {isToday && (
                        <span style={{ background: COLORS.clay, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 7px" }}>
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
              <div style={{ display: "flex", position: "sticky", bottom: 0, background: COLORS.headerTint, borderTop: `1px solid ${COLORS.line}` }}>
                <div
                  style={{
                    width: 230, flexShrink: 0, position: "sticky", left: 0, background: COLORS.headerTint,
                    padding: "10px 16px", fontSize: 12, fontWeight: 700, color: COLORS.ink2, borderRight: `1px solid ${COLORS.line}`,
                  }}
                >
                  {t.footerLabel}
                </div>
                {AGENDA_DAYS.map((day, i) => {
                  const date = weekDates[i];
                  const isToday = isoDateStr(date) === todayIso;
                  const { count, totalMin } = dayFooter(day);
                  return (
                    <div
                      key={day}
                      style={{
                        width: 170, flexShrink: 0, padding: "10px 8px", fontSize: 12, fontWeight: 600, color: COLORS.ink2, textAlign: "center",
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
