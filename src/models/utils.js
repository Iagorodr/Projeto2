// Funções puras de cálculo e regras de negócio. Camada "Model".
import { TODAY, MONTHS_ABBR_PT } from "./data.js";
import { T } from "./i18n.js";

function monthAbbr(lang, monthIndex) {
  if (!lang || lang === "pt") return MONTHS_ABBR_PT[monthIndex];
  return T[lang].months[monthIndex].slice(0, 3);
}

function clientById(clients, id) { return clients.find((c) => c.id === id); }
// Cliente "fora da lista": o funcionário escreveu o nome à mão (sem clientId)
// e a gerência corrige depois. Devolve o nome a mostrar para qualquer linha.
function entryClientName(clients, e) {
  const c = clientById(clients, e.clientId);
  if (c) return c.name;
  if (e.custom && e.custom.name) return e.custom.city ? `${e.custom.name} (${e.custom.city})` : e.custom.name;
  return "—";
}
function isPendingClientEntry(e) { return !e.voided && !e.clientId && !!(e.custom && e.custom.name); }

// Um dia conta como "coberto" (fechado, não em falta) se tiver pelo menos um
// lançamento válido OU se o funcionário tiver marcado "Hoje não tive
// clientes" (horasData[staffId].noClientDays, spec 6.3) OU se o cliente
// desse dia já tiver sido feito mais cedo, noutro dia da mesma semana
// ("adiantar" — ver `replacesDate` logo abaixo): nesse caso existe um
// lançamento datado de OUTRO dia com `replacesDate === dateKey`, não um
// lançamento datado deste dia. Sem este terceiro caso, o dia original
// ficava por sempre como "em falta" em todo o lado que usa esta função —
// Horas da gerência (`HorasScreen.jsx`), Monitoramento
// (`MonitoramentoScreen.jsx`), Histórico (`HistoricoScreen.jsx`,
// `EmployeeHistoricoScreen.jsx`) e o próprio ecrã de Horas do funcionário
// — mesmo já estando coberto (apontado pelo Toni ao rever a Etapa 4a).
// Corrigir aqui, na função partilhada, corrige todos esses ecrãs de uma
// vez, sem os tocar individualmente; como `replacesDate` só passou a
// existir com o ecrã novo de Horas, isto não muda nada em dados já
// existentes (nenhum lançamento antigo tem esse campo).
function dayIsCovered(horasEntry, dateKey) {
  const hasEntry = (horasEntry.entries || []).some((e) => e.date === dateKey && !e.voided);
  const markedNoClient = (horasEntry.noClientDays || []).includes(dateKey);
  const coveredByAdvance = (horasEntry.entries || []).some((e) => e.replacesDate === dateKey && !e.voided);
  return hasEntry || markedNoClient || coveredByAdvance;
}

// "Adiantar" (spec 6.3): uma entry pode ter `replacesDate` (ISO) — a data
// originalmente agendada que ela substitui, feita mais cedo. No dia
// original, o cliente deve aparecer como "já feito" (a UI que implementa
// isto lê `replacesDate` das entries do funcionário — Etapa 4a,
// `EmployeeHorasScreen.jsx`) e o dia original conta como coberto, não em
// falta (`dayIsCovered`, acima). Regra: nunca duas entries não-anuladas
// do mesmo cliente na mesma semana. `recomputeSharedHours` (abaixo) não
// precisa de mudar: continua a operar por (date, clientId) normalmente,
// porque a entry adiantada guarda a SUA PRÓPRIA data — só passa a levar
// `replacesDate` como metadado extra.

function recomputeSharedHours(horasDataObj, clients, date, clientId) {
  const client = clientById(clients, clientId);
  if (!client) return horasDataObj;
  const baseDuration = client.duration / 60;
  const staffIdsInvolved = Object.keys(horasDataObj).filter((sid) =>
    (horasDataObj[sid].entries || []).some((e) => e.date === date && e.clientId === clientId && !e.voided)
  );
  const count = staffIdsInvolved.length || 1;
  const perPerson = baseDuration / count;
  const next = { ...horasDataObj };
  staffIdsInvolved.forEach((sid) => {
    next[sid] = {
      ...next[sid],
      entries: next[sid].entries.map((e) => {
        if (e.date === date && e.clientId === clientId && !e.voided) {
          const extraH = (e.extraMinutes || 0) / 60;
          return { ...e, hours: perPerson + extraH, sharedCount: count };
        }
        return e;
      }),
    };
  });
  return next;
}

function staffById(staff, id) { return staff.find((s) => s.id === id); }

