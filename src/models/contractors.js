// Contratantes: quem paga à empresa pelas horas feitas nos clientes.
// Um contratante tem UM valor/hora (o que ele paga) igual para todos os seus
// clientes, e um valor/hora padrão pago ao funcionário que pré-preenche o
// cliente novo (cada cliente pode depois ter o seu, em `valueHour`).
// "Clientes diretos" (`isDirect`): sem valor próprio, o preço é de cada cliente.
// O cliente liga-se ao contratante pelo NOME, em `client.origin`
// (era a antiga "origem" em texto livre).

export const CONTRACTOR_COLORS = ["#143F35", "#2E8A73", "#7FC1AB", "#C8532E", "#5B7DB1", "#B08A2E"];

export const EMPTY_CONTRACTOR = {
  name: "", color: CONTRACTOR_COLORS[0], isDirect: false,
  rate: "", staffRate: "", billingDay: "", paymentDays: "",
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
  const used = (existing || []).length;
  return Array.from(byName.values()).map((g, i) => {
    const direct = isDirectName(g.name);
    const values = g.clients.map((cl) => Number(cl.valueHour)).filter((v) => v > 0);
    return {
      ...EMPTY_CONTRACTOR,
      id: base + i,
      name: g.name,
      color: CONTRACTOR_COLORS[(used + i) % CONTRACTOR_COLORS.length],
      isDirect: direct,
      staffRate: values.length ? mostCommon(values) : "",
    };
  });
}

// Margem por hora de um cliente (o que o contratante paga menos o que o
// funcionário recebe). null quando não dá para calcular (cliente direto sem preço).
export function marginPerHour(contractor, client) {
  const rate = Number(contractor && contractor.rate);
  const pay = Number(client && client.valueHour);
  if (!(rate > 0) || !(pay >= 0) || String(client && client.valueHour).trim() === "") return null;
  return rate - pay;
}
