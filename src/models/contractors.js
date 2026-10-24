// Contratantes: quem paga à empresa pelas horas feitas nos clientes.
// Um contratante tem UM valor/hora (o que ele paga) igual para todos os seus
// clientes, e um valor/hora padrão pago ao funcionário que pré-preenche o
// cliente novo (cada cliente pode depois ter o seu, em `valueHour`).
// "Clientes diretos" (`isDirect`): sem valor próprio, o preço é de cada cliente.
// O cliente liga-se ao contratante pelo NOME, em `client.origin`
// (era a antiga "origem" em texto livre).

// Paleta fixa de 12 cores (8 do Tomás + vermelho, laranja, amarelo e preto pedidos pelo Iago): todas aguentam texto branco (contraste ≥ 4,5:1). O amarelo é um mostarda
// escuro (o amarelo claro não aguenta texto branco). A cor é guardada no contratante.
export const CONTRACTOR_COLORS = ["#143F35", "#23806A", "#4A6FB5", "#7A5BB5", "#23809E", "#9A4F96", "#5E7E1F", "#5F6B66", "#C0392B", "#B8560A", "#9A6B00", "#1A1A1A"];
export const CONTRACTOR_COLOR_NAMES = { pt: ["Floresta", "Verde", "Azul", "Roxo", "Ciano", "Ameixa", "Oliva", "Cinza", "Vermelho", "Laranja", "Amarelo", "Preto"], en: ["Forest", "Green", "Blue", "Purple", "Cyan", "Plum", "Olive", "Grey", "Red", "Orange", "Yellow", "Black"], fr: ["Forêt", "Vert", "Bleu", "Violet", "Cyan", "Prune", "Olive", "Gris", "Rouge", "Orange", "Jaune", "Noir"] };

// Cores da paleta antiga → cor mais próxima da nova (só ao ler; XLG/CleanUp/L e A ficam como estavam).
const LEGACY_COLORS = { "#143F35": "#143F35", "#2E8A73": "#23806A", "#7FC1AB": "#23809E", "#C8532E": "#9A4F96", "#5B7DB1": "#4A6FB5", "#B08A2E": "#5E7E1F" };
export function normalizeContractorColor(hex) {
  const h = String(hex || "").toUpperCase();
  return LEGACY_COLORS[h] || (h || CONTRACTOR_COLORS[0]);
}

// Contratante novo: a primeira cor da paleta ainda não usada (se as 8 estiverem usadas, recomeça na 1).
export function nextContractorColor(contractors) {
  const used = new Set((contractors || []).map((c) => String(c.color || "").toUpperCase()));
  return CONTRACTOR_COLORS.find((c) => !used.has(c)) || CONTRACTOR_COLORS[(contractors || []).length % CONTRACTOR_COLORS.length];
}

export const EMPTY_CONTRACTOR = {
  name: "", color: CONTRACTOR_COLORS[0], isDirect: false,
  rate: "", staffRate: "", billingDay: "", paymentDays: "",
  periodStartDay: "", periodEndDay: "", periodMonths: "", periodAnchor: "",
  contactName: "", email: "", note: "",
};

// Nomes que, escritos como "origem", querem dizer "clientes diretos".
const DIRECT_NAMES = new Set(["próprio", "proprio", "própria", "propria", "direto", "direta", "direct", "own", "propre", "propres"]);

export function normName(s) { return String(s || "").trim().toLowerCase(); }
export function isDirectName(s) { return DIRECT_NAMES.has(normName(s)); }

export function findContractor(contractors, name) {
  const n = normName(name);
  if (!n) return null;
  return (contractors || []).find((c) => normName(c.name) === n) || null;
}

export function contractorNameTaken(contractors, name, exceptId) {
  const n = normName(name);
  return !!n && (contractors || []).some((c) => c.id !== exceptId && normName(c.name) === n);
}

export function clientsOfContractor(clients, contractor) {
  if (!contractor) return [];
  const n = normName(contractor.name);
  return (clients || []).filter((cl) => normName(cl.origin) === n);
}

// Clientes cuja origem não bate com nenhum contratante (ou está vazia).
export function clientsWithoutContractor(clients, contractors) {
  const names = new Set((contractors || []).map((c) => normName(c.name)));
  return (clients || []).filter((cl) => !names.has(normName(cl.origin)));
}

// O valor/hora mais usado entre os clientes (para o valor padrão do funcionário).
function mostCommon(values) {
  const count = new Map();
  values.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
  let best = "", bestN = 0;
  count.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
  return best;
}

// Cria um contratante por cada "origem" escrita nos clientes (primeira grafia
// que aparece), sem repetir os que já existem. Usado uma vez, ao migrar.
export function deriveContractors(clients, existing = []) {
  const known = new Set((existing || []).map((c) => normName(c.name)));
  const byName = new Map();
  (clients || []).forEach((cl) => {
    const n = normName(cl.origin);
    if (!n || known.has(n)) return;
    if (!byName.has(n)) byName.set(n, { name: String(cl.origin).trim(), clients: [] });
    byName.get(n).clients.push(cl);
  });
  const base = Date.now();
  const taken = [...(existing || [])];
  return Array.from(byName.values()).map((g, i) => {
    const direct = isDirectName(g.name);
    const values = g.clients.map((cl) => Number(cl.valueHour)).filter((v) => v > 0);
    const made = {
      ...EMPTY_CONTRACTOR,
      id: base + i,
      name: g.name,
      color: nextContractorColor(taken),
      isDirect: direct,
      staffRate: values.length ? mostCommon(values) : "",
    };
    taken.push(made);
    return made;
  });
}

// Margem por hora de um cliente (o que o contratante paga menos o que o
// funcionário recebe). null quando não dá para calcular (cliente direto sem preço).
export function marginPerHour(contractor, client) {
  // Contratante normal: valor/hora único; "Direto": o preço de cada cliente (sellPrice).
  const rate = Number(contractor && contractor.isDirect ? client && client.sellPrice : contractor && contractor.rate);
  const pay = Number(client && client.valueHour);
  if (!(rate > 0) || !(pay >= 0) || String(client && client.valueHour).trim() === "") return null;
  return rate - pay;
}

// Ciclo de faturação PRÓPRIO do contratante (opcional): do dia `s` ao dia `e` do mês, repetido a cada
// `n` meses (1 = todos os meses). Com n > 1 é preciso uma data de início de um ciclo (`anchor`) para
// saber quais são os meses. Sem isto vale o período geral (21→20). Devolve null quando não há ciclo próprio.
export function cycleConfig(c) {
  if (!c) return null;
  const s = Number(c.periodStartDay), e = Number(c.periodEndDay);
  if (!(Number.isInteger(s) && s >= 1 && s <= 31 && Number.isInteger(e) && e >= 1 && e <= 31)) return null;
  const n = Math.max(1, Math.floor(Number(c.periodMonths)) || 1);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(c.periodAnchor || "") ? c.periodAnchor : "";
  if (n > 1 && !anchor) return null;
  return { s, e, n, anchor };
}
