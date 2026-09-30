// Textos da interface do lado do funcionário (mobile). Ainda só em português.
import { WEEKDAY_FULL_PT } from "./data.js";
import { pad2 } from "./utils.js";

const EMP_T = {
  pt: {
    menu: { horas: "REGISTRAR HORAS", avisos: "AVISOS", agenda: "AGENDA", clientes: "CLIENTES", sair: "Sair", ola: "Olá" },
    switchToMgmt: "Ver como Gerência",
    horas: {
      subtitle: "Registar horas", boundaryBadge: "Semana de fecho do período", search: "Pesquisar cliente",
      selected: "Selecionados", empty: "Ainda sem clientes neste dia.", extraShort: "extra",
      extraTitle: "Horas extra", extraQuestion: "Quanto tempo a mais?", extraHint: "Isto fica marcado com * e visível para a gerência.",
      minutesUnit: "min", save: "Guardar", cancel: "Cancelar", remove: "Remover",
      finalizeDay: "Finalizar dia", daySaved: "Dia guardado", finalizeWeek: "Finalizar semana",
      weekTotal: "Total da semana", weekDoneTag: "Semana finalizada", periodTotal: "Total do período",
      lockedBody: "Os dados desta semana ficaram bloqueados e já não podem ser alterados.",
      confirmWeekTitle: "Finalizar a semana?", confirmWeekBody: "Depois disto já não vai poder editar nenhum dia. Só finalize quando tiver a certeza.",
      confirmYes: "Sim, finalizar", confirmNo: "Voltar atrás",
      missingDaysTitle: "Faltam dias por preencher", missingDaysBody: (list) => `Falta preencher: ${list}. Tem certeza que está tudo certo?`,
      sureNo: "Não", sureYes: "Sim, está tudo certo",
      which: (date) => `Que clientes fez ${WEEKDAY_FULL_PT[date.getDay()]}, ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}?`,
      weeksProgress: (done, total) => `${done} de ${total} semanas finalizadas neste período.`,
      monthDoneNote: "Período finalizado. Se algo estiver errado, pode solicitar correção.",
      finalizeMonth: "Finalizar mês", viewDetails: "Ver detalhes do mês",
      reviewTitleView: "Detalhes do período",
      requestCorrection: "Solicitar correção", correctionPlaceholder: "O que está errado ou faltando?",
      sendCorrection: "Enviar pedido", correctionSent: "Pedido enviado à gerência",
      close: "Fechar",
      finalizeMonthConfirmTitle: "Finalizar o mês?",
      finalizeMonthConfirmBody: "Todas as semanas já foram finalizadas. Depois disto só a gerência pode reabrir para correção.",
    },
    agenda: { title: "AGENDA", noClients: "Sem clientes neste dia", freq: { weekly: "toda semana", biweekly: "quinzenal", monthly: "mensal" } },
    clientes: { title: "MEUS CLIENTES", search: "Pesquisar Cliente", noResults: "Nenhum cliente encontrado", address: "Endereço", description: "Descrição", priorities: "Prioridades", note: "Observação", openMap: "Ver no mapa", noDetails: "Sem informações adicionais." },
    avisos: {
      title: "AVISOS", subject: "Assunto", subjectPlaceholder: "Escolha", client: "Cliente", clientPlaceholder: "Escolha",
      body: "Conte sobre o aviso..", send: "Enviar", sent: "Aviso enviado",
      complaints: "Reclamações", praiseSection: "Elogios", noticesSection: "Avisos gerais", sentSection: "Enviados por mim",
      readMore: "Ler mais", readLess: "Ler menos", noSent: "Ainda não enviou nenhum aviso.",
      subjects: ["Falta de produto", "Problema no local", "Outro"],
    },
  },
};

export { EMP_T };
