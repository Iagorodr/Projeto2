// Camada "Controller": guarda todo o estado da aplicação e as ações que o
// alteram. As Views (App.jsx e as telas) só leem o que este hook devolve —
// não têm useState próprio para os dados do negócio.
//
// Persistência: se o Supabase estiver configurado (ver models/supabaseClient.js),
// o estado é carregado de lá ao abrir e cada alteração é gravada de volta. Sem
// configuração, o app funciona exatamente como antes, só em memória, usando os
// dados de demonstração de models/data.js / models/seedHistory.js.
import { useState, useEffect, useRef, useCallback } from "react";
import {
  INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_HORAS,
  INITIAL_MISSING, INITIAL_SENT,
} from "../models/data.js";
import { TODAY } from "../models/data.js";
import { activeClientsCount, isStaffActive } from "../models/utils.js";
import { diffKeys, mergeRemote, buildPatch, isMissingRpc } from "../models/horasSync.js";
import { listDiff, listMerge, mapDiff, mapMerge, isEmptyDiff } from "../models/appDataSync.js";
import { INITIAL_CLOSED_PERIODS } from "../models/seedHistory.js";
import { supabase, isSupabaseConfigured } from "../models/supabaseClient.js";
import {
  toDbClient, fromDbClient, toDbStaff, fromDbStaff,
  toDbCompanySettings, fromDbCompanySettings,
} from "../models/dbMappers.js";
import {
  consumeUrlCompanyCode, getStoredCompanyCode, storeCompanyCode, clearStoredCompanyCode,
  lookupCompany, fetchCompanyStatus, isBlockedState, companyNotice,
  normalizeCompanyCode, isValidCompanyCode, isManagerRole, sessionRole,
  markActive, idleExceeded, clearActivity, setFlash, takeFlash, forceLocalSignOut,
} from "../models/companyContext.js";

// Com o Supabase ligado, cada empresa começa SEM os dados de demonstração
// embutidos no código (várias empresas no mesmo banco: nada de uma pode
// aparecer, nem ser gravado, noutra). Sem Supabase (modo demonstração) ou com
// VITE_START_EMPTY=true, o comportamento é o de sempre.
const START_EMPTY = isSupabaseConfigured || import.meta.env.VITE_START_EMPTY === "true";

// Feito uma única vez, ao carregar a página: um link com `?e=codigo` guarda o
// código da empresa; e a mensagem deixada pela saída anterior (inatividade,
// assinatura vencida…) é lida aqui e apagada.
const URL_COMPANY_CODE = isSupabaseConfigured ? consumeUrlCompanyCode() : null;
const FLASH = isSupabaseConfigured ? takeFlash() : null;
const FLASH_AUTH_ERROR = { idle: "idle_logout", inactive: "inactive_account", no_account: "no_account", generic: "generic" };
const BLOCK_FROM_STATUS = (st) => ({ type: "blocked", state: st.state, name: st.name || "", validUntil: st.validUntil || null, code: st.code || "" });

function dayKeyOf(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
// O dia em que esta app foi carregada (ver `reloadIfNewDay`).
const DAY_AT_LOAD = dayKeyOf(TODAY);

// `isStaffActive` compara a validade com um dia à meia-noite local (a validade é
// inclusiva); por isso nunca lhe passamos `new Date()` com horas.
function startOfLocalToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function useAppController() {
  const [perspective, setPerspective] = useState("login"); // 'login' | 'management' | 'employee'
  const [screen, setScreenRaw] = useState("dashboard");
  // Intenção de navegação (ex.: clicar no KPI "Replacement" abre Clientes já filtrado).
  const [navIntent, setNavIntent] = useState(null);
  // null | "temporary" (palavra-passe gerada pela gerência) | "recovery" (link do email): obriga a escolher palavra-passe nova antes de usar o app.
  const [passwordGate, setPasswordGate] = useState(null);
  const setScreen = (s) => { setNavIntent(null); setScreenRaw(s); };
  const goTo = (s, intent = null) => { setNavIntent(intent); setScreenRaw(s); };
  const [empScreen, setEmpScreen] = useState("menu");
  // Cliente a abrir já aberto em Clientes (vindo da Agenda do funcionário): { clientId } | null.
  const [empClientFocus, setEmpClientFocus] = useState(null);
  const openEmpClient = (clientId) => { setEmpClientFocus({ clientId }); setEmpScreen("clientes"); };
  const [loggedInStaffId, setLoggedInStaffId] = useState(null);
  const [lang, setLang] = useState("pt");

  const [company, setCompany] = useState({ name: "Empresa X", email: "empresax@login1.gmail.com", password: "", photoUrl: null });
  const [cutoffDay, setCutoffDay] = useState(20);
  const [contractAlertDays, setContractAlertDays] = useState(30);
  const [closeDeadlineDays, setCloseDeadlineDays] = useState(7);
  const [highlightsMonths, setHighlightsMonths] = useState(3);
  const [highlightsRealtime, setHighlightsRealtime] = useState(false);
  const [reclamacaoBaseClients, setReclamacaoBaseClients] = useState(10);
  const [reclamacaoExcelenteCount, setReclamacaoExcelenteCount] = useState(1);
  const [reclamacaoRazoavelCount, setReclamacaoRazoavelCount] = useState(3);

  const [clients, setClients] = useState(START_EMPTY ? [] : INITIAL_CLIENTS);
  const [staff, setStaff] = useState(START_EMPTY ? [] : INITIAL_STAFF);
  const [assignments, setAssignments] = useState(START_EMPTY ? {} : INITIAL_ASSIGNMENTS);
  const [horasData, setHorasDataState] = useState(START_EMPTY ? {} : INITIAL_HORAS);
  // Horas: ver models/horasSync.js. `horasRef` é sempre o valor mais recente
  // (síncrono); `dirtyRef` são os funcionários com alterações ainda por gravar
  // — só esses são enviados ao servidor, e só os que NÃO estão aí são
  // substituídos pelo que vem dos outros dispositivos.
  const horasRef = useRef(horasData);
  const dirtyRef = useRef(new Set());
  const fullWriteRef = useRef(false);   // chave removida (apagar funcionário/formatar): grava o conjunto todo
  const rpcMissingRef = useRef(false);  // `patch_horas_data` ainda não existe neste projeto Supabase
  const pushingRef = useRef(false);
  const pushAgainRef = useRef(false);
  const pushEpochRef = useRef(0);
  const refreshingRef = useRef(false);
  // Restantes fatias de app_data (ver `SLICES` mais abaixo).
  const sliceValRef = useRef({});          // valor atual de cada fatia (atualizado a cada render)
  const sliceBaseRef = useRef({});         // última versão vista do servidor (undefined = ainda não lida)
  const slicePushingRef = useRef({});
  const slicePushAgainRef = useRef({});
  const rpcMissingSliceRef = useRef({});   // RPC ainda inexistente neste projeto Supabase
  const setHorasData = useCallback((updater) => {
    const prev = horasRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next === prev) return;
    const { changed, removed } = diffKeys(prev, next);
    changed.forEach((k) => dirtyRef.current.add(k));
    if (removed) fullWriteRef.current = true;
    horasRef.current = next;
    setHorasDataState(next);
  }, []);
  const [closedPeriods, setClosedPeriods] = useState(START_EMPTY ? [] : INITIAL_CLOSED_PERIODS);
  const [missingItems, setMissingItems] = useState(START_EMPTY ? [] : INITIAL_MISSING);
  const [sentItems, setSentItems] = useState(START_EMPTY ? [] : INITIAL_SENT);
  const [personalNotes, setPersonalNotes] = useState([]);
  // Avisos de falta: { id, staffId, date:"YYYY-MM-DD", note, createdAt, handled }
  const [absences, setAbsences] = useState([]);
  // Coberturas de férias (só a gerência grava): { id, clientId, fromStaffId,
  // toStaffId, from:"YYYY-MM-DD", to:"YYYY-MM-DD", createdAt } — ver utils.js
  // (`agendaClientIdsOn`). A agenda semanal não é alterada: a volta é automática.
  const [covers, setCovers] = useState([]);

  const [hydrated, setHydrated] = useState(!isSupabaseConfigured);
  // QA pós-auditoria (Lote 1, "Gravar só depois de ler"): só true quando
  // `loadAllData` terminou SEM erro de leitura. Enquanto isto for false,
  // os efeitos de gravação abaixo não rodam — antes, `hydrated` virava
  // true no `finally` do `init()` mesmo com erro de leitura (ou sessão sem
  // leitura nenhuma), e cada fatia do estado era regravada por cima com os
  // dados de demonstração que ainda estavam em memória.
  const [readOk, setReadOk] = useState(!isSupabaseConfigured);
  // QA pós-auditoria (Lote 1, item 2 — aviso de leitura falhada): true
  // quando a ÚLTIMA tentativa de `loadAllData()` terminou com `ok = false`.
  // Zerado no início de cada tentativa nova (`loadAllData`/`logout`) pra
  // nunca mostrar um aviso de uma tentativa antiga já superada.
  const [loadError, setLoadError] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(FLASH ? (FLASH_AUTH_ERROR[FLASH.type] || null) : null);

  // Várias empresas: código escolhido neste aparelho, estado da assinatura da
  // empresa de quem está dentro, e (se a assinatura acabou) o ecrã de bloqueio.
  const [companyCode, setCompanyCode] = useState(() => (isSupabaseConfigured ? (URL_COMPANY_CODE || getStoredCompanyCode()) : null));
  const [companyStatus, setCompanyStatus] = useState(null);
  const [companyBlock, setCompanyBlock] = useState(FLASH && FLASH.type === "blocked" ? FLASH : null);
  // Id desta empresa nas tabelas company_settings/app_data (vem de my_company_status;
  // 1 enquanto o banco ainda não tem o SQL de várias empresas).
  const companyIdRef = useRef(1);
  const statusCheckRef = useRef(false);
  // Banco que ainda não tem o SQL de várias empresas (uma só empresa, como antes):
  // não há código a pedir. Sem código guardado, uma consulta de teste descobre-o
  // antes de decidir o primeiro ecrã (`companyGateReady`).
  const [legacyDb, setLegacyDb] = useState(false);
  const [companyGateReady, setCompanyGateReady] = useState(() => !isSupabaseConfigured || Boolean(URL_COMPANY_CODE || getStoredCompanyCode()));
  useEffect(() => {
    if (!isSupabaseConfigured || companyGateReady) return;
    let cancelled = false;
    lookupCompany(supabase, "servix-probe").then((r) => {
      if (cancelled) return;
      if (r.kind === "ok" && r.legacy) setLegacyDb(true);
      setCompanyGateReady(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loggedInStaffIdRef = useRef(null);
  loggedInStaffIdRef.current = loggedInStaffId;
  const activeCheckRef = useRef(false);
  const reloadingRef = useRef(false);
  const hasHorasLoadedRef = useRef(false);
  // Carga inicial: o servidor manda (substitui, como antes, os dados de
  // demonstração em memória), mas o que este dispositivo já alterou e ainda
  // não gravou fica.
  function replaceHorasFromServer(remote) {
    const next = { ...remote };
    dirtyRef.current.forEach((k) => { if (k in horasRef.current) next[k] = horasRef.current[k]; });
    horasRef.current = next;
    setHorasDataState(next);
  }
  // Atualização periódica: adota só o que mudou e não está "por gravar".
  function adoptRemoteHoras(remote) {
    const merged = mergeRemote(horasRef.current, remote, dirtyRef.current);
    if (merged === horasRef.current) return;
    horasRef.current = merged;
    setHorasDataState(merged);
  }
  // Grava só os funcionários alterados (RPC `patch_horas_data`); se a função
  // ainda não existir no projeto, cai no modo antigo (conjunto inteiro).
  async function flushHoras() {
    if (!isSupabaseConfigured) return;
    if (pushingRef.current) { pushAgainRef.current = true; return; }
    const dirty = [...dirtyRef.current];
    if (dirty.length === 0 && !fullWriteRef.current) return;
    pushingRef.current = true;
    pushAgainRef.current = false;
    const snapshot = horasRef.current;
    const wasFull = fullWriteRef.current;
    let ok = false;
    try {
      if (!wasFull && !rpcMissingRef.current) {
        const { error } = await supabase.rpc("patch_horas_data", { patch: buildPatch(snapshot, dirty) });
        if (!error) ok = true;
        else if (isMissingRpc(error)) rpcMissingRef.current = true;
        else console.error("Erro ao gravar horas:", error);
      }
      if (!ok && (wasFull || rpcMissingRef.current)) {
        const { error } = await supabase.from("app_data").update({ horas_data: snapshot }).eq("id", companyIdRef.current);
        if (error) console.error("Erro ao gravar horas:", error);
        else ok = true;
      }
      if (ok) {
        pushEpochRef.current += 1;
        dirty.forEach((k) => { if (horasRef.current[k] === snapshot[k]) dirtyRef.current.delete(k); });
        if (wasFull && horasRef.current === snapshot) fullWriteRef.current = false;
      }
    } catch (err) {
      console.error("Erro ao gravar horas:", err);
    } finally {
      pushingRef.current = false;
      if (ok && (pushAgainRef.current || dirtyRef.current.size > 0)) flushHoras();
    }
  }
  // ---- Restantes fatias de app_data (ver models/appDataSync.js) ----
  // `sliceBaseRef[col]` é a última versão que este dispositivo viu do servidor;
  // só a diferença entre ela e o estado atual é enviada (RPC atómica), e o que
  // os outros fizeram é juntado por baixo das alterações ainda por gravar.
  const SLICES = {
    assignments:    { kind: "map" },
    missing_items:  { kind: "list", prepend: true },
    sent_items:     { kind: "list", prepend: true },
    closed_periods: { kind: "list", prepend: true },
    personal_notes: { kind: "list", prepend: false },
    absences:       { kind: "list", prepend: false },
    covers:         { kind: "list", prepend: false },
  };
  const SLICE_COLS = Object.keys(SLICES);
  const sliceSetters = {
    assignments: setAssignments, missing_items: setMissingItems, sent_items: setSentItems,
    closed_periods: setClosedPeriods, personal_notes: setPersonalNotes, absences: setAbsences, covers: setCovers,
  };
  sliceValRef.current = {
    assignments, missing_items: missingItems, sent_items: sentItems,
    closed_periods: closedPeriods, personal_notes: personalNotes, absences, covers,
  };

  function emptySlice(col) { return SLICES[col].kind === "map" ? {} : []; }
  function sliceIsEmpty(col, v) { return SLICES[col].kind === "map" ? Object.keys(v || {}).length === 0 : (v || []).length === 0; }
  function remoteSliceUsable(col, v) {
    if (v == null) return false;
    return SLICES[col].kind === "map" ? (typeof v === "object" && !Array.isArray(v)) : (Array.isArray(v) && listDiff(v, v) !== null);
  }

  // Junta o que veio do servidor ao estado local desta fatia.
  function mergeSlice(col, remote) {
    const cfg = SLICES[col];
    const baseSnap = sliceBaseRef.current[col];
    if (baseSnap === undefined || !remoteSliceUsable(col, remote)) return;
    sliceBaseRef.current[col] = remote;
    // Forma funcional: junta contra o estado MAIS RECENTE (incluindo alterações
    // que o React ainda não renderizou), nunca contra uma cópia antiga.
    sliceSetters[col]((cur) => {
      const merged = cfg.kind === "map" ? mapMerge(cur, remote, baseSnap) : listMerge(cur, remote, baseSnap, cfg.prepend);
      return merged === null ? cur : merged;
    });
  }

  // Carga (inicial ou repetida) de uma fatia lida do servidor.
  function absorbSlice(col, remote) {
    const value = remote == null ? emptySlice(col) : remote;
    if (sliceBaseRef.current[col] === undefined) {
      sliceBaseRef.current[col] = value;
      if (!sliceIsEmpty(col, value)) sliceSetters[col](value);
    } else {
      mergeSlice(col, value);
    }
  }

  // Grava a diferença de uma fatia (ou, se a função ainda não existir no
  // projeto / a lista não tem ids, a fatia inteira como antes).
  async function flushSlice(col) {
    if (!isSupabaseConfigured) return;
    const cfg = SLICES[col];
    const base = sliceBaseRef.current[col];
    if (base === undefined) return; // ainda não lida
    if (slicePushingRef.current[col]) { slicePushAgainRef.current[col] = true; return; }
    const snapshot = sliceValRef.current[col];
    if (snapshot === base) return;
    const d = cfg.kind === "map" ? mapDiff(base, snapshot) : listDiff(base, snapshot);
    if (d && isEmptyDiff(d)) { sliceBaseRef.current[col] = snapshot; return; }
    const rpcName = cfg.kind === "map" ? "patch_assignments" : "patch_app_list";
    slicePushingRef.current[col] = true;
    slicePushAgainRef.current[col] = false;
    let ok = false;
    try {
      if (d && !rpcMissingSliceRef.current[rpcName]) {
        const args = cfg.kind === "map"
          ? { upserts: d.upserts, removed: d.removed }
          : { slice: col, upserts: d.upserts, removed: d.removed, prepend: cfg.prepend };
        const { error } = await supabase.rpc(rpcName, args);
        if (!error) ok = true;
        else if (isMissingRpc(error)) rpcMissingSliceRef.current[rpcName] = true;
        else console.error(`Erro ao gravar ${col}:`, error);
      }
      if (!ok && (!d || rpcMissingSliceRef.current[rpcName])) {
        const { error } = await supabase.from("app_data").update({ [col]: snapshot }).eq("id", companyIdRef.current);
        if (error) console.error(`Erro ao gravar ${col}:`, error);
        else ok = true;
      }
      if (ok) {
        pushEpochRef.current += 1;
        sliceBaseRef.current[col] = snapshot;
      }
    } catch (err) {
      console.error(`Erro ao gravar ${col}:`, err);
    } finally {
      slicePushingRef.current[col] = false;
      if (ok && (slicePushAgainRef.current[col] || sliceValRef.current[col] !== sliceBaseRef.current[col])) flushSlice(col);
    }
  }
  function anySlicePushing() { return SLICE_COLS.some((c) => slicePushingRef.current[c]); }

  // Há alterações deste dispositivo ainda por gravar?
  function hasUnsavedWrites() {
    if (dirtyRef.current.size > 0 || fullWriteRef.current || pushingRef.current || anySlicePushing()) return true;
    return SLICE_COLS.some((c) => {
      const base = sliceBaseRef.current[c];
      const cur = sliceValRef.current[c];
      if (base === undefined || cur === base) return false;
      const d = SLICES[c].kind === "map" ? mapDiff(base, cur) : listDiff(base, cur);
      return d === null || !isEmptyDiff(d);
    });
  }

  // "Hoje" é calculado uma vez, quando a app abre. Se ficou aberta (ou em
  // segundo plano) de um dia para o outro, o dia que o ecrã mostra e as regras
  // que dependem dele (semanas fechadas, horas de hoje, atrasos) ficariam no dia
  // anterior. Quando o dia vira, grava o que falta e recarrega a app uma vez.
  // Nunca recarrega sem rede, com alterações por gravar, nem a meio de uma escrita.
  async function reloadIfNewDay() {
    if (typeof window === "undefined" || dayKeyOf(new Date()) === DAY_AT_LOAD) return;
    if (navigator.onLine === false || reloadingRef.current) return;
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.value) return; // a escrever: espera
    reloadingRef.current = true;
    try {
      for (let i = 0; i < 15; i += 1) {
        await Promise.all([flushHoras(), ...SLICE_COLS.map((c) => flushSlice(c))]);
        if (!hasUnsavedWrites()) { window.location.reload(); return; }
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      reloadingRef.current = false;
    }
  }

  // Vai buscar o que os outros dispositivos fizeram (primeiro envia o próprio).
  // `closed_periods` é pesado e quase nunca muda: só vem em refrescos "completos".
  async function refreshHoras(full = false) {
    if (!isSupabaseConfigured || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await Promise.all([flushHoras(), ...SLICE_COLS.map((c) => flushSlice(c))]);
      const epoch = pushEpochRef.current;
      const cols = ["horas_data", ...SLICE_COLS.filter((c) => full || c !== "closed_periods")];
      const { data, error } = await supabase.from("app_data").select(cols.join(",")).eq("id", companyIdRef.current).maybeSingle();
      if (error || !data) return;
      // Se entretanto gravámos algo (ou há gravação a meio), esta leitura pode
      // ser anterior a essa gravação: deita fora, a próxima volta corrige.
      if (pushingRef.current || anySlicePushing() || pushEpochRef.current !== epoch) return;
      if (data.horas_data) adoptRemoteHoras(data.horas_data);
      SLICE_COLS.forEach((c) => { if (c in data) mergeSlice(c, data[c]); });
    } finally {
      refreshingRef.current = false;
    }
  }

  // Quem já está dentro (telemóvel com a app aberta) e é desativado pela gerência,
  // ou cuja validade acaba, é desligado na próxima verificação. Só age perante
  // uma resposta clara do banco; um erro de rede nunca termina a sessão.
  async function checkStillActive() {
    const myId = loggedInStaffIdRef.current;
    if (!isSupabaseConfigured || myId == null || activeCheckRef.current) return;
    activeCheckRef.current = true;
    try {
      const { data, error } = await supabase.from("staff").select("id,status,account_type,valid_until").eq("id", myId).maybeSingle();
      if (error || !data) return;
      const me = fromDbStaff(data);
      if (isStaffActive(me, startOfLocalToday())) return;
      await doLogout({ type: "inactive" });
    } finally {
      activeCheckRef.current = false;
    }
  }

  // QA pós-auditoria: devolve `ok` (false se qualquer uma das 4 leituras
  // falhou, incluindo exceção) além de `companyEmail`/`staffList` — antes
  // só fazia `console.error`, sem contar isso a quem chamou, então
  // `hydrated`/as gravações não tinham como saber que a leitura falhou.
  // Falhas intermitentes (rede móvel instável) eram mostradas logo como erro:
  // agora tenta até 3 vezes (pausa crescente) antes de avisar, e volta a
  // tentar sozinho quando a internet volta ou a app volta ao primeiro plano.
  async function loadAllData() {
    setReadOk(false);
    setLoadError(false);
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await loadAllDataOnce();
      if (result.ok) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!result.ok) setLoadError(true);
    return result;
  }

  async function loadAllDataOnce() {
    let companyEmail = company.email;
    let staffList = staff;
    let ok = true;
    try {
      const [clientsRes, staffRes, settingsRes, appDataRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("staff").select("*"),
        supabase.from("company_settings").select("*").eq("id", companyIdRef.current).maybeSingle(),
        supabase.from("app_data").select("*").eq("id", companyIdRef.current).maybeSingle(),
      ]);

      if (clientsRes.error) { console.error("Erro ao carregar clientes:", clientsRes.error); ok = false; }
      else if (clientsRes.data && (START_EMPTY || clientsRes.data.length > 0)) setClients(clientsRes.data.map(fromDbClient));

      if (staffRes.error) { console.error("Erro ao carregar funcionários:", staffRes.error); ok = false; }
      else if (staffRes.data && (START_EMPTY || staffRes.data.length > 0)) {
        staffList = staffRes.data.map(fromDbStaff);
        setStaff(staffList);
      }

      if (settingsRes.error) { console.error("Erro ao carregar definições:", settingsRes.error); ok = false; }
      else if (settingsRes.data) {
        const mapped = fromDbCompanySettings(settingsRes.data);
        companyEmail = mapped.company.email;
        setCompany(mapped.company);
        setCutoffDay(mapped.cutoffDay);
        setContractAlertDays(mapped.contractAlertDays);
        setCloseDeadlineDays(mapped.closeDeadlineDays);
        setHighlightsMonths(mapped.highlightsMonths);
        setHighlightsRealtime(mapped.highlightsRealtime);
        setReclamacaoBaseClients(mapped.reclamacaoBaseClients);
        setReclamacaoExcelenteCount(mapped.reclamacaoExcelenteCount);
        setReclamacaoRazoavelCount(mapped.reclamacaoRazoavelCount);
      }

      if (appDataRes.error) { console.error("Erro ao carregar dados do app:", appDataRes.error); ok = false; }
      else if (!appDataRes.data) {
        // Banco novo sem a linha de app_data desta empresa: sem ela, todas as gravações
        // (`update ... eq("id", <empresa>)`) ficam a "gravar" zero linhas em silêncio —
        // agenda, horas e avisos perdiam-se ao recarregar. Cria-a (valores por
        // omissão vazios do schema).
        const { error: insErr } = await supabase.from("app_data").insert({ id: companyIdRef.current });
        if (insErr) { console.error("Erro ao criar linha de dados do app:", insErr); ok = false; }
        else SLICE_COLS.forEach((c) => absorbSlice(c, null)); // linha nova e vazia: o que está em memória é gravado a seguir
      }
      else if (appDataRes.data) {
        const row = appDataRes.data;
        SLICE_COLS.forEach((c) => absorbSlice(c, row[c]));
        if (row.horas_data && Object.keys(row.horas_data).length > 0) replaceHorasFromServer(row.horas_data);
        else if (!hasHorasLoadedRef.current) Object.keys(horasRef.current).forEach((k) => dirtyRef.current.add(k)); // banco novo: grava o que está em memória (como antes)
        hasHorasLoadedRef.current = true;
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Supabase:", err);
      ok = false;
    }
    return { companyEmail, staffList, ok };
  }

  async function resolveSessionAndRoute(sessionEmail, companyEmail, staffList) {
    const email = (sessionEmail || "").toLowerCase();
    if (companyEmail && email === companyEmail.toLowerCase()) {
      enterManagement();
      return true;
    }
    const matchedStaff = staffList.find((s) => (s.email || "").toLowerCase() === email);
    if (matchedStaff) {
      // Conta inativa, ou Replacement com a validade já passada: não entra.
      // (A conta de login existe no Auth, mas a gerência já a desativou.)
      if (!isStaffActive(matchedStaff, startOfLocalToday())) return "inactive";
      // Um segundo (ou terceiro...) login de gerência é só um "funcionário"
      // com role "gerencia" — mesma tabela/tela de Acessos, mas cai direto
      // na perspectiva de gerência completa, igual ao login principal.
      // Lote 4, 4.3 (achado da Marta — "bloco de usuário com nome e papel
      // de quem entrou, não 'Empresa'"): sem isto `loggedInStaffId` ficava
      // null em qualquer login de gerência (igual ao login da conta-mãe da
      // empresa), e o `AppSidebar` não tinha como saber o nome de quem
      // entrou — só dava pra mostrar o nome da empresa. Guardando o id
      // aqui, `me` (perto do fim deste ficheiro) resolve para o próprio
      // funcionário de gerência, igual já acontece do lado funcionário/
      // supervisor.
      if (matchedStaff.role === "gerencia") {
        setLoggedInStaffId(matchedStaff.id);
        enterManagement();
      } else {
        enterEmployee(matchedStaff.id);
      }
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          // Primeiro a empresa: assinatura em dia? (quem já tinha sessão não passa
          // pelo ecrã do código; o código fica guardado a partir daqui.)
          const gate = await admitToCompany(null);
          if (cancelled) return;
          if (!gate.ok) {
            await endSessionLocally();
            if (gate.reason === "blocked") setCompanyBlock(BLOCK_FROM_STATUS(gate.status));
            else setAuthError(gate.reason === "no_account" ? "no_account" : "generic");
            return;
          }
          const { companyEmail, staffList, ok } = await loadAllData();
          if (cancelled) return;
          if (ok) setReadOk(true);
          // A gerência que ficou mais de IDLE_MINUTES sem usar o app volta a escrever a palavra-passe.
          if (ok && isManagerRole(sessionRole(session.user.email, companyEmail, staffList)) && idleExceeded()) {
            await doLogout({ type: "idle" });
            return;
          }
          const routed = await resolveSessionAndRoute(session.user.email, companyEmail, staffList);
          if (routed === "inactive") {
            await doLogout({ type: "inactive" });
            return;
          } else if (routed && session.user.user_metadata?.must_change_password) setPasswordGate("temporary");
          if (!routed) {
            console.error("Sessão sem correspondência em funcionários/empresa — a terminar sessão.");
            await doLogout({ type: ok ? "no_account" : "generic" });
            return;
          }
          markActive();
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !loadError) return;
    let busy = false;
    async function retry() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const { ok } = await loadAllData();
        if (ok) setReadOk(true);
      } finally { busy = false; }
    }
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadError]);

  async function loginWithPassword(email, password) {
    setAuthError(null);
    setAuthLoading(true);
    try {
      let { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // Colar a palavra-passe no telemóvel costuma trazer um espaço no fim: tenta de novo sem espaços nas pontas.
      if (error && password !== password.trim()) {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password: password.trim() }));
      }
      if (error) {
        setAuthError(error.message === "Invalid login credentials" ? "invalid_credentials" : "generic");
        return;
      }
      markActive(); // começa a contar a inatividade daqui (não do último uso, de ontem)
      // A conta tem de ser da empresa escolhida no ecrã do código, e a assinatura estar em dia.
      const gate = await admitToCompany(companyCode);
      if (!gate.ok) {
        await endSessionLocally();
        if (gate.reason === "blocked") setCompanyBlock(BLOCK_FROM_STATUS(gate.status));
        else setAuthError(gate.reason === "wrong_company" ? "wrong_company" : gate.reason === "no_account" ? "no_account" : "generic");
        return;
      }
      const { companyEmail, staffList, ok } = await loadAllData();
      if (ok) setReadOk(true);
      const routed = await resolveSessionAndRoute(data.user.email, companyEmail, staffList);
      if (routed === "inactive") {
        await doLogout({ type: "inactive" });
        return;
      } else if (routed && data.user.user_metadata?.must_change_password) setPasswordGate("temporary");
      if (!routed) {
        await doLogout({ type: ok ? "no_account" : "generic" });
        return;
      }
    } finally {
      setAuthLoading(false);
    }
  }

  // "Esqueci a palavra-passe": envia o link por email (resposta sempre neutra, para não revelar que emails existem).
  async function requestPasswordReset(email) {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return !error;
  }

  async function setNewPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
    if (error) return false;
    setPasswordGate(null);
    return true;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPasswordGate("recovery");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sai e RECARREGA a página: com várias empresas no mesmo banco, nada da
  // empresa anterior pode ficar na memória (nem ser gravado na seguinte).
  // `flash` = razão a mostrar no ecrã seguinte (inatividade, assinatura
  // vencida…); com razão, só termina a sessão deste aparelho.
  async function doLogout(flash) {
    setPasswordGate(null);
    if (isSupabaseConfigured) {
      await flushAllBestEffort();
      await endSessionLocally(flash ? "local" : "global");
      if (flash) setFlash(flash);
      window.location.reload();
      return;
    }
    setLoggedInStaffId(null);
    setAuthError(null);
    setPerspective("login");
    setReadOk(false);
    setLoadError(false);
    sliceBaseRef.current = {}; // o próximo início de sessão volta a ler tudo do servidor
  }
  // (sem argumentos: serve de `onClick` direto, que recebe o evento)
  function logout() { return doLogout(null); }

  // Termina a sessão; se o pedido ao servidor falhar (sem rede) apaga-a à força do aparelho.
  async function endSessionLocally(scope = "local") {
    clearActivity();
    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error) forceLocalSignOut();
    } catch { forceLocalSignOut(); }
  }

  // Antes de sair, grava o que ainda estiver por gravar (no máximo ~2,5 s).
  async function flushAllBestEffort() {
    try {
      await Promise.race([
        Promise.all([flushHoras(), ...SLICE_COLS.map((c) => flushSlice(c))]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch { /* sair não pode falhar por causa disto */ }
  }

  // Confirma a empresa e a assinatura de quem acabou de entrar (antes de ler
  // qualquer dado). `expectCode`: o código escolhido no ecrã do código — a conta
  // tem de ser dessa empresa. Devolve { ok:true } ou { ok:false, reason, status }.
  async function admitToCompany(expectCode) {
    let res = { kind: "error" };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      res = await fetchCompanyStatus(supabase);
      if (res.kind !== "error") break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (res.kind === "legacy") { // banco ainda sem o SQL de várias empresas: uma só empresa, como antes
      companyIdRef.current = 1;
      setCompanyStatus(null);
      return { ok: true };
    }
    if (res.kind === "error") return { ok: false, reason: "generic" };
    const st = res.status;
    if (st.state === "none") return { ok: false, reason: "no_account" };
    if (expectCode && String(st.code || "").toLowerCase() !== expectCode) return { ok: false, reason: "wrong_company", status: st };
    if (isBlockedState(st.state)) return { ok: false, reason: "blocked", status: st };
    companyIdRef.current = st.companyId;
    setCompanyStatus(st);
    if (st.code) { storeCompanyCode(st.code); setCompanyCode(st.code); }
    return { ok: true, status: st };
  }

  // Com a app aberta: a assinatura pode vencer (ou ser suspensa) a qualquer momento.
  async function refreshCompanyStatus() {
    if (!isSupabaseConfigured || statusCheckRef.current) return;
    statusCheckRef.current = true;
    try {
      const res = await fetchCompanyStatus(supabase);
      if (res.kind !== "status") return;
      const st = res.status;
      if (isBlockedState(st.state)) { await doLogout(BLOCK_FROM_STATUS(st)); return; }
      if (st.state !== "none") setCompanyStatus(st);
    } finally {
      statusCheckRef.current = false;
    }
  }

  // Ecrã do código da empresa. Devolve "ok" | "invalid" | "not_found" | "error".
  async function submitCompanyCode(raw) {
    const code = normalizeCompanyCode(raw);
    if (!isValidCompanyCode(code)) return "invalid";
    const res = await lookupCompany(supabase, code);
    if (res.kind === "error") return "error";
    if (!res.found) return "not_found";
    storeCompanyCode(code);
    setCompanyCode(code);
    setAuthError(null);
    return "ok";
  }
  function changeCompany() {
    clearStoredCompanyCode();
    setCompanyCode(null);
    setAuthError(null);
  }
  function dismissCompanyBlock() { setCompanyBlock(null); setAuthError(null); }

  // QA pós-auditoria ("Gravar só depois de ler"): `clients`, `staff` e
  // `company_settings` só são gravados na sessão de GERÊNCIA — nenhuma
  // tela de supervisor ou funcionário tem setter para estes três (só
  // `AcessosScreen`/`FuncionariosScreen`/`ClientesScreen`/
  // `DefinicoesScreen`, todas de gerência, chamam `setStaff`/`setClients`/
  // `setCompany`/etc. — conferido em toda a árvore de `views/`). Antes,
  // mesmo uma sessão de supervisor/funcionário regravava `staff` a cada
  // render (o mesmo array que acabou de ler, sem mudança nenhuma), e era
  // esse upsert redundante que o gatilho do banco recusava com P0001.
  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk || perspective !== "management") return;
    supabase.from("clients").upsert(clients.map(toDbClient)).then(({ error }) => {
      if (error) console.error("Erro ao gravar clientes:", error);
    });
  }, [hydrated, readOk, perspective, clients]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk || perspective !== "management") return;
    supabase.from("staff").upsert(staff.map(toDbStaff)).then(({ error }) => {
      if (error) console.error("Erro ao gravar funcionários:", error);
    });
  }, [hydrated, readOk, perspective, staff]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk || perspective !== "management") return;
    const payload = toDbCompanySettings({
      company, cutoffDay, contractAlertDays, closeDeadlineDays, highlightsMonths, highlightsRealtime,
      reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount,
    });
    supabase.from("company_settings").update(payload).eq("id", companyIdRef.current).then(({ error }) => {
      if (error) console.error("Erro ao gravar definições:", error);
    });
  }, [hydrated, readOk, perspective, company, cutoffDay, contractAlertDays, closeDeadlineDays, highlightsMonths, highlightsRealtime, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount]);

  // `app_data` continua gravado por todas as sessões (gerência, supervisor
  // e funcionário escrevem horas/avisos/notas aqui) — só ganha o novo
  // guard de `readOk`.
  // Cada fatia grava só a diferença para o que este dispositivo viu do servidor
  // (ver `flushSlice`): já não apaga o que outro dispositivo fez entretanto.
  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("assignments");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, assignments]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushHoras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, horasData]);

  // Mantém tudo em dia com os outros dispositivos: ao voltar ao app, ao
  // voltar a ter internet e a cada ~45 s enquanto está aberto. É isto que
  // permite cruzar "mesmo cliente, mesmo dia" com o que um colega lançou
  // depois de este telemóvel abrir o app, e que os pedidos/avisos novos
  // apareçam sem recarregar. O histórico (pesado) só vem em refrescos completos.
  useEffect(() => {
    if (!isSupabaseConfigured || !hydrated || !readOk || perspective === "login") return;
    let n = 0;
    const tick = (full) => {
      if (document.visibilityState === "hidden") return;
      reloadIfNewDay();
      checkStillActive();
      refreshCompanyStatus();
      refreshHoras(full === true || n % 8 === 0);
      n += 1;
    };
    const onTimer = () => tick(false);
    const onBack = () => tick(true);
    const timer = setInterval(onTimer, 45000);
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    tick(true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, perspective]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("missing_items");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, missingItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("sent_items");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, sentItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("closed_periods");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, closedPeriods]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("personal_notes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, personalNotes]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("absences");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, absences]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    flushSlice("covers");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, readOk, covers]);

  function enterManagement() { setPerspective("management"); setScreen("dashboard"); }
  function enterEmployee(staffId) { setLoggedInStaffId(staffId); setPerspective("employee"); setEmpScreen("menu"); }

  function deleteClient(clientId) {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setAssignments((prev) => {
      const next = {};
      for (const key in prev) next[key] = prev[key].filter((cid) => cid !== clientId);
      return next;
    });
    if (isSupabaseConfigured) {
      supabase.from("clients").delete().eq("id", clientId).then(({ error }) => {
        if (error) console.error("Erro ao excluir cliente:", error);
      });
    }
  }

  function deleteStaff(staffId) {
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
    setAssignments((prev) => {
      const next = {};
      for (const key in prev) { if (!key.startsWith(`${staffId}-`)) next[key] = prev[key]; }
      return next;
    });
    setHorasData((prev) => {
      const next = { ...prev };
      delete next[staffId];
      return next;
    });
    if (isSupabaseConfigured) {
      supabase.from("staff").delete().eq("id", staffId).then(({ error }) => {
        if (error) console.error("Erro ao excluir funcionário:", error);
      });
    }
  }

  // "Formatar dados" (Definições): re-verifica a senha da gerência junto ao
  // Supabase Auth antes de permitir a ação destrutiva — não muda a rota nem
  // o estado de login, só confirma que quem está a pedir isto sabe a senha.
  async function verifyPassword(password) {
    if (!isSupabaseConfigured) return true;
    const { error } = await supabase.auth.signInWithPassword({ email: company.email, password });
    return !error;
  }

  // Apaga clientes, funcionários e todo o histórico operacional (horas,
  // avisos, períodos fechados). A conta de acesso (company_settings) não é
  // tocada — quem confirma isto não pode ficar trancado para fora.
  async function formatAllData() {
    setClients([]);
    setStaff([]);
    setAssignments({});
    setHorasData({});
    setMissingItems([]);
    setSentItems([]);
    setClosedPeriods([]);
    setCovers([]);
    // A gravação abaixo já limpa estas fatias no servidor: a base passa a vazia.
    ["assignments", "missing_items", "sent_items", "closed_periods", "covers"].forEach((c) => { sliceBaseRef.current[c] = emptySlice(c); });
    if (isSupabaseConfigured) {
      const results = await Promise.all([
        supabase.from("clients").delete().neq("id", -1),
        supabase.from("staff").delete().neq("id", -1),
        supabase.from("app_data").update({
          assignments: {}, horas_data: {}, missing_items: [], sent_items: [], closed_periods: [], covers: [],
        }).eq("id", companyIdRef.current),
      ]);
      results.forEach(({ error }) => { if (error) console.error("Erro ao formatar dados:", error); });
    }
  }

  const me = staff.find((s) => s.id === loggedInStaffId);
  const myReceived = sentItems.filter((i) => i.staffId === loggedInStaffId);
  const myUnreadBadge = myReceived.filter((i) => !i.read).length;

  // Gerência = a conta da empresa (login direto, sem ficha de funcionário), a
  // gerência e a gerência-supervisor (mesmo quando está na vista de funcionário).
  const isManagerSession = perspective === "management" || (perspective === "employee" && isManagerRole(me?.role));

  // A gerência volta a pedir a palavra-passe depois de IDLE_MINUTES sem usar o
  // app (qualquer toque, tecla ou rolagem conta como uso, em qualquer separador
  // do mesmo aparelho). Funcionários e supervisores continuam entrados.
  useEffect(() => {
    if (!isSupabaseConfigured || !isManagerSession) return;
    let lastWrite = 0;
    let leaving = false;
    const bump = () => {
      const now = Date.now();
      if (now - lastWrite > 5000) { lastWrite = now; markActive(now); }
    };
    const check = () => {
      if (leaving || !idleExceeded()) return;
      leaving = true;
      doLogout({ type: "idle" });
    };
    markActive();
    lastWrite = Date.now();
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true, capture: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 15000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManagerSession]);

  // Aviso de assinatura (a acabar / em tolerância); a gerência vê mais do que os outros.
  const companyNoticeValue = isSupabaseConfigured && perspective !== "login" ? companyNotice(companyStatus, isManagerSession) : null;

  return {
    perspective, setPerspective, screen, setScreen, goTo, navIntent, empScreen, setEmpScreen, empClientFocus, setEmpClientFocus, openEmpClient,
    loggedInStaffId, setLoggedInStaffId, lang, setLang,
    company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays, closeDeadlineDays, setCloseDeadlineDays, highlightsMonths, setHighlightsMonths, highlightsRealtime, setHighlightsRealtime,
    // Base do medidor de reclamações = nº de clientes ativos (automático, não editável).
    reclamacaoBaseClients: Math.max(1, activeClientsCount(clients, TODAY)), setReclamacaoBaseClients,
    reclamacaoExcelenteCount, setReclamacaoExcelenteCount,
    reclamacaoRazoavelCount, setReclamacaoRazoavelCount,
    clients, setClients, staff, setStaff, assignments, setAssignments,
    horasData, setHorasData, closedPeriods, setClosedPeriods,
    missingItems, setMissingItems, sentItems, setSentItems,
    personalNotes, setPersonalNotes, absences, setAbsences, covers, setCovers,
    enterManagement, enterEmployee, deleteClient, deleteStaff,
    formatAllData, verifyPassword,
    authLoading, authError, loginWithPassword, logout, passwordGate, requestPasswordReset, setNewPassword,
    me, myUnreadBadge, loadError,
    // Várias empresas
    companyCode, submitCompanyCode, changeCompany, legacyDb, companyGateReady,
    companyBlock, dismissCompanyBlock,
    companyNotice: companyNoticeValue,
  };
}