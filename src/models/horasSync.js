// Sincronização das horas entre dispositivos (puro, sem React/Supabase).
//
// `app_data.horas_data` é um único JSON com uma chave por funcionário. Antes,
// cada dispositivo carregava tudo ao abrir e gravava o conjunto INTEIRO a cada
// alteração: quem gravava por último apagava o que os outros tinham lançado
// entretanto, e as divisões de horas só viam o que o telemóvel tinha carregado
// ao abrir. Agora cada dispositivo (1) grava só as chaves (funcionários) que
// alterou e (2) vai buscando as dos outros, sem nunca pisar as suas alterações
// ainda por gravar.

// Serialização com chaves ordenadas: o Postgres (jsonb) devolve as chaves por
// outra ordem da que o app usa, e `undefined` não existe em JSON.
function stable(v) {
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

// Chaves de `prev` -> `next` cujo valor mudou (por referência — todo o app
// altera por cópia) e se alguma chave foi removida.
function diffKeys(prev, next) {
  const changed = [];
  Object.keys(next).forEach((k) => { if (next[k] !== prev[k]) changed.push(k); });
  const removed = Object.keys(prev).some((k) => !(k in next));
  return { changed, removed };
}

// Junta o que veio do servidor ao estado local. Só adota a versão do servidor
// de um funcionário se este dispositivo NÃO tem alterações por gravar nele
// (`dirty`) e o conteúdo for diferente. Devolve o próprio `local` (mesma
// referência) quando nada mudou, para não provocar render nem gravação.
function mergeRemote(local, remote, dirty) {
  let next = local;
  Object.keys(remote || {}).forEach((k) => {
    if (dirty.has(k)) return;
    if (stable(local[k]) === stable(remote[k])) return;
    if (next === local) next = { ...local };
    next[k] = remote[k];
  });
  return next;
}

// Só as chaves indicadas, para enviar como "patch" (o servidor junta por cima).
function buildPatch(horas, keys) {
  const patch = {};
  keys.forEach((k) => { if (k in horas) patch[k] = horas[k]; });
  return patch;
}

// Erro de "função não existe" do PostgREST/Postgres (SQL ainda por correr).
function isMissingRpc(error) {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message || "");
}

export { stable, diffKeys, mergeRemote, buildPatch, isMissingRpc };