// Etapa 4j (documento, 4.9) — único auxiliar que decide se um funcionário
// está "ativo" em todo o app: `estado Ativo && !(tipo Replacement &&
// validade < data)`. A validade é INCLUSIVA (no próprio dia da validade
// ainda está ativo — por isso a comparação é "<", nunca "<="). Calculado
// na hora, nunca gravado: se a gerência prolongar a validade, a pessoa
// volta a estar ativa imediatamente, sem precisar de nenhuma tarefa
// agendada. `date` aceita qualquer data de referência (não só "hoje") —
// chamado com um dia específico, responde "estaria ativo nesse dia?",
// o que é exatamente o que a agenda do funcionário (4.9, "Aplicação do
// funcionário: os dias a seguir à validade ficam sem clientes") precisa.
// `validUntil` vem como "YYYY-MM-DD" (input type="date") — compara-se com
// a mesma convenção de data local usada em todo o resto do projeto (nunca
// `Date.parse` direto numa string ISO, que é UTC e pode desviar um dia).
function isStaffActive(staff, date) {
  if (!staff) return false;
  if (staff.status !== "ativo") return false;
  if (staff.accountType === "replacement" && staff.validUntil) {
    const [y, m, d] = staff.validUntil.split("-").map(Number);
    const validUntilDate = new Date(y, m - 1, d);
    if (validUntilDate < date) return false;
  }
  return true;
}

// QA pós-auditoria (Lote 1, "Fechar período" e as contagens): staff que
// conta nos números de pagamento de Horas e do Dashboard — ativo HOJE OU
// com pelo menos um lançamento não anulado no período aberto (ex.: alguém
// desativado a meio do período que ainda tem horas por pagar). Sem busca
// nem chip — isso é só do `visibleStaff` da tabela de Horas, que filtra
// esta lista por cima. Partilhado entre HorasScreen e DashboardScreen para
// os dois nunca divergirem (antes cada tela fazia a sua própria conta:
// HorasScreen com este mesmo filtro, Dashboard com `staff` inteiro — os
// números não batiam).
function boardStaff(staffList, horasData, period, today) {
  function hasEntriesInOpenPeriod(s) {
    const h = horasData[s.id];
    return !!h && (h.entries || []).some((e) => !e.voided && dateStrInPeriod(e.date, period));
  }
  return staffList.filter((s) => isStaffActive(s, today) || hasEntriesInOpenPeriod(s));
}

// QA pós-auditoria (Lote 3, item 4 do briefing — "'Ativo' com uma
// definição só"): o Dashboard mostrava `clients.length` puro (41) e
// ClientesScreen.jsx excluía quem já tinha contrato vencido (37) — os
// dois números não batiam. Uma versão anterior deste helper tinha optado
// por excluir os vencidos (37); o Iago reconfirmou em 04/10 que quer os
// 41 — todo cliente cadastrado conta como "ativo", um contrato vencido
// vira só uma pendência à parte (cartão de Pendências), não tira o
// cliente da contagem.
function activeClientsCount(clients, today) {
  return clients.length;
}

function pad2(n) { return String(n).padStart(2, "0"); }

// Formatador único de dinheiro pra app inteira (documento de design, 1.5):
// símbolo à frente, espaço, milhar separado, vírgula decimal — "€ 9 266,00".
// O separador de milhar usa espaço-sem-quebra (NBSP,  ) em vez do
// "espaço fino" tipográfico ( ) sugerido no documento: os PDFs
// (pdfExport.js) usam as fontes padrão do jsPDF, que só cobrem
// WinAnsiEncoding —   não existe nesse conjunto e sairia como um
// caractere em branco/errado no PDF, enquanto   faz parte do
// Windows-1252 e sai corretamente tanto no ecrã como no PDF. Visualmente o
// resultado é o mesmo (um espaço que não quebra linha no meio do número).
function fmtEuro(v) {
  const neg = v < 0;
  const [intPart, decPart] = Math.abs(v).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `€ ${neg ? "-" : ""}${grouped},${decPart}`;
}

// Versão compacta pro rótulo direto na barra do gráfico (o slot tem uns
// 40-50px, "€ 9914,50" não cabe sem colidir com o vizinho). O tooltip
// continua mostrando o valor completo via fmtEuro.
function compactEuro(v) {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return `€${Math.round(v)}`;
}

function fmtHoursNum(h) { return h.toFixed(2).replace(".", ","); }

// Formatador de horas PARA O ECRÃ (documento de design, 1.5): "2h30",
// "1h", "41h", "38h30", "45min" — nunca decimais como "2,50" ou "41,00h"
// (isso é só pra PDF/exportações, que continuam usando fmtHoursNum).
// Recebe horas em decimal (ex.: 38.5) pra bater com o resto do app, que
// guarda totais de horas assim. Reaproveita a mesma lógica de fmtMinutes.
// Introduzido na Etapa 1 (fundação/formatadores); já ligado a todos os
// ecrãs redesenhados na Etapa 4 (gerência e funcionário/supervisor) —
// comentário antigo (dizia "ainda não ligado a nenhum ecrã") corrigido
// aqui, varredura de QA pós-Etapa 4, sem mudança de comportamento.
function fmtHoursScreen(hoursDecimal) {
  if (!hoursDecimal || hoursDecimal <= 0) return "0h";
  return fmtMinutes(Math.round(hoursDecimal * 60));
}

function fmtMinutes(min) {
  if (!min || min <= 0) return "-";
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function parseDMY(str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function dateStrInPeriod(dateStr, period) {
  if (!dateStr) return false;
  let d;
  if (dateStr.includes("-")) { const [y, m, day] = dateStr.split("-").map(Number); d = new Date(y, m - 1, day); }
  else if (dateStr.includes("/")) { const [day, m] = dateStr.split("/").map(Number); d = new Date(TODAY.getFullYear(), m - 1, day); }
  else return false;
  return d >= period.start && d <= period.end;
}

function buildClosedPeriodSnapshot(period, clients, staff, horasData, sentItems, missingItems) {
  const staffSummaries = staff.map((s) => {
    const h = horasData[s.id] || { entries: [], paid: false, status: "pendente" };
    return { staffId: s.id, name: s.name, iban: s.iban, hours: staffTotalHours(h, period), euros: staffTotalPay(h, clients, period), paid: h.paid, entries: h.entries.filter((e) => !e.voided && dateStrInPeriod(e.date, period)) };
  });
  const totalHours = staffSummaries.reduce((s, x) => s + x.hours, 0);
  const totalEuros = staffSummaries.reduce((s, x) => s + x.euros, 0);
  const reclamacoesItems = sentItems.filter((i) => i.type === "reclamacao" && dateStrInPeriod(i.date, period));
  const elogiosItems = sentItems.filter((i) => i.type === "elogio" && dateStrInPeriod(i.date, period));
  const avisosItems = sentItems.filter((i) => i.type === "aviso" && dateStrInPeriod(i.date, period));
  const solicitacoesItems = missingItems.filter((i) => dateStrInPeriod(i.date, period));
  return {
    id: Date.now(),
    periodLabel: formatPeriodLabel(period),
    periodStart: isoDateStr(period.start),
    periodEnd: isoDateStr(period.end),
    closedAt: isoDateStr(TODAY),
    staffSummaries, totalHours, totalEuros,
    reclamacoes: reclamacoesItems.length, elogios: elogiosItems.length, avisos: avisosItems.length,
    reclamacoesItems, elogiosItems, avisosItems,
    solicitacoes: solicitacoesItems.length, solicitacoesResolvidas: solicitacoesItems.filter((i) => i.resolved).length,
    solicitacoesItems,
    // Nº de clientes NO MOMENTO do fecho — sem isto, a faixa histórica de
    // Reclamações (Histórico) recalculava contra a lista de clientes de
    // HOJE, e um período fechado há meses ia "andando" toda vez que um
    // cliente era criado/removido depois. Fica congelado aqui.
    clientCount: clients.length,
  };
}

// Lote 4, 4.8 (achado da Marta, confirmado pelo Iago): o período vai até o
// dia exato do corte, incluindo-o — com corte 20, "21 Set a 20 Out", não
// "20 Set a 19 Out" (como era antes: o dia do corte abria o período
// seguinte, nunca fechava o atual). Por isso o limiar de mês também sobe de
// `<` pra `<=` (o próprio dia do corte já pertence ao período que está a
// fechar, não ao que começa) e `start`/`end` passam a `cutoffDay + 1` /
// `cutoffDay`, não `cutoffDay` / `cutoffDay - 1`.
function getCutoffPeriod(baseDate, cutoffDay, offset) {
  let year = baseDate.getFullYear(), month = baseDate.getMonth();
  if (baseDate.getDate() <= cutoffDay) month -= 1;
  month += offset;
  return { start: new Date(year, month, cutoffDay + 1), end: new Date(year, month + 1, cutoffDay) };
}

// O período "aberto" (o próximo a fechar) devia ser sempre "o dia seguinte ao
// fim do último período fechado", NÃO "onde TODAY cai" por matemática pura —
// senão um fecho tardio (gerência fecha com atraso) faz a UI já mostrar
// "hoje" dentro do período seguinte enquanto o período anterior ainda nem foi
// fechado, e horasData ainda contém a mistura das duas fases. Deriva do
// HISTÓRICO real (closedPeriods, sempre com o mais recente em [0] — ver
// recentClosedPeriodsChronological) em vez de TODAY. Sem histórico nenhum
// (empresa nova, ainda não fechou nada), cai de volta ao cálculo por TODAY.
function getOpenPeriod(closedPeriods, cutoffDay, today) {
  if (!closedPeriods || closedPeriods.length === 0) {
    return getCutoffPeriod(today, cutoffDay, 0);
  }
  const lastClosed = closedPeriods[0];
  const [y, m, d] = lastClosed.periodEnd.split("-").map(Number);
  const lastEnd = new Date(y, m - 1, d);
  const start = addDays(lastEnd, 1);
  // Lote 4, 4.8: idem `getCutoffPeriod` (fecha NO dia do corte, não no dia
  // antes) — mas `start` fica como já estava, derivado do histórico real
  // (dia seguinte ao fim do último período fechado), não recalculado por
  // `cutoffDay`. É exatamente isso que faz a virada ser "de uma vez só": no
  // primeiro período aberto depois da mudança, `start` ainda reflete a
  // convenção antiga de quem fechou por último (dia 20) e só `end` já usa a
  // nova (dia do corte, não dia-1) — o período fica um dia mais longo essa
  // única vez (ex.: 20 Ago a 20 Set), e dali em diante os dois lados já
  // nascem na convenção nova (21 a 20).
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cutoffDay);
  return { start, end };
}

// QA (achado do Iago, Avisos — "esses pedidos são de um mês já fechado"):
// um Pedido (missingItems) não tem ligação nenhuma com o período de
// pagamento — só uma `date` solta (string). Quando essa `date` é ISO
// (`"YYYY-MM-DD"`, como todo Pedido criado em tempo real já grava — ver
// `sendCorrectionRequest` em EmployeeHorasScreen.jsx) e cai ANTES do
// início do período aberto (`openPeriod.start`, de `getOpenPeriod`), o
// pedido é de um período que já fechou. Dados de demonstração antigos
// (data.js) guardam `date` como "DD/MM" sem ano (ver comentário em
// `fmtNoteDate`) — sem ano não dá pra comparar com segurança, por isso
// esses sempre devolvem `false` aqui (nunca marcados como "fechado",
// nunca escondidos) em vez de arriscar um ano errado.
function isSolicitationStale(m, openPeriod) {
  if (!m.date || !m.date.includes("-")) return false;
  const [y, mo, d] = m.date.split("-").map(Number);
  const itemDate = new Date(y, mo - 1, d);
  return itemDate < openPeriod.start;
}

function formatPeriodLabel(period, lang) {
  return `${pad2(period.start.getDate())} ${monthAbbr(lang, period.start.getMonth())} - ${pad2(period.end.getDate())} ${monthAbbr(lang, period.end.getMonth())}`;
}

function startOfISOWeek(date) {
  const d = new Date(date), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
}

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

function isoDateStr(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }

function weekDiff(weekStart, ref) { return Math.round((weekStart - ref) / (7 * 24 * 60 * 60 * 1000)); }

const REFERENCE_WEEK_START = startOfISOWeek(new Date(2026, 8, 1));

function clientAppliesThisWeek(client, weekStart) {
  const diff = weekDiff(weekStart, REFERENCE_WEEK_START);
  if (client.frequency === "weekly") return true;
  if (client.frequency === "biweekly") return ((diff % 2) + 2) % 2 === 0;
  if (client.frequency === "monthly") return ((diff % 4) + 4) % 4 === 0;
  return true;
}

function weekLabelPT(weekStart, lang) {
  const end = addDays(weekStart, 6);
  if (weekStart.getMonth() === end.getMonth()) return `${pad2(weekStart.getDate())}-${pad2(end.getDate())} ${monthAbbr(lang, weekStart.getMonth())}`;
  return `${pad2(weekStart.getDate())} ${monthAbbr(lang, weekStart.getMonth())} - ${pad2(end.getDate())} ${monthAbbr(lang, end.getMonth())}`;
}

function getWeekChunk(date, payPeriod) {
  const weekStart = startOfISOWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart < payPeriod.start ? payPeriod.start : weekStart;
  const end = weekEnd > payPeriod.end ? payPeriod.end : weekEnd;
  return { start, end };
}

function getPayPeriodFor(date, cutoffDay) { return getCutoffPeriod(date, cutoffDay, 0); }

function getWeekChunkFor(date, cutoffDay) { return getWeekChunk(date, getPayPeriodFor(date, cutoffDay)); }

function nextWeekChunk(chunk, cutoffDay) { return getWeekChunkFor(addDays(chunk.end, 1), cutoffDay); }

function prevWeekChunk(chunk, cutoffDay) { return getWeekChunkFor(addDays(chunk.start, -1), cutoffDay); }

function buildWeekChunkSequence(anchorDate, cutoffDay, countBefore, countAfter) {
  const anchor = getWeekChunkFor(anchorDate, cutoffDay);
  const list = [anchor];
  let cursor = anchor;
  for (let i = 0; i < countAfter; i++) { cursor = nextWeekChunk(cursor, cutoffDay); list.push(cursor); }
  const before = [];
  cursor = anchor;
  for (let i = 0; i < countBefore; i++) { cursor = prevWeekChunk(cursor, cutoffDay); before.unshift(cursor); }
  return { list: [...before, ...list], anchorIndex: before.length };
}

function weekChunksOfPayPeriod(payPeriod, cutoffDay) {
  const chunks = [];
  let cursor = payPeriod.start;
  while (cursor <= payPeriod.end) {
    const chunk = getWeekChunk(cursor, payPeriod);
    chunks.push(chunk);
    cursor = addDays(chunk.end, 1);
  }
  return chunks;
}

// --- Blocos do período, "opção B" (spec 6.1) --------------------------
// O período de pagamento vai de dia 21 a dia 20 (Lote 4, 4.8) e a semana
// civil é segunda-domingo; como o período raramente começa numa segunda ou
// acaba num domingo, `weekChunksOfPayPeriod` às vezes devolve um bloco de só
// 1 dia numa ponta (ex.: período 21 jun–20 jul 2026, em que 21 jun cai num
// domingo — só esse dia sobra da semana anterior — e 20 jul numa segunda —
// só esse dia sobra da semana seguinte). Um bloco de 1 dia sozinho não faz
// sentido pra navegação/finalização, então junta-se ao bloco vizinho.
function isOneDayChunk(chunk) { return isoDateStr(chunk.start) === isoDateStr(chunk.end); }

function mergeEdgeBlocks(chunks) {
  if (chunks.length < 2) return chunks;
  let merged = chunks;
  if (isOneDayChunk(merged[0])) {
    merged = [{ start: merged[0].start, end: merged[1].end }, ...merged.slice(2)];
  }
  if (merged.length >= 2 && isOneDayChunk(merged[merged.length - 1])) {
    const last = merged.length - 1;
    merged = [...merged.slice(0, last - 1), { start: merged[last - 1].start, end: merged[last].end }];
  }
  return merged;
}

// Devolve os blocos "visíveis" do período (o que a UI mostra: normalmente 4,
// dois deles com 8 dias quando há fusão nas pontas). A chave de cada bloco
// (pra `lockedWeeks`) é `isoDateStr(block.start)`.
function weekBlocksOfPayPeriod(payPeriod, cutoffDay) {
  return mergeEdgeBlocks(weekChunksOfPayPeriod(payPeriod, cutoffDay));
}

// Migração de `lockedWeeks`: dados antigos foram gravados com uma chave por
// semana civil "crua" (incluindo blocos de 1 dia nas pontas). Com os blocos
// fundidos, um bloco da ponta passa a responder por mais de uma chave antiga
// — a chave do bloco novo é a data de início do PRIMEIRO sub-bloco (a mesma
// de antes para o bloco da esquerda; nova para o da direita, que absorve o
// que era um bloco de 1 dia isolado) e o valor é o **E lógico** dos valores
// antigos (só fica trancado se TODOS os sub-blocos estavam). Migração feita
// À LEITURA — não apaga nem reescreve `lockedWeeks` guardado, só interpreta.
function migrateLockedWeeksToBlocks(lockedWeeks, payPeriod, cutoffDay) {
  const rawChunks = weekChunksOfPayPeriod(payPeriod, cutoffDay);
  const blocks = mergeEdgeBlocks(rawChunks);
  const result = {};
  blocks.forEach((block) => {
    const blockKey = isoDateStr(block.start);
    const subChunks = rawChunks.filter((c) => c.start >= block.start && c.end <= block.end);
    const allLocked = subChunks.length > 0 && subChunks.every((c) => !!(lockedWeeks && lockedWeeks[isoDateStr(c.start)]));
    if (allLocked) result[blockKey] = true;
  });
  return result;
}

function calPeriodDays(period) {
  const days = [];
  let cursor = period.start;
  while (cursor <= period.end) { days.push(cursor); cursor = addDays(cursor, 1); }
  return days;
}

function calPeriodLabel(period, lang) {
  if (period.start.getMonth() === period.end.getMonth()) return `${pad2(period.start.getDate())}-${pad2(period.end.getDate())} ${monthAbbr(lang, period.start.getMonth())}`;
  return `${pad2(period.start.getDate())} ${monthAbbr(lang, period.start.getMonth())} - ${pad2(period.end.getDate())} ${monthAbbr(lang, period.end.getMonth())}`;
}

// `period` é opcional (compatível com todas as chamadas existentes, que
// continuam a somar TODAS as entries não anuladas). Quando passado (formato
// {start, end} em Date, igual ao que getCutoffPeriod/getWeekChunk devolvem),
// só soma entries cuja data cai dentro do período — é o que impede que horas
// lançadas já no período seguinte (antes de um fecho tardio) poluam o total
// do período que está a ser fechado/mostrado.
function staffTotalHours(horasEntry, period) {
  return horasEntry.entries
    .filter((e) => !e.voided && (!period || dateStrInPeriod(e.date, period)))
    .reduce((s, e) => s + e.hours, 0);
}

function staffTotalPay(horasEntry, clients, period) {
  return horasEntry.entries
    .filter((e) => !e.voided && (!period || dateStrInPeriod(e.date, period)))
    .reduce((s, e) => {
      const c = clientById(clients, e.clientId);
      return s + e.hours * (c ? c.valueHour : 0);
    }, 0);
}

function shortMonthFromIso(isoStr, lang) {
  const [, m] = isoStr.split("-").map(Number);
  return monthAbbr(lang, m - 1);
}

function recentClosedPeriodsChronological(closedPeriods, count) {
  // closedPeriods vem sempre do mais recente pro mais antigo (novo período é
  // adicionado no início da lista); aqui devolvemos os últimos `count`, mas
  // em ordem cronológica (mais antigo -> mais recente), pronta pra um gráfico.
  return [...closedPeriods].slice(0, count).reverse();
}

function getAssignedClientIds(assignments, staffId) {
  const ids = new Set();
  Object.entries(assignments).forEach(([key, clientIds]) => {
    if (key.startsWith(`${staffId}-`)) clientIds.forEach((id) => ids.add(id));
  });
  return [...ids];
}

// Clientes da agenda (semana tipo) de `staffId` numa DATA concreta (spec
// 5.2.4: o painel do dia mostra um cartão por cliente da agenda, já
// marcável — antes só existia por dia-da-semana genérico, em
// `EmployeeAgendaScreen.getDayOccurrences`; esta função faz o mesmo cálculo
// mas para uma data específica, reutilizável em Horas e Agenda. `assignments`
// guarda `staffId-diaDaSemana(1-7)` -> ids de cliente; `clientAppliesThisWeek`
// filtra quinzenal/mensal pela semana da data dada.
function dayScheduledClients(clients, assignments, staffId, date) {
  const dow = date.getDay() === 0 ? 7 : date.getDay();
  const weekStart = startOfISOWeek(date);
  const clientIds = assignments[`${staffId}-${dow}`] || [];
  return clientIds
    .map((id) => clientById(clients, id))
    .filter((c) => c && clientAppliesThisWeek(c, weekStart));
}

// Etapa 4b (secção 5.1, "Esta semana") — resumo da semana CIVIL corrente
// (segunda a domingo que contém `today`), independente dos blocos do
// período de pagamento (que podem ter 8 dias nas pontas — "opção B"). Soma
// horas registadas (só no dia do próprio lançamento, nunca no dia de
// origem de um "adiantamento" — mesma regra de `hoursLabel` em
// `EmployeeHorasScreen.buildCalDay`, pra não contar a mesma hora duas
// vezes) e horas previstas pela agenda, dia a dia, mais o estado de cada
// um dos 7 pontos do cartão (verde registado · contorno alert em falta ·
// vazio futuro · tracejado sem clientes).
function thisWeekSummary(clients, assignments, staffId, horasEntry, today, staffMember) {
  const weekStart = startOfISOWeek(today);
  const days = [];
  let registeredHours = 0;
  let scheduledHours = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dateKey = isoDateStr(d);
    // `staffMember` é opcional (Etapa 4j, 4.9) — quando passado, um dia já
    // para lá da validade de uma conta Replacement conta como "sem
    // clientes", mesmo que a agenda/atribuição ainda exista (as
    // atribuições não se apagam — só deixam de se aplicar nesses dias).
    const activeOnDay = !staffMember || isStaffActive(staffMember, d);
    const scheduled = activeOnDay ? dayScheduledClients(clients, assignments, staffId, d) : [];
    const hasAgenda = scheduled.length > 0;
    scheduledHours += scheduled.reduce((s, c) => s + (c.duration || 0) / 60, 0);
    const covered = dayIsCovered(horasEntry, dateKey);
    if (covered) {
      registeredHours += (horasEntry.entries || [])
        .filter((e) => e.date === dateKey && !e.voided)
        .reduce((s, e) => s + e.hours, 0);
    }
    let state;
    if (covered) state = "registered";
    else if (!hasAgenda) state = "noClients";
    else if (d > today) state = "future";
    else state = "missing";
    days.push({ dateKey, state, isToday: dateKey === isoDateStr(today) });
  }
  return { registeredHours, scheduledHours, days };
}

