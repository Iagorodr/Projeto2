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

  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [staff, setStaff] = useState(INITIAL_STAFF);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [horasData, setHorasData] = useState(INITIAL_HORAS);
  const [closedPeriods, setClosedPeriods] = useState(INITIAL_CLOSED_PERIODS);
  const [missingItems, setMissingItems] = useState(INITIAL_MISSING);
  const [sentItems, setSentItems] = useState(INITIAL_SENT);
  const [personalNotes, setPersonalNotes] = useState([]);

  const [hydrated, setHydrated] = useState(!isSupabaseConfigured);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  async function loadAllData() {
    let companyEmail = company.email;
    let staffList = staff;
    try {
      const [clientsRes, staffRes, settingsRes, appDataRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("staff").select("*"),
        supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("app_data").select("*").eq("id", 1).maybeSingle(),
      ]);

      if (clientsRes.error) console.error("Erro ao carregar clientes:", clientsRes.error);
      else if (clientsRes.data && clientsRes.data.length > 0) setClients(clientsRes.data.map(fromDbClient));

      if (staffRes.error) console.error("Erro ao carregar funcionários:", staffRes.error);
      else if (staffRes.data && staffRes.data.length > 0) {
        staffList = staffRes.data.map(fromDbStaff);
        setStaff(staffList);
      }

      if (settingsRes.error) console.error("Erro ao carregar definições:", settingsRes.error);
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

      if (appDataRes.error) console.error("Erro ao carregar dados do app:", appDataRes.error);
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
    }
    return { companyEmail, staffList };
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
      if (matchedStaff.role === "gerencia") {
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
          const { companyEmail, staffList } = await loadAllData();
          if (cancelled) return;
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

  async function loginWithPassword(email, password) {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message === "Invalid login credentials" ? "invalid_credentials" : "generic");
        return;
      }
      const { companyEmail, staffList } = await loadAllData();
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
  }

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("clients").upsert(clients.map(toDbClient)).then(({ error }) => {
      if (error) console.error("Erro ao gravar clientes:", error);
    });
  }, [hydrated, clients]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("staff").upsert(staff.map(toDbStaff)).then(({ error }) => {
      if (error) console.error("Erro ao gravar funcionários:", error);
    });
  }, [hydrated, staff]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    const payload = toDbCompanySettings({
      company, cutoffDay, contractAlertDays,
      reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount,
    });
    supabase.from("company_settings").update(payload).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar definições:", error);
    });
  }, [hydrated, company, cutoffDay, contractAlertDays, reclamacaoBaseClients, reclamacaoExcelenteCount, reclamacaoRazoavelCount]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ assignments }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar atribuições:", error);
    });
  }, [hydrated, assignments]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ horas_data: horasData }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar horas:", error);
    });
  }, [hydrated, horasData]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ missing_items: missingItems }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar solicitações:", error);
    });
  }, [hydrated, missingItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ sent_items: sentItems }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar avisos:", error);
    });
  }, [hydrated, sentItems]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ closed_periods: closedPeriods }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar histórico:", error);
    });
  }, [hydrated, closedPeriods]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return;
    supabase.from("app_data").update({ personal_notes: personalNotes }).eq("id", 1).then(({ error }) => {
      if (error) console.error("Erro ao gravar notas:", error);
    });
  }, [hydrated, personalNotes]);

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
    me, myUnreadBadge,
  };
}