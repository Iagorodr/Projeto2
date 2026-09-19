// Camada "Controller": guarda todo o estado da aplicação e as ações que o
// alteram. As Views (App.jsx e as telas) só leem o que este hook devolve —
// não têm useState próprio para os dados do negócio.
import { useState } from "react";
import {
  INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_HORAS,
  INITIAL_MISSING, INITIAL_SENT,
} from "../models/data.js";

export function useAppController() {
  const [perspective, setPerspective] = useState("login"); // 'login' | 'management' | 'employee'
  const [screen, setScreen] = useState("dashboard");
  const [empScreen, setEmpScreen] = useState("menu");
  const [loggedInStaffId, setLoggedInStaffId] = useState(null);
  const [lang, setLang] = useState("pt");

  const [company, setCompany] = useState({ name: "Empresa X", email: "empresax@login1.gmail.com", password: "", hasPhoto: true });
  const [cutoffDay, setCutoffDay] = useState(20);
  const [contractAlertDays, setContractAlertDays] = useState(30);
  const [reclamacaoRatioClients, setReclamacaoRatioClients] = useState(5);

  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [staff, setStaff] = useState(INITIAL_STAFF);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [horasData, setHorasData] = useState(INITIAL_HORAS);
  const [closedPeriods, setClosedPeriods] = useState([]);
  const [missingItems, setMissingItems] = useState(INITIAL_MISSING);
  const [sentItems, setSentItems] = useState(INITIAL_SENT);

  function goLogin() { setPerspective("login"); }
  function enterManagement() { setPerspective("management"); setScreen("dashboard"); }
  function enterEmployee(staffId) { setLoggedInStaffId(staffId); setPerspective("employee"); setEmpScreen("menu"); }
  function switchToManagementFromEmployee() { setPerspective("management"); setScreen("dashboard"); }
  function switchToEmployeeFromManagement(staffId) { setLoggedInStaffId(staffId); setPerspective("employee"); setEmpScreen("menu"); }

  const me = staff.find((s) => s.id === loggedInStaffId);
  const myReceived = sentItems.filter((i) => i.staffId === loggedInStaffId);
  const myUnreadBadge = myReceived.filter((i) => !i.read).length;

  return {
    // navigation state
    perspective, setPerspective, screen, setScreen, empScreen, setEmpScreen,
    loggedInStaffId, setLoggedInStaffId, lang, setLang,
    // settings
    company, setCompany, cutoffDay, setCutoffDay, contractAlertDays, setContractAlertDays,
    reclamacaoRatioClients, setReclamacaoRatioClients,
    // domain data
    clients, setClients, staff, setStaff, assignments, setAssignments,
    horasData, setHorasData, closedPeriods, setClosedPeriods,
    missingItems, setMissingItems, sentItems, setSentItems,
    // actions
    goLogin, enterManagement, enterEmployee, switchToManagementFromEmployee, switchToEmployeeFromManagement,
    // derived
    me, myUnreadBadge,
  };
}