// Etapa 4b (5.1, "Precisa da sua atenção" — "Dias por registar") — dias em
// falta no período aberto INTEIRO (todos os blocos, não só o atual — mesma
// regra do `periodMissingCount` já calculado em `EmployeeHorasScreen.jsx`,
// só que devolvendo as datas em vez da contagem, pra dar pra mostrar a
// primeira em falta ("Segunda-feira, 28/09"). Ordenadas da mais antiga pra
// mais recente.
function periodMissingDays(clients, assignments, staffId, horasEntry, payPeriodChunks, today, staffMember) {
  const missing = [];
  payPeriodChunks.forEach((chunk) => {
    calPeriodDays(chunk).forEach((d) => {
      // `staffMember` opcional (Etapa 4j, 4.9): dia já fora da validade de
      // uma conta Replacement nunca conta como "em falta" (não há mais
      // agenda real nesse dia, só a atribuição antiga que fica guardada).
      const activeOnDay = !staffMember || isStaffActive(staffMember, d);
      if (d <= today && activeOnDay && dayScheduledClients(clients, assignments, staffId, d).length > 0 && !dayIsCovered(horasEntry, isoDateStr(d))) {
        missing.push(d);
      }
    });
  });
  return missing.sort((a, b) => a - b);
}

// Etapa 4b (5.1, "Precisa da sua atenção" — "Dias em falta na equipa",
// só supervisor) — quantos funcionários (ativos, fixos) têm pelo menos um
// dia em falta no período aberto, E quantos DIAS em falta há no total.
// Mesma regra/filtros/classificação de dia-a-dia do `weeksInfoFor`/
// `monitored`/`totalGapsSum` de `MonitoramentoScreen.jsx` (semana trancada
// ou ainda não começada não conta como "em falta"), reescrita aqui como
// função independente pra não obrigar a montar a tela inteira de
// Monitoramento só pra ler este número — os dois continuam a bater porque
// partilham as mesmas peças do Model (`dayIsCovered`, `clientAppliesThisWeek`,
// `migrateLockedWeeksToBlocks`).
//
// QA pós-auditoria (Lote 2, "dias em falta na equipa" contando dias): antes
// devolvia só a contagem de FUNCIONÁRIOS (um booleano "tem algum furo" por
// pessoa), mas o cartão "Precisa da sua atenção" do Início mostra isto como
// número de DIAS — e o "Como conferir" do documento exige que esse total
// bata com o total do Monitoramento (soma de `totalGaps`, não a contagem de
// linhas). Devolve os dois números: quem só precisava do selo de
// funcionários (badge da folha "Mais", App.jsx) lê `.staffCount`; quem
// precisa do total de dias (Início) lê `.totalDays`.
function staffWithGapsCount(staff, horasData, clients, assignments, payPeriod, payPeriodChunks, cutoffDay, today) {
  function isoWeekday(d) { const wd = d.getDay(); return wd === 0 ? 7 : wd; }
  function hasAgendaOnDay(staffId, d) {
    const clientIds = assignments[`${staffId}-${isoWeekday(d)}`] || [];
    const weekStart = startOfISOWeek(d);
    return clientIds.some((id) => { const c = clientById(clients, id); return c && clientAppliesThisWeek(c, weekStart); });
  }
  let staffCount = 0;
  let totalDays = 0;
  staff
    .filter((s) => isStaffActive(s, today) && s.accountType === "fixo")
    .forEach((s) => {
      const h = horasData[s.id] || { entries: [], lockedWeeks: {}, noClientDays: [] };
      const migratedLocked = migrateLockedWeeksToBlocks(h.lockedWeeks, payPeriod, cutoffDay);
      const gaps = payPeriodChunks.reduce((sum, chunk) => {
        const locked = !!migratedLocked[isoDateStr(chunk.start)];
        const notStarted = chunk.start > today;
        if (locked || notStarted) return sum;
        const missed = calPeriodDays(chunk).filter(
          (d) => d <= today && hasAgendaOnDay(s.id, d) && !dayIsCovered(h, isoDateStr(d))
        ).length;
        return sum + missed;
      }, 0);
      if (gaps > 0) {
        staffCount += 1;
        totalDays += gaps;
      }
    });
  return { staffCount, totalDays };
}

// Bloco de notas/lembretes pessoais (dashboard do supervisor e, opcionalmente,
// da gerência). `ownerId` é o id do funcionário dono da nota, ou a string
// "management" para notas partilhadas por todos os logins de gerência.
function notesForOwner(personalNotes, ownerId) {
  return (personalNotes || [])
    .filter((n) => n.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

// "YYYY-MM-DD" (formato do <input type="date">) -> "DD/MM" pra exibição.
// QA pós-auditoria: alguns dados de demonstração antigos (INITIAL_MISSING,
// data.js) já guardam a data como "DD/MM" em vez de ISO — sem "-", o
// destructuring abaixo dava `undefined/undefined`. Devolve a própria
// string nesse caso; a migração desses dados-exemplo para ISO fica para
// depois (fora do risco aceitável desta leva).
function fmtNoteDate(dateStr) {
  if (!dateStr.includes("-")) return dateStr;
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// --- Etapa 4f (Clientes, documento 4.2/5.4) ---

// Soma as horas lançadas por TODOS os funcionários para UM cliente, num
// período (documento, 4.2: "Horas no período" = horas feitas ÷ meta mensal
// do cliente). Espelha `staffTotalHours`, só que soma por `horasData`
// inteiro (todos os donos de registo) filtrando por `e.clientId`, em vez de
// somar as entries de UM funcionário já escolhido.
function clientTotalHours(horasData, clientId, period) {
  return Object.values(horasData).reduce((sum, horasEntry) => {
    return sum + (horasEntry.entries || [])
      .filter((e) => !e.voided && e.clientId === clientId && (!period || dateStrInPeriod(e.date, period)))
      .reduce((s, e) => s + e.hours, 0);
  }, 0);
}

// Equipa atribuída a um cliente (documento, 4.2: "Equipa" = avatares de
// quem faz este cliente). `assignments` é a semana-tipo plana, chave
// "staffId-day" (ver `cellKey` em AgendasScreen.jsx) — percorre todas as
// células e junta os IDs de funcionário que têm este cliente em QUALQUER
// dia da semana-tipo, sem distinguir dias (mesmo modelo já usado em
// Agendas; ver nota em AgendasScreen.jsx sobre `assignments` não ter
// relação com `client.days`/`frequency`).
function clientTeamStaffIds(assignments, clientId) {
  const ids = new Set();
  Object.entries(assignments).forEach(([key, cids]) => {
    if ((cids || []).includes(clientId)) {
      const staffId = Number(key.slice(0, key.lastIndexOf("-")));
      ids.add(staffId);
    }
  });
  return Array.from(ids);
}

// Sugestão de "Horas por mês (meta)" calculada a partir da própria agenda
// do cliente (documento, 4.2: "Pela agenda: 32h30 (2h30 × 3 dias × 4,33)")
// — duração da visita × nº de dias por semana × 4,33 (semanas médias por
// mês, mesma constante usada em calendários de RH). Devolve horas em
// decimal, pronta para `fmtHoursScreen`.
function agendaHoursSuggestion(client) {
  const weeklyHours = ((client.duration || 0) / 60) * (client.days || []).length;
  return weeklyHours * 4.33;
}

// --- Etapa 4g (Histórico, documento 4.6/5.5) ---

// Variação percentual entre dois valores (documento, 4.6: pílula "+6 %" na
// lista e nos KPIs do detalhe, sempre "face ao período anterior"). Devolve
// `null` quando não há período anterior ou ele é 0 (nada pra comparar —
// quem usa isto mostra "Sem período anterior" nesse caso, não "0%" nem
// Infinity). Pura função de número pra número, sem noção de cor/UI — a
// decisão de cor (nunca vermelho-alerta pra "desceu", só a regra de QA
// geral do documento, 1.5: "nenhuma cor de alerta em elementos que não
// sejam erro ou falta" — uma descida de horas/valor face ao mês passado
// não é um erro) fica no componente que desenha a pílula, em
// HistoricoScreen.jsx.
function pctChange(current, previous) {
  if (!previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export { entryClientName, isPendingClientEntry, clientById, dayIsCovered, recomputeSharedHours, staffById, isStaffActive, boardStaff, activeClientsCount, pad2, fmtEuro, compactEuro, fmtHoursNum, fmtHoursScreen, fmtMinutes, parseDMY, dateStrInPeriod, buildClosedPeriodSnapshot, getCutoffPeriod, getOpenPeriod, isSolicitationStale, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr, weekDiff, REFERENCE_WEEK_START, clientAppliesThisWeek, weekLabelPT, getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk, buildWeekChunkSequence, weekChunksOfPayPeriod, weekBlocksOfPayPeriod, migrateLockedWeeksToBlocks, calPeriodDays, calPeriodLabel, staffTotalHours, staffTotalPay, getAssignedClientIds, dayScheduledClients, recentClosedPeriodsChronological, shortMonthFromIso, notesForOwner, fmtNoteDate, thisWeekSummary, periodMissingDays, staffWithGapsCount, monthAbbr, clientTotalHours, clientTeamStaffIds, agendaHoursSuggestion, pctChange };
