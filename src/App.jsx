// Camada "View" raiz: lê o estado do controller e decide qual tela mostrar.
// Não guarda estado do negócio — só consome useAppController().
import { useAppController } from "./controllers/useAppController.js";
import { styles } from "./styles/styles.js";
import { Sidebar } from "./views/shared/Layout.jsx";

import LoginScreen from "./views/LoginScreen.jsx";
import DashboardScreen from "./views/management/DashboardScreen.jsx";
import ClientesScreen from "./views/management/ClientesScreen.jsx";
import AgendasScreen from "./views/management/AgendasScreen.jsx";
import HorasScreen from "./views/management/HorasScreen.jsx";
import AvisosScreen from "./views/management/AvisosScreen.jsx";
import FuncionariosScreen from "./views/management/FuncionariosScreen.jsx";
import HistoricoScreen from "./views/management/HistoricoScreen.jsx";
import DefinicoesScreen from "./views/management/DefinicoesScreen.jsx";

import EmployeeMenuScreen from "./views/employee/EmployeeMenuScreen.jsx";
import EmployeeHorasScreen from "./views/employee/EmployeeHorasScreen.jsx";
import EmployeeAvisosScreen from "./views/employee/EmployeeAvisosScreen.jsx";
import EmployeeAgendaScreen from "./views/employee/EmployeeAgendaScreen.jsx";
import EmployeeClientesScreen from "./views/employee/EmployeeClientesScreen.jsx";
import EmployeeHistoricoScreen from "./views/employee/EmployeeHistoricoScreen.jsx";

export default function App() {
  const c = useAppController();

  return (
    <div style={styles.page}>
      {c.perspective === "login" && (
        <LoginScreen
          lang={c.lang} setLang={c.setLang}
          onEnterManagement={c.enterManagement} onEnterEmployee={c.enterEmployee}
          company={c.company} staff={c.staff}
        />
      )}

      {c.perspective === "management" && (
        <div style={styles.shell}>
          <Sidebar activeKey={c.screen} onNavigate={c.setScreen} onLogout={c.goLogin} company={c.company} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ padding: "10px 28px 0", textAlign: "right" }}>
              <select
                style={{ ...styles.langButton, cursor: "pointer" }}
                value=""
                onChange={(e) => { if (e.target.value) c.switchToEmployeeFromManagement(Number(e.target.value)); }}
              >
                <option value="">Ver como Funcionário...</option>
                {c.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {c.screen === "dashboard" && (
              <DashboardScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} staff={c.staff} horasData={c.horasData} missingItems={c.missingItems} sentItems={c.sentItems} contractAlertDays={c.contractAlertDays} reclamacaoRatioClients={c.reclamacaoRatioClients} cutoffDay={c.cutoffDay} onNavigate={c.setScreen} />
            )}
            {c.screen === "clientes" && <ClientesScreen lang={c.lang} setLang={c.setLang} clients={c.clients} setClients={c.setClients} />}
            {c.screen === "agendas" && <AgendasScreen lang={c.lang} setLang={c.setLang} clients={c.clients} staff={c.staff} assignments={c.assignments} setAssignments={c.setAssignments} />}
            {c.screen === "horas" && <HorasScreen lang={c.lang} setLang={c.setLang} clients={c.clients} staff={c.staff} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setClosedPeriods={c.setClosedPeriods} sentItems={c.sentItems} missingItems={c.missingItems} />}
            {c.screen === "historico" && <HistoricoScreen lang={c.lang} setLang={c.setLang} clients={c.clients} closedPeriods={c.closedPeriods} />}
            {c.screen === "avisos" && (
              <AvisosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} clients={c.clients} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} setHorasData={c.setHorasData} />
            )}
            {c.screen === "funcionarios" && <FuncionariosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} setStaff={c.setStaff} clients={c.clients} assignments={c.assignments} />}
            {c.screen === "definicoes" && (
              <DefinicoesScreen lang={c.lang} setLang={c.setLang} company={c.company} setCompany={c.setCompany} cutoffDay={c.cutoffDay} setCutoffDay={c.setCutoffDay} contractAlertDays={c.contractAlertDays} setContractAlertDays={c.setContractAlertDays} reclamacaoRatioClients={c.reclamacaoRatioClients} setReclamacaoRatioClients={c.setReclamacaoRatioClients} />
            )}
          </div>
        </div>
      )}

      {c.perspective === "employee" && c.me && (
        <>
          {c.empScreen === "menu" && (
            <EmployeeMenuScreen lang={c.lang} setLang={c.setLang} me={c.me} onNavigate={c.setEmpScreen} onLogout={c.goLogin} onSwitchToManagement={c.switchToManagementFromEmployee} avisosBadge={c.myUnreadBadge} />
          )}
          {c.empScreen === "horas" && (
            <EmployeeHorasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} setMissingItems={c.setMissingItems} />
          )}
          {c.empScreen === "avisos" && (
            <EmployeeAvisosScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} />
          )}
          {c.empScreen === "agenda" && (
            <EmployeeAgendaScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} />
          )}
          {c.empScreen === "clientes" && (
            <EmployeeClientesScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} />
          )}
          {c.empScreen === "historico" && (
            <EmployeeHistoricoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} closedPeriods={c.closedPeriods} />
          )}
        </>
      )}
    </div>
  );
}
