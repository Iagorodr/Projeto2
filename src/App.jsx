// Camada "View" raiz: lê o estado do controller e decide qual tela mostrar.
// Não guarda estado do negócio — só consome useAppController().
import { useState } from "react";
import { MoreHorizontal, LogOut } from "lucide-react";
import { useAppController } from "./controllers/useAppController.js";
import { styles } from "./styles/styles.js";
import { AppSidebar, MobileBottomBar, MoreSheet } from "./views/shared/ui/index.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { useBreakpoint } from "./hooks/useBreakpoint.js";
import { MENU_ITEMS, SUPERVISOR_MENU_ITEMS, TODAY } from "./models/data.js";
import { getOpenPeriod, weekBlocksOfPayPeriod, staffWithGapsCount, isSolicitationStale } from "./models/utils.js";
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

// EmployeeMenuScreen.jsx (a lista de botões sem casca nenhuma) ficou
// substituído pelo EmployeeInicioScreen novo + a casca da Etapa 3 abaixo
// — ficheiro removido do projeto na limpeza pós-Etapa 4 (estava órfão,
// sem nenhum import).
import EmployeeHorasScreen from "./views/employee/EmployeeHorasScreen.jsx";
import EmployeeAvisosScreen from "./views/employee/EmployeeAvisosScreen.jsx";
import EmployeeAgendaScreen from "./views/employee/EmployeeAgendaScreen.jsx";
import EmployeeClientesScreen from "./views/employee/EmployeeClientesScreen.jsx";
import EmployeeHistoricoScreen from "./views/employee/EmployeeHistoricoScreen.jsx";
import EmployeeInicioScreen from "./views/employee/EmployeeInicioScreen.jsx";
// SupervisorDashboardScreen.jsx (o antigo "Início" do supervisor em
// PC/tablet, só notas/lembretes) ficou substituído pelo EmployeeInicioScreen
// novo (Etapa 4b, secção 5.1) — ficheiro removido do projeto na limpeza
// pós-Etapa 4 (estava órfão, sem nenhum import).

export default function App() {
  const c = useAppController();
  const isMobile = useIsMobile();
  // Casca nova da Etapa 3 (sidebar/rail/barra inferior); a gerência
  // também usa `empTier` pro `AppSidebar` desde o Lote 4, 4.3 — o
  // CONTEÚDO de cada tela de gerência continua em `useIsMobile` (isso não
  // mudou, só a sidebar em volta).
  const empTier = useBreakpoint();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  // styles.page tem minHeight fixo de 700px, pensado para desktop. Em telemóveis
  // (ex.: iPhone SE tem só 667px de altura) isso força o corpo a ficar mais alto
  // que o próprio ecrã, criando um pequeno scroll vertical sempre presente.
  const basePageStyle = isMobile ? { ...styles.page, minHeight: "100dvh", padding: "14px" } : styles.page;
  // QA (achado do Iago, print do login): o fundo em gradiente do login
  // ficava "dentro de uma caixa" por causa do padding da página (14px no
  // telemóvel, 20px nos outros tamanhos). Na tela de login a página não
  // tem padding nem centragem: o LoginScreen ocupa a tela toda, em
  // qualquer tamanho.
  const pageStyle = c.perspective === "login"
    ? { ...basePageStyle, padding: 0, minHeight: "100dvh", justifyContent: "flex-start", alignItems: "stretch" }
    : basePageStyle;

  return (
    <div style={pageStyle}>
      {c.loadError && (
        // QA pós-auditoria (Lote 1, item 2 — "Gravar só depois de ler"):
        // avisa quando a última leitura do Supabase falhou (`loadError`,
        // ver useAppController.js) — sem isto, um erro de leitura passava
        // em silêncio e os dados de demonstração em memória podiam acabar
        // gravados por cima dos reais.
        <div
          role="alert"
          style={{
            background: "#fff3cd", color: "#664d03", border: "1px solid #ffe69c",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            fontSize: 14, fontWeight: 500,
          }}
        >
          {T[c.lang].common.loadErrorBanner}
        </div>
      )}
      {c.perspective === "login" && (
        <LoginScreen
          lang={c.lang} setLang={c.setLang}
          onEnterManagement={c.enterManagement} onEnterEmployee={c.enterEmployee}
          onLoginWithPassword={c.loginWithPassword} authLoading={c.authLoading} authError={c.authError}
          company={c.company} staff={c.staff}
        />
      )}

      {c.perspective === "management" && (() => {
        // Lote 4, 4.3 (achado da Marta — "Menu verde da gerência"): troca
        // do `Sidebar` antigo (views/shared/Layout.jsx — fundo sólido, sem
        // o verde gradiente nem o "Sair" de verdade) pelo `AppSidebar` já
        // usado do lado funcionário/supervisor desde a Etapa 4, igual ao
        // documento pede: 236px sempre aberto no desktop (inclusive em
        // Agendas agora — a própria grade de 170px já rola na horizontal
        // dentro do cartão, ver AgendasScreen.jsx linha 587, então não
        // precisa mais forçar o menu a ícones só nessa tela), só ícones
        // (76px) no tablet, e o mesmo modo de ícones no celular ("o mínimo
        // que funcione", como o Iago aprovou — sem rail próprio pra
        // gerência, que é trabalho de Etapa 4 fora de escopo).
        const tSidebar = T[c.lang].sidebar;
        let overtimePending = 0;
        Object.values(c.horasData).forEach((data) => {
          data.entries.forEach((e) => { if (e.extra && !e.approved && !e.voided) overtimePending += 1; });
        });
        // QA (achado do Iago — pedidos de período já fechado "saindo das
        // pendências"): mesma exclusão de AvisosScreen.jsx (`isSolicitationStale`),
        // pra o selo da barra lateral bater com a contagem que a própria
        // tela de Avisos mostra por padrão (sem isto, o selo continuaria
        // contando pedidos antigos escondidos por padrão na tela).
        const avisosOpenPeriod = getOpenPeriod(c.closedPeriods, c.cutoffDay, TODAY);
        const pendingRequests = c.missingItems.filter((m) => !m.resolved && !isSolicitationStale(m, avisosOpenPeriod)).length;
        const managementItems = MENU_ITEMS.map((item) => ({
          key: item.key, icon: item.icon, label: tSidebar[item.key],
          badge: item.key === "horas" ? (overtimePending || undefined)
            : item.key === "avisos" ? (pendingRequests || undefined)
            : undefined,
        }));
        const managementCollapsed = empTier === "desktop" ? false : "icons";
        // Nome de quem entrou, não da empresa (achado da Marta) — `staff`
        // não tem campo de foto (igual já era do lado supervisor/
        // funcionário, ver o `user` passado ao AppSidebar logo abaixo
        // nesta mesma tela, perto de "empTier === 'tablet'"), só a
        // `company` tem; por isso só o login direto da conta-mãe (sem
        // `loggedInStaffId`, ver resolveSessionAndRoute) ganha foto aqui.
        const managementUser = c.me
          ? { name: c.me.name, subtitle: T[c.lang].acessos.roleGerencia }
          : { name: c.company.name, photoUrl: c.company.photoUrl, subtitle: T[c.lang].acessos.roleGerencia };

        // QA (achado do Iago — "Agendas"): a grade de 7 dias precisa de
        // mais largura do que o `shell` padrão (1200) dá depois da
        // sidebar — com isso, nem 4 dias cabiam sem rolar, escondendo
        // "hoje" (geralmente o dia mais à direita) e sobrando uma faixa
        // enorme de fundo vazio dos dois lados do `shell` em ecrãs
        // largos. Só esta tela ganha um `shell` mais largo (1680); as
        // outras continuam exatamente como estavam.
        const shellStyle = c.screen === "agendas" ? { ...styles.shell, maxWidth: 1680 } : styles.shell;
        return (
        <div style={shellStyle}>
          <AppSidebar
            items={managementItems} activeKey={c.screen} onNavigate={c.setScreen}
            density="gerencia" collapsed={managementCollapsed}
            user={managementUser} onLogout={c.logout} logoutLabel={T[c.lang].common.logout}
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            {c.screen === "dashboard" && (
              <DashboardScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} staff={c.staff} horasData={c.horasData} missingItems={c.missingItems} sentItems={c.sentItems} contractAlertDays={c.contractAlertDays} reclamacaoBaseClients={c.reclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} personalNotes={c.personalNotes} onNavigate={c.setScreen} />
            )}
            {c.screen === "clientes" && <ClientesScreen lang={c.lang} setLang={c.setLang} clients={c.clients} setClients={c.setClients} onDeleteClient={c.deleteClient} staff={c.staff} assignments={c.assignments} horasData={c.horasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} contractAlertDays={c.contractAlertDays} onNavigate={c.setScreen} />}
            {c.screen === "agendas" && <AgendasScreen lang={c.lang} setLang={c.setLang} clients={c.clients} setClients={c.setClients} staff={c.staff} assignments={c.assignments} setAssignments={c.setAssignments} />}
            {c.screen === "horas" && <HorasScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} staff={c.staff} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setClosedPeriods={c.setClosedPeriods} sentItems={c.sentItems} missingItems={c.missingItems} setSentItems={c.setSentItems} setMissingItems={c.setMissingItems} />}
            {c.screen === "monitoramento" && <MonitoramentoScreen lang={c.lang} setLang={c.setLang} staff={c.staff} clients={c.clients} horasData={c.horasData} assignments={c.assignments} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} />}
            {c.screen === "historico" && (
              <HistoricoScreen lang={c.lang} setLang={c.setLang} company={c.company} clients={c.clients} closedPeriods={c.closedPeriods} reclamacaoBaseClients={c.reclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} />
            )}
            {c.screen === "avisos" && (
              <AvisosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} clients={c.clients} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} setHorasData={c.setHorasData} closedPeriods={c.closedPeriods} cutoffDay={c.cutoffDay} />
            )}
            {c.screen === "notas" && (
              <NotasScreen lang={c.lang} setLang={c.setLang} ownerId="management" personalNotes={c.personalNotes} setPersonalNotes={c.setPersonalNotes} desktop />
            )}
            {c.screen === "funcionarios" && <FuncionariosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} setStaff={c.setStaff} clients={c.clients} assignments={c.assignments} onDeleteStaff={c.deleteStaff} onNavigate={c.setScreen} />}
            {c.screen === "acessos" && <AcessosScreen lang={c.lang} setLang={c.setLang} staff={c.staff} setStaff={c.setStaff} />}
            {c.screen === "definicoes" && (
              <DefinicoesScreen lang={c.lang} setLang={c.setLang} company={c.company} setCompany={c.setCompany} cutoffDay={c.cutoffDay} setCutoffDay={c.setCutoffDay} contractAlertDays={c.contractAlertDays} setContractAlertDays={c.setContractAlertDays} reclamacaoBaseClients={c.reclamacaoBaseClients} setReclamacaoBaseClients={c.setReclamacaoBaseClients} reclamacaoExcelenteCount={c.reclamacaoExcelenteCount} setReclamacaoExcelenteCount={c.setReclamacaoExcelenteCount} reclamacaoRazoavelCount={c.reclamacaoRazoavelCount} setReclamacaoRazoavelCount={c.setReclamacaoRazoavelCount} clients={c.clients} onFormatData={c.formatAllData} onVerifyPassword={c.verifyPassword} />
            )}
          </div>
        </div>
        );
      })()}

      {c.perspective === "employee" && c.me && (() => {
        // Casca nova da Etapa 3 pro funcionário/supervisor (documento,
        // 3.1-3.3): PC sidebar completa, tablet vira "rail" (108px,
        // variante que não existia pra este lado antes), telemóvel vira
        // barra inferior + folha "Mais". "Regra de ouro" (documento, 5):
        // os dois papéis usam os MESMOS ecrãs — a única diferença é
        // Monitoramento (só supervisor) e o selo de papel.
        const isSupervisor = c.me.role === "supervisor";
        const tSidebar = T[c.lang].supervisorSidebar;
        // SUPERVISOR_MENU_ITEMS já tem a ordem certa do documento
        // (Início, Horas, Avisos, Agenda, Clientes, Histórico,
        // Monitoramento, Notas) com o ícone certo por chave — só falta
        // traduzir o rótulo e tirar Monitoramento pra quem não é
        // supervisor. O funcionário ganha aqui o acesso a "Notas" que só
        // tinha por rota direta até agora (o botão no menu antigo não
        // oferecia isso, mas a rota em si já funcionava).
        const roleItems = SUPERVISOR_MENU_ITEMS.filter((it) => isSupervisor || it.key !== "monitoramento");
        const sidebarItems = roleItems.map((it) => ({
          key: it.key, icon: it.icon, label: tSidebar[it.key],
          badge: it.key === "avisos" ? c.myUnreadBadge : undefined,
        }));

        const body = (
          <>
            {c.empScreen === "menu" && (
              <EmployeeInicioScreen
                lang={c.lang} setLang={c.setLang} me={c.me} onNavigate={c.setEmpScreen}
                avisosBadge={c.myUnreadBadge} clients={c.clients} staff={c.staff} assignments={c.assignments}
                horasData={c.horasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} personalNotes={c.personalNotes}
              />
            )}
            {c.empScreen === "horas" && (
              <EmployeeHorasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} company={c.company} clients={c.clients} staff={c.staff} assignments={c.assignments} horasData={c.horasData} setHorasData={c.setHorasData} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} setMissingItems={c.setMissingItems} />
            )}
            {c.empScreen === "avisos" && (
              <EmployeeAvisosScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} staff={c.staff} assignments={c.assignments} missingItems={c.missingItems} setMissingItems={c.setMissingItems} sentItems={c.sentItems} setSentItems={c.setSentItems} isSupervisor={isSupervisor} desktop={empTier !== "mobile"} />
            )}
            {c.empScreen === "agenda" && (
              <EmployeeAgendaScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} staff={c.staff} clients={c.clients} assignments={c.assignments} desktop={empTier !== "mobile"} />
            )}
            {c.empScreen === "clientes" && (
              <EmployeeClientesScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} clients={c.clients} assignments={c.assignments} canViewAll={!!c.me.canViewAllClients} desktop={empTier !== "mobile"} />
            )}
            {c.empScreen === "historico" && (
              <EmployeeHistoricoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staffId={c.me.id} company={c.company} clients={c.clients} closedPeriods={c.closedPeriods} desktop={empTier !== "mobile"} />
            )}
            {c.empScreen === "monitoramento" && (
              <MonitoramentoScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} staff={c.staff} clients={c.clients} horasData={c.horasData} assignments={c.assignments} cutoffDay={c.cutoffDay} closedPeriods={c.closedPeriods} />
            )}
            {c.empScreen === "notas" && (
              <NotasScreen lang={c.lang} setLang={c.setLang} onHome={() => c.setEmpScreen("menu")} ownerId={c.me.id} personalNotes={c.personalNotes} setPersonalNotes={c.setPersonalNotes} desktop={empTier !== "mobile"} />
            )}
          </>
        );

        if (empTier === "mobile") {
          // Telemóvel (<640): barra inferior fixa (Início·Horas·Agenda·
          // Avisos·Mais) substitui por completo o antigo EmployeeMenuScreen
          // (lista de botões sem casca nenhuma) — em Horas ela já dá lugar
          // à BottomActionBar do próprio ecrã (5.2.6), como sempre foi.
          const iconByKey = Object.fromEntries(SUPERVISOR_MENU_ITEMS.map((it) => [it.key, it.icon]));
          const bottomItems = [
            { key: "menu", icon: iconByKey.menu, label: tSidebar.menu },
            { key: "horas", icon: iconByKey.horas, label: tSidebar.horas },
            { key: "agenda", icon: iconByKey.agenda, label: tSidebar.agenda },
            { key: "avisos", icon: iconByKey.avisos, label: tSidebar.avisos, badge: c.myUnreadBadge },
            { key: "mais", icon: MoreHorizontal, label: T[c.lang].common.more },
          ];
          const moreItems = [
            { key: "clientes", icon: iconByKey.clientes, label: tSidebar.clientes, onSelect: () => c.setEmpScreen("clientes") },
            { key: "historico", icon: iconByKey.historico, label: tSidebar.historico, onSelect: () => c.setEmpScreen("historico") },
            { key: "notas", icon: iconByKey.notas, label: tSidebar.notas, onSelect: () => c.setEmpScreen("notas") },
            ...(isSupervisor ? [{
              key: "monitoramento", icon: iconByKey.monitoramento, label: tSidebar.monitoramento,
              // Selo do nº de funcionários com dias em falta — só aqui na
              // folha "Mais" (comentário do próprio MoreSheet.jsx), não na
              // sidebar/rail principal, que o documento (3.1) só dá selo a
              // Avisos.
              // QA pós-auditoria (Lote 2): `staffWithGapsCount` passou a devolver
              // { staffCount, totalDays } — este selo continua a ser a
              // contagem de FUNCIONÁRIOS, não de dias.
              badge: staffWithGapsCount(
                c.staff, c.horasData, c.clients, c.assignments,
                getOpenPeriod(c.closedPeriods, c.cutoffDay, TODAY),
                weekBlocksOfPayPeriod(getOpenPeriod(c.closedPeriods, c.cutoffDay, TODAY), c.cutoffDay),
                c.cutoffDay, TODAY
              ).staffCount || undefined,
              onSelect: () => c.setEmpScreen("monitoramento"),
            }] : []),
            // Lote 4, 4.2 (achado da Marta): no celular o "Sair" não existia
            // em lugar nenhum — último item da folha, sempre (o nome de
            // quem entrou vai no cabeçalho da folha, via prop `user` do
            // MoreSheet, não aqui). `logout: true` tira a seta (não é
            // navegação) no MoreSheet.jsx.
            { key: "logout", icon: LogOut, label: T[c.lang].common.logout, logout: true, onSelect: () => c.logout() },
          ];
          // QA (achado do Iago): "em horas o menu em baixo desapare, quero
          // que fique fixo e aparece nessa tela tambem, deve esta igual
          // para funcionario" — era `hideBottomBar = c.empScreen === "horas"`,
          // que tirava a `MobileBottomBar` de navegação inteira nessa tela
          // (decisão antiga do próprio componente, ver comentário em
          // MobileBottomBar.jsx: "substituída" pela `BottomActionBar" do
          // ecrã). O Iago pediu o contrário agora — as duas convivem: a
          // `BottomActionBar` do ecrã (total do dia + "Finalizar dia")
          // continua exatamente igual (ela mesma decide quando aparece,
          // ver EmployeeHorasScreen.jsx), e por baixo dela a barra de
          // navegação normal, igual a todo o resto do app. Sem `if`
          // nenhum: supervisor e funcionário já passam pelo mesmo ramo
          // (`empTier === "mobile"`) aqui, então os dois ganham o mesmo
          // comportamento automaticamente.
          // Sem padding aqui: a `pageStyle` do topo do App já dá os 14px de
          // margem em telemóvel (igual já dava a todos estes ecrãs antes
          // desta casca existir) — só acrescento espaço por baixo pra não
          // ficar tapado pela barra inferior fixa.
          return (
            <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, paddingBottom: 8 }}>
                {body}
              </div>
              <MobileBottomBar
                activeKey={c.empScreen === "mais" ? "" : c.empScreen}
                onNavigate={(key) => (key === "mais" ? setMoreSheetOpen(true) : c.setEmpScreen(key))}
                items={bottomItems}
              />
              <MoreSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} items={moreItems} user={{ name: c.me.name }} />
            </div>
          );
        }

        // Tablet (640-1023, "rail" de 108px — variante nova, nunca usada
        // antes pra este lado) e PC (≥1024, sidebar completa de 236px).
        return (
          <div style={styles.shell}>
            <AppSidebar
              items={sidebarItems} activeKey={c.empScreen} onNavigate={c.setEmpScreen}
              density="supervisor" collapsed={empTier === "tablet" ? "rail" : false}
              user={{ name: c.me.name, subtitle: isSupervisor ? T[c.lang].acessos.roleSupervisor : undefined }}
              onLogout={c.logout} logoutLabel={T[c.lang].common.logout}
            />
            <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", padding: "24px 24px 40px" }}>
              {body}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
