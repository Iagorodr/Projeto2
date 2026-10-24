// Quando a gerência preenche as horas de um funcionário (Monitoramento → Preencher horas), o que ela
// cria fica marcado "pela gerência": linhas novas (`byManagement`), semanas trancadas (`lockedBy`) e
// o mês finalizado (`finalizedBy`). O funcionário pode reabrir a semana normalmente (decisão do Iago);
// ao reabrir, a marca da semana sai (ver `reopenWeek`). Puro: recebe o novo e o antigo `horasData`.
const keyOf = (e) => `${e.date}|${e.clientId ?? (e.custom && e.custom.name) ?? ""}|${e.replacesDate || ""}`;

export function tagManagerChanges(next, prev, staffId) {
  const n = next && next[staffId];
  if (!n) return next;
  const p = (prev && prev[staffId]) || {};
  const had = new Set((p.entries || []).map(keyOf));
  const entries = (n.entries || []).map((e) => (had.has(keyOf(e)) || e.byManagement ? e : { ...e, byManagement: true }));
  const lockedBy = { ...(n.lockedBy || {}) };
  Object.keys(n.lockedWeeks || {}).forEach((k) => { if (n.lockedWeeks[k] && !(p.lockedWeeks || {})[k]) lockedBy[k] = "gerencia"; });
  Object.keys(lockedBy).forEach((k) => { if (!(n.lockedWeeks || {})[k]) delete lockedBy[k]; });
  const out = { ...n, entries };
  if (Object.keys(lockedBy).length) out.lockedBy = lockedBy; else delete out.lockedBy;
  if (n.status === "finalizado" && p.status !== "finalizado") out.finalizedBy = "gerencia";
  if (n.status !== "finalizado") delete out.finalizedBy;
  return { ...next, [staffId]: out };
}
