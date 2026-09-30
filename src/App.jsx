// Camada "View" raiz: lê o estado do controller e decide qual tela mostrar.
// Não guarda estado do negócio — só consome useAppController().
import { useAppController } from "./controllers/useAppController.js";
import { styles } from "./styles/styles.js";
import { Sidebar } from "./views/shared/Layout.jsx";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { SUPERVISOR_MENU_ITEMS } from "./models/data.js";
import { T } from "./models/i18n.js";

import LoginScreen from "./views/LoginScreen.jsx";
import DashboardScreen from "./views/management/DashboardScreen.jsx";
import ClientesScreen from "./views/management/ClientesScreen.jsx";
import AgendasScreen from "./views/management/AgendasScreen.jsx";
import HorasScreen from "./views/management/HorasScreen.jsx";
import MonitoramentoScreen from "./views/management/MonitoramentoScreen.jsx";
import AvisosScreen from "./views/management/AvisosScreen.jsx";
import FuncionariosScreen from "./views/management/FuncionariosScreen.jsx";
import AcessosScreen from "./views/management/AcessosScreen.jsx";
import HistoricoScreen from "./views/management/HistoricoScreen.jsx";
import DefinicoesScreen from "./views/management/DefinicoesScreen.jsx";
import NotasScreen from "./views/shared/NotasScreen.jsx";

import EmployeeMenuScreen from "./views/employee/EmployeeMenuScreen.jsx";
import EmployeeHorasScreen from "./views/employee/EmployeeHorasScreen.jsx";
import EmployeeAvisosScreen from "./views/employee/EmployeeAvisosScreen.jsx";
import EmployeeAgendaScreen from "./views/employee/EmployeeAgendaScreen.jsx";
import EmployeeClientesScreen from "./views/employee/EmployeeClientesScreen.jsx";
import EmployeeHistoricoScreen from "./views/employee/EmployeeHistoricoScreen.jsx";
import SupervisorDashboardScreen from "./views/employee/SupervisorDashboardScreen.jsx";

export default function App() {
  const c = useAppController();
  const isMobile = useIsMobile();
  // styles.page tem minHeight fixo de 700px, pensado para desktop. Em telemóveis
  // (ex.: iPhone SE tem só 667px de altura) isso força o corpo a ficar mais alto
  // que o próprio ecrã, criando um pequeno scroll vertical sempre presente.
  const pageStyle = isMobile ? { ...styles.page, minHeight: "100vh", padding: "14px" } : styles.page;

  return (
    <div style={pageStyle}>
      {c.perspective === "login" && (
        <LoginScreen
          lang={c.lang} setLang={c.setLang}
          onEnterManagement={c.enterManagement} onEnterEmployee={c.enterEmployee}
          onLoginWithPassword={c.loginWithPassword} authLoading={c.authLoading} authError={c.authError}
          company={c.company} staff={c.staff}
        />
      )}

      {c.perspective === "management" && (
        <div style={styles.shell}>
          <Sidebar activeKey={c.screen} onNavigate={c.setScreen} onLogout={c.logout} company={c.company} lang={c.lang} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {c.screen === "dashboard" && (
              <DashboardScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} staff={c.staff} horasData={c.horasData} missingItems={c.missingItems} sentItems={c.sentItems} contractAlertDays={c.contractAlertDays} reclamacaoBaseClients={c.reclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} personalNotes={c.personalNotes} onNavigate={c.setScreen} />
            )}
            {c.screen === "clientes" && <ClientesScreen lang={c.lang} setLang={c.setLang} clients={c.clients} setClients={c.setClients} onDeleteClient={c.deleteClient} />}
            {c.screen === "agendas" && <AgendasScreen lang={c.lang} setLang={c.setLang} clients={c.clients} staff={c.staff} assignments={c.assignments} setAssignments={c.setAssignments} />}
            {c.screen === "horas" && <HorasScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} staff={c.staff} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setClosedPeriods={c.setClosedPeriods} sentItems={c.sentItems} missingItems={c.missingItems} setSentItems={c.setSentItems} setMissingItems={c.setMissingItems} />}
            {c.screen === "monitoramento" && <MonitoramentoScreen lang={c.lang} setLang={c.setLang} staff={c.staff} clients={c.clients} horasData={c.horasData} assignments={c.assignments} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} />}
            {c.screen === "historico" && (
              <HistoricoScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} closedPeriods={c.closedPeriods} reclamacaoBaseClients={c.reclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} />
            )}
            {c.screen === "avisos" && (
              <AvisosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} clients={c.clients} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} setHorasData={c.setHorasData} />
            )}
            {c.screen === "notas" && (
              <NotasScreen lang={c.lang} setLang={c.setLang} ownerId="management" personalNotes={c.personalNotes} setPersonalNotes={c.setPersonalNotes} desktop />
            )}
            {c.screen === "funcionarios" && <FuncionariosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} setStaff={c.setStaff} clients={c.clients} assignments={c.assignments} onDeleteStaff={c.deleteStaff} />}
            {c.screen === "acessos" && <AcessosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} setStaff={c.setStaff} />}
            {c.screen === "definicoes" && (
              <DefinicoesScreen lang={c.lang} setLang={c.setLang} company={c.company} setCompany={c.setCompany} cutoffDay={c.cutoffDay} setCutoffDay={c.setCutoffDay} contractAlertDays={c.contractAlertDays} setContractAlertDays={c.setContractAlertDays} reclamacaoBaseClients={c.reclamacaoBaseClients} setReclamacaoBaseClients={c.setReclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} setReclamacaoExcelenteCount={c.setReclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} setReclamacaoRazoavelCount={c.setReclamacaoRazoavelCount} clients={c.clients} onFormatData={c.formatAllData} onVerifyPassword={c.verifyPassword} />
            )}
          </div>
        </div>
      )}

      {c.perspective === "employee" && c.me && c.me.role === "supervisor" && !isMobile && (
        // Supervisor entrando de PC/tablet: mesmo layout de barra lateral da
        // gerência, só que com o menu restrito às páginas já combinadas pro
        // supervisor, e um "dashboard" próprio (notas/lembretes) no lugar do
        // painel completo de gerência, que não faz sentido aqui.
        <div style={styles.shell}>
          <Sidebar
            activeKey={c.empScreen} onNavigate={c.setEmpScreen} onLogout={c.logout}
            company={c.company} lang={c.lang}
            items={SUPERVISOR_MENU_ITEMS} labels={T[c.lang].supervisorSidebar}
            brandOverride={{ name: c.me.name, sub: T[c.lang].acessos.roleSupervisor }}
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {c.empScreen === "menu" && (
              <SupervisorDashboardScreen lang={c.lang} setLang={c.setLang} me={c.me} personalNotes={c.personalNotes} onNavigate={c.setEmpScreen} />
            )}
            {c.empScreen === "notas" && (
              <NotasScreen lang={c.lang} setLang={c.setLang} ownerId={c.me.id} personalNotes={c.personalNotes} setPersonalNotes={c.setPersonalNotes} desktop />
            )}
            {["horas", "avisos", "agenda", "clientes", "historico", "monitoramento"].includes(c.empScreen) && (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", padding: "24px 24px 40px" }}>
                {c.empScreen === "horas" && (
                  <EmployeeHorasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setMissingItems={c.setMissingItems} />
                )}
                {c.empScreen === "avisos" && (
                  <EmployeeAvisosScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} isSupervisor />
                )}
                {c.empScreen === "agenda" && (
                  <EmployeeAgendaScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} />
                )}
                {c.empScreen === "clientes" && (
                  <EmployeeClientesScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} canViewAll={!!c.me.canViewAllClients} />
                )}
                {c.empScreen === "historico" && (
                  <EmployeeHistoricoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} company={c.company} clients={c.clients} closedPeriods={c.closedPeriods} />
                )}
                {c.empScreen === "monitoramento" && (
                  <MonitoramentoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staff={c.staff} clients={c.clients} horasData={c.horasData} assignments={c.assignments} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {c.perspective === "employee" && c.me && !(c.me.role === "supervisor" && !isMobile) && (
        <>
          {c.empScreen === "menu" && (
            <EmployeeMenuScreen lang={c.lang} setLang={c.setLang} me={c.me} onNavigate={c.setEmpScreen} onLogout={c.logout} avisosBadge={c.myUnreadBadge} />
          )}
          {c.empScreen === "horas" && (
            <EmployeeHorasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setMissingItems={c.setMissingItems} />
          )}
          {c.empScreen === "avisos" && (
            <EmployeeAvisosScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} isSupervisor={c.me.role === "supervisor"} />
          )}
          {c.empScreen === "agenda" && (
            <EmployeeAgendaScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} />
          )}
          {c.empScreen === "clientes" && (
            <EmployeeClientesScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} canViewAll={!!c.me.canViewAllClients} />
          )}
          {c.empScreen === "historico" && (
            <EmployeeHistoricoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} company={c.company} clients={c.clients} closedPeriods={c.closedPeriods} />
          )}
          {c.empScreen === "monitoramento" && (
            <MonitoramentoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staff={c.staff} clients={c.clients} horasData={c.horasData} assignments={c.assignments} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} />
          )}
          {c.empScreen === "notas" && (
            <NotasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} ownerId={c.me.id} personalNotes={c.personalNotes} setPersonalNotes={c.setPersonalNotes} />
          )}
        </>
      )}
    </div>
  );
}
