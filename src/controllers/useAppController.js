// Camada "Controller": guarda todo o estado da aplicação e as ações que o
// alteram. As Views (App.jsx e as telas) só leem o que este hook devolve —
// não têm useState próprio para os dados do negócio.
//
// Persistência: se o Supabase estiver configurado (ver models/supabaseClient.js),
// o estado é carregado de lá ao abrir e cada alteração é gravada de volta. Sem
// configuração, o app funciona exatamente como antes, só em memória, usando os
// dados de demonstração de models/data.js / models/seedHistory.js.
import { useState, useEffect } from "react";
import {
  INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_HORAS,
  INITIAL_MISSING, INITIAL_SENT,
} from "../models/data.js";
import { INITIAL_CLOSED_PERIODS } from "../models/seedHistory.js";
import { supabase, isSupabaseConfigured } from "../models/supabaseClient.js";
import {
  toDbClient, fromDbClient, toDbStaff, fromDbStaff,
  toDbCompanySettings, fromDbCompanySettings,
} from "../models/dbMappers.js";

// Empresas novas (deploy com VITE_START_EMPTY=true na Vercel) começam SEM os
// dados de demonstração embutidos no código; as já existentes ficam como estão.
const START_EMPTY = import.meta.env.VITE_START_EMPTY === "true";

