// Sincronização das restantes fatias de `app_data` entre dispositivos (puro,
// sem React/Supabase) — a irmã de `horasSync.js`.
//
// Antes, cada fatia (pedidos, avisos, períodos fechados, notas, ausências,
// atribuições) era gravada INTEIRA a cada alteração, a partir do que o
// dispositivo tinha lido ao abrir: quem gravava por último apagava o que os
// outros tinham feito entretanto (incluindo um telemóvel que ficou horas
// aberto com a lista antiga). Agora cada dispositivo:
//   1. guarda a última versão que viu do servidor (a "base");
//   2. grava só a DIFERENÇA em relação a essa base (itens novos/alterados e
//      itens apagados), que o servidor aplica de forma atómica;
//   3. vai buscando o que os outros fizeram e junta por baixo das suas
//      alterações ainda por gravar.
//
// Listas: cada item tem um `id`. Mapas (atribuições): cada chave conta como um item.

import { stable } from "./horasSync.js";

function itemId(x) {
  return x && typeof x === "object" && x.id !== undefined && x.id !== null ? String(x.id) : null;
}

// Índice id -> item. Devolve null se algum item não tem id ou há ids repetidos
// (nesse caso não dá para fazer diferenças fiáveis: quem chama grava a lista inteira).
function indexById(list) {
  if (!Array.isArray(list)) return null;
  const map = new Map();
  for (const item of list) {
    const id = itemId(item);
    if (id === null || map.has(id)) return null;
    map.set(id, item);
  }
  return map;
}

// base -> next: o que é preciso enviar ao servidor.
// `upserts` mantém a ordem de `next`. null = não é possível fazer diferenças.
function listDiff(base, next) {
  const b = indexById(base);
  const n = indexById(next);
  if (!b || !n) return null;
  const upserts = [];
  for (const [id, item] of n) {
    if (!b.has(id) || stable(b.get(id)) !== stable(item)) upserts.push(item);
  }
  const removed = [];
  for (const id of b.keys()) if (!n.has(id)) removed.push(id);
  return { upserts, removed };
}

function listIsSame(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (stable(a[i]) !== stable(b[i])) return false;
  return true;
}

// Junta a lista do servidor (`remote`) à local, respeitando o que este
// dispositivo mudou desde a base. Ordem final: a do servidor; itens novos só
// locais ficam à frente (`prepend`, as listas "mais recente primeiro") ou no fim.
// Devolve `local` (mesma referência) se nada mudou. null = não dá para juntar.
function listMerge(local, remote, base, prepend) {
  const l = indexById(local);
  const r = indexById(remote);
  const b = indexById(base);
  if (!l || !r || !b) return null;

  const out = [];
  const localOnly = [];
  for (const [id, rItem] of r) {
    const lItem = l.get(id);
    const bItem = b.get(id);
    if (lItem === undefined) {
      if (bItem === undefined) out.push(rItem); // novo, criado noutro dispositivo
      // senão: apagado aqui e ainda por gravar -> continua apagado
    } else if (bItem !== undefined && stable(lItem) === stable(bItem)) {
      out.push(rItem); // sem alterações locais -> adota o servidor
    } else {
      out.push(lItem); // alterado/criado aqui e ainda por gravar
    }
  }
  for (const [id, lItem] of l) {
    if (r.has(id)) continue;
    const bItem = b.get(id);
    if (bItem === undefined) localOnly.push(lItem); // criado aqui, ainda não gravado
    else if (stable(lItem) !== stable(bItem)) localOnly.push(lItem); // alterado aqui mas apagado lá: a alteração local ganha
    // senão: apagado noutro dispositivo e sem alterações aqui -> desaparece
  }
  const merged = prepend ? [...localOnly, ...out] : [...out, ...localOnly];
  return listIsSame(merged, local) ? local : merged;
}

// ----- mapas (chave -> valor), p.ex. `assignments` -----

function mapDiff(base, next) {
  const b = base || {};
  const n = next || {};
  const upserts = {};
  for (const k of Object.keys(n)) {
    if (!(k in b) || stable(b[k]) !== stable(n[k])) upserts[k] = n[k];
  }
  const removed = Object.keys(b).filter((k) => !(k in n));
  return { upserts, removed };
}

function mapIsSame(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => k in b && stable(a[k]) === stable(b[k]));
}

function mapMerge(local, remote, base) {
  const l = local || {};
  const r = remote || {};
  const b = base || {};
  const out = {};
  for (const k of Object.keys(r)) {
    const inL = k in l;
    const inB = k in b;
    if (!inL) {
      if (!inB) out[k] = r[k]; // nova noutro dispositivo
    } else if (inB && stable(l[k]) === stable(b[k])) {
      out[k] = r[k];
    } else {
      out[k] = l[k];
    }
  }
  for (const k of Object.keys(l)) {
    if (k in r) continue;
    if (!(k in b) || stable(l[k]) !== stable(b[k])) out[k] = l[k];
  }
  return mapIsSame(out, local) ? local : out;
}

function isEmptyDiff(d) {
  if (!d) return false;
  const ups = Array.isArray(d.upserts) ? d.upserts.length : Object.keys(d.upserts || {}).length;
  return ups === 0 && d.removed.length === 0;
}

export { listDiff, listMerge, listIsSame, mapDiff, mapMerge, mapIsSame, isEmptyDiff, itemId };