export function useAppController() {
  const [perspective, setPerspective] = useState("login"); // 'login' | 'management' | 'employee'
  const [screen, setScreen] = useState("dashboard");
  const [empScreen, setEmpScreen] = useState("menu");
  const [loggedInStaffId, setLoggedInStaffId] = useState(null);
  const [lang, setLang] = useState("pt");

  const [company, setCompany] = useState({ name: "Empresa X", email: "empresax@login1.gmail.com", password: "", photoUrl: null });
  const [cutoffDay, setCutoffDay] = useState(20);
  const [contractAlertDays, setContractAlertDays] = useState(30);
  const [reclamacaoBaseClients, setReclamacaoBaseClients] = useState(10);
  const [reclamacaoExcelenteCount, setReclamacaoExcelenteCount] = useState(1);
  const [reclamacaoRazoavelCount, setReclamacaoRazoavelCount] = useState(3);

  const [clients, setClients] = useState(START_EMPTY ? [] : INITIAL_CLIENTS);
  const [staff, setStaff] = useState(START_EMPTY ? [] : INITIAL_STAFF);
  const [assignments, setAssignments] = useState(START_EMPTY ? {} : INITIAL_ASSIGNMENTS);
  const [horasData, setHorasData] = useState(START_EMPTY ? {} : INITIAL_HORAS);
  const [closedPeriods, setClosedPeriods] = useState(START_EMPTY ? [] : INITIAL_CLOSED_PERIODS);
  const [missingItems, setMissingItems] = useState(START_EMPTY ? [] : INITIAL_MISSING);
  const [sentItems, setSentItems] = useState(START_EMPTY ? [] : INITIAL_SENT);
  const [personalNotes, setPersonalNotes] = useState([]);

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
  const [authError, setAuthError] = useState(null);

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
        supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("app_data").select("*").eq("id", 1).maybeSingle(),
      ]);

      if (clientsRes.error) { console.error("Erro ao carregar clientes:", clientsRes.error); ok = false; }
      else if (clientsRes.data && clientsRes.data.length > 0) setClients(clientsRes.data.map(fromDbClient));

      if (staffRes.error) { console.error("Erro ao carregar funcionários:", staffRes.error); ok = false; }
      else if (staffRes.data && staffRes.data.length > 0) {
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
        setReclamacaoBaseClients(mapped.reclamacaoBaseClients);
        setReclamacaoExcelenteCount(mapped.reclamacaoExcelenteCount);
        setReclamacaoRazoavelCount(mapped.reclamacaoRazoavelCount);
      }

      if (appDataRes.error) { console.error("Erro ao carregar dados do app:", appDataRes.error); ok = false; }
      else if (appDataRes.data) {
        const row = appDataRes.data;
        if (row.assignments && Object.keys(row.assignments).length > 0) setAssignments(row.assignments);
        if (row.horas_data && Object.keys(row.horas_data).length > 0) setHorasData(row.horas_data);
        if (row.missing_items && row.missing_items.length > 0) setMissingItems(row.missing_items);
        if (row.sent_items && row.sent_items.length > 0) setSentItems(row.sent_items);
        if (row.closed_periods && row.closed_periods.length > 0) setClosedPeriods(row.closed_periods);
        if (row.personal_notes && row.personal_notes.length > 0) setPersonalNotes(row.personal_notes);
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
          const { companyEmail, staffList, ok } = await loadAllData();
          if (cancelled) return;
          if (ok) setReadOk(true);
          const routed = await resolveSessionAndRoute(session.user.email, companyEmail, staffList);
          if (!routed) {
            console.error("Sessão sem correspondência em funcionários/empresa — a terminar sessão.");
            await supabase.auth.signOut();
          }
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message === "Invalid login credentials" ? "invalid_credentials" : "generic");
        return;
      }
      const { companyEmail, staffList, ok } = await loadAllData();
      if (ok) setReadOk(true);
      const routed = await resolveSessionAndRoute(data.user.email, companyEmail, staffList);
      if (!routed) {
        setAuthError("no_account");
        await supabase.auth.signOut();
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setLoggedInStaffId(null);
    setAuthError(null);
    setPerspective("login");
    setReadOk(false);
    setLoadError(false);
  }

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
      company, cutoffDay, contractAlertDays,
      reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount,
    });
    supabase.from("company_settings").update(payload).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar definições:", error);
    });
  }, [hydrated, readOk, perspective, company, cutoffDay, contractAlertDays, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount]);

  // `app_data` continua gravado por todas as sessões (gerência, supervisor
  // e funcionário escrevem horas/avisos/notas aqui) — só ganha o novo
  // guard de `readOk`.
  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ assignments }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar atribuições:", error);
    });
  }, [hydrated, readOk, assignments]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ horas_data: horasData }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar horas:", error);
    });
  }, [hydrated, readOk, horasData]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ missing_items: missingItems }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar solicitações:", error);
    });
  }, [hydrated, readOk, missingItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ sent_items: sentItems }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar avisos:", error);
    });
  }, [hydrated, readOk, sentItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ closed_periods: closedPeriods }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar histórico:", error);
    });
  }, [hydrated, readOk, closedPeriods]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !readOk) return;
    supabase.from("app_data").update({ personal_notes: personalNotes }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar notas:", error);
    });
  }, [hydrated, readOk, personalNotes]);

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
    if (isSupabaseConfigured) {
      const results = await Promise.all([
        supabase.from("clients").delete().neq("id", -1),
        supabase.from("staff").delete().neq("id", -1),
        supabase.from("app_data").update({
          assignments: {}, horas_data: {}, missing_items: [], sent_items: [], closed_periods: [],
        }).eq("id", 1),
      ]);
      results.forEach(({ error }) => { if (error) console.error("Erro ao formatar dados:", error); });
    }
  }

  const me = staff.find((s) => s.id === loggedInStaffId);
  const myReceived = sentItems.filter((i) => i.staffId === loggedInStaffId);
  const myUnreadBadge = myReceived.filter((i) => !i.read).length;

  return {
    perspective, setPerspective, screen, setScreen, empScreen, setEmpScreen,
    loggedInStaffId, setLoggedInStaffId, lang, setLang,
    company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays,
    reclamacaoBaseClients, setReclamacaoBaseClients,
    reclamacaoExcelenteCount, setReclamacaoExcelenteCount,
    reclamacaoRazoavelCount, setReclamacaoRazoavelCount,
    clients, setClients, staff, setStaff, assignments, setAssignments,
    horasData, setHorasData, closedPeriods, setClosedPeriods,
    missingItems, setMissingItems, sentItems, setSentItems,
    personalNotes, setPersonalNotes,
    enterManagement, enterEmployee, deleteClient, deleteStaff,
    formatAllData, verifyPassword,
    authLoading, authError, loginWithPassword, logout,
    me, myUnreadBadge, loadError,
  };
}