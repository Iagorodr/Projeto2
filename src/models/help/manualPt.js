// Manuais das páginas da gerência (pt). Cada página: `summary` (para que serve), `means` (o que cada
// etiqueta/cor/botão significa: [termo, explicação]) e `howto` (tarefas comuns: { q, steps }).
// Só descreve o que existe no app — se mudares uma página, atualiza aqui e em manualEn/manualFr.
export const MANUAL_PT = {
  manager: {
    dashboard: {
      summary: "O resumo da empresa no período aberto (por defeito, do dia 21 ao dia 20). Mostra quanto entra, quanto sai e o que está à espera de uma decisão tua.",
      means: [
        ["Resultado · Estimativa", "Enquanto o período está aberto é uma estimativa. “A receber” (o que os contratantes pagam) menos “Funcionários” (o que se paga à equipa, com reembolsos) dá a Margem, em € e em % do que se recebe. Contratantes sem preço ficam fora da conta."],
        ["De onde vem · sem preço", "Mostra de que contratantes vem o que se recebe. “sem preço · fora da conta” avisa de contratantes ou clientes sem preço, que ficam fora do cálculo."],
        ["Pendências", "O que precisa de ti: horas extra por aprovar, clientes por confirmar, divisões de horas por rever, visitas por conferir, despesas por aprovar, avisos por ler, contratos a vencer ou vencidos… O número é a quantidade e a seta leva à página onde se resolve. “Em dia” = nada pendente."],
        ["Meses de contratantes por fechar", "Meses de contratantes que já terminaram e ainda não foram fechados (ou que foram reabertos). Fecha-os em Contratantes."],
        ["Destaques da equipa", "Top 5 por horas, com os elogios e as reclamações de cada um. Mostra os últimos períodos fechados ou o período aberto em tempo real, conforme o definido em Definições."],
        ["Clientes por cidade", "Mapa da Bélgica e lista com quantos clientes há em cada cidade. Clientes sem cidade válida aparecem num aviso para corrigires."],
        ["Reclamações (medidor)", "Excelente, Razoável ou Crítico, conforme o número de reclamações do mês face aos limites que definiste em Definições."],
        ["Evolução", "Gráfico de horas ou de € por período (botão € / Horas), com a média a tracejado e a variação face ao período anterior."],
        ["Notas", "Os teus lembretes com data. Também mostra os próximos feriados belgas (etiqueta “Feriado”), só como lembrete: não mexem na agenda."],
        ["Faixa “Período terminado”", "Depois do fim do período há um prazo (Definições) para o finalizar. Passado o prazo, o Dashboard e os lançamentos ficam bloqueados até fechares o período em Horas."],
      ],
      howto: [
        { q: "Como vejo se o mês está a correr bem?", steps: ["Olha para o cartão Resultado: a margem estimada.", "Vê as Pendências: tudo o que tem número é trabalho por fazer.", "Carrega na seta de uma pendência para ir direto resolvê-la."] },
      ],
    },
    clientes: {
      summary: "A lista dos clientes ativos, com contrato, equipa e horas do período. Abre um cliente para ver e editar a ficha completa.",
      means: [
        ["Horas no período (barra)", "Horas feitas / horas previstas até hoje, segundo a agenda e os dados do cliente. “Em dia”, “Atrasado Xh” ou “Acima +Xh” diz se está dentro do previsto. “Sem visitas previstas” = o cliente não está na agenda de ninguém."],
        ["Contrato a acabar · Expirado", "Etiqueta quando faltam poucos dias para o fim do contrato (o aviso configura-se em Definições) ou quando já passou."],
        ["Equipa", "Quem tem este cliente na agenda. “+N” = há mais pessoas."],
        ["Fixo · Replacement", "Fixo é um cliente normal. Replacement é temporário e precisa de data de início e de fim."],
        ["Frequência", "Semanal, quinzenal, mensal ou dia sim, dia não. Decide em que semanas e dias a visita aparece na agenda."],
        ["Contabilização das horas", "“Dividida entre a equipa”: as horas do cliente repartem-se por quem lá trabalha. “Individual”: cada um regista a duração completa."],
        ["Contratante", "Quem paga as horas deste cliente (cria-se em Contratantes). O valor/hora vem preenchido com o padrão do contratante, mas podes mudá-lo."],
        ["Documentos", "Contrato, comprovativo do local, seguro/licença… ficam num cofre privado que só a gerência vê (até 10 MB cada)."],
        ["Reclamações e elogios", "Histórico por ano, guardado a partir dos avisos enviados."],
      ],
      howto: [
        { q: "Como crio um cliente?", steps: ["Carrega em Novo cliente.", "Preenche nome, tipo, cidade (escolhe uma da lista), endereço e contacto.", "Define o contrato, as horas por mês, o valor/hora e a duração da visita.", "Escolhe os dias da semana, a frequência e o contratante.", "Guarda. Para alguém o passar a fazer, adiciona-o à agenda em Agendas."] },
        { q: "Mudei a duração de um cliente. E as horas já marcadas?", steps: ["Ao guardar, o app pergunta se queres aplicar às marcações do período aberto.", "Quem já foi pago não é mexido.", "Mais tarde também podes usar Horas → Recalcular horas."] },
        { q: "Como envio os dados de um cliente a alguém?", steps: ["Abre a ficha do cliente e carrega em Copiar dados.", "Escolhe se incluis a observação (código, chave…) e copia o texto.", "Cola-o no WhatsApp, SMS ou email."] },
        { q: "Como elimino clientes?", steps: ["Seleciona um ou vários e carrega em Eliminar.", "Saem também das agendas. O histórico de períodos já fechados não é afetado."] },
      ],
    },
    contratantes: {
      summary: "Os contratantes são quem paga à empresa pelas horas feitas nos clientes. Aqui defines quanto paga cada um, o ciclo do relatório e fechas o mês de cada um.",
      means: [
        ["Paga por hora · Paga ao funcionário", "O que o contratante paga por hora e o que se paga ao funcionário (padrão para clientes novos). A diferença é a margem por hora."],
        ["Direto · Preço por cliente", "Clientes diretos não têm contratante: cada cliente tem o seu preço, definido na ficha do cliente."],
        ["Faturação · Pagamento", "O dia do mês em que se fatura e o prazo (em dias) para o pagamento, contado a partir do fim do período."],
        ["Período do relatório", "Por defeito é o geral (dia 21 a 20, todos os meses). Podes dar a um contratante um período próprio: outros dias, ou repetir a cada 2 ou mais meses."],
        ["Estados do mês", "Em curso (período ainda aberto) · Por fechar (terminou e falta fechar) · Fechado (valores congelados) · Reaberto (voltou a poder mudar) · Sem horas."],
        ["Falta o valor/hora", "Sem preço, o contratante não entra no total “a receber” do Dashboard."],
        ["Cor", "Cada contratante tem uma cor fixa nos gráficos."],
      ],
      howto: [
        { q: "Como crio um contratante?", steps: ["Carrega em Novo contratante.", "Escreve o nome e o valor/hora que paga e o que se paga ao funcionário.", "Define o dia de faturação e o prazo de pagamento.", "Guarda. Depois escolhe-o na ficha de cada cliente."] },
        { q: "Como fecho o mês de um contratante?", steps: ["Abre o contratante e vai a Meses → Fechar mês.", "O assistente tem 4 passos: Rever (pendências), Cruzar, Anexar (documentos) e Fechar.", "Depois de fechado os valores ficam congelados.", "Para corrigir, usa Reabrir (pede um motivo)."] },
        { q: "Como baixo o relatório de horas em PDF?", steps: ["Abre o contratante → Relatórios de horas.", "Carrega em Ver relatório e depois em Baixar PDF.", "O relatório mostra, por cliente, quantas visitas foram feitas, as horas e quem as fez (sem datas)."] },
        { q: "Apareceu “N clientes sem contratante”.", steps: ["A origem escrita nesses clientes não bate com nenhum contratante.", "Escolhe o contratante de cada um na própria lista."] },
      ],
    },
    agendas: {
      summary: "A semana tipo de cada funcionário: que clientes faz em cada dia. Repete-se todas as semanas até mudares.",
      means: [
        ["Por funcionário · Por dia", "Duas vistas: uma linha por funcionário com os 7 dias, ou um dia de cada vez com os clientes e quem os faz."],
        ["Duração e total", "Cada cliente mostra a duração da visita. Por baixo do nome do funcionário vês as horas da semana dele."],
        ["Laranja · Compartilhado", "2 ou mais pessoas no mesmo cliente no mesmo dia: viram equipa e a duração divide-se entre elas (o selo mostra quantas)."],
        ["Cores de frequência", "A legenda no topo explica: violeta = cliente quinzenal, azul = mensal, âmbar = dia sim, dia não. O ícone de setas também marca os quinzenais e mensais."],
        ["Ausente · Sem cobertura", "“Ausente”: o funcionário avisou que falta. “Sem cobertura”: clientes de quem avisou e que ainda não têm outra pessoa nesse dia."],
        ["Hoje", "O dia de hoje fica destacado na semana."],
        ["“a cobrir X” · “coberto por Y”", "O cliente está numa cobertura de férias: temporariamente feito por outra pessoa."],
      ],
      howto: [
        { q: "Como ponho um cliente na agenda de alguém?", steps: ["Passa o rato pelo dia do funcionário (no telemóvel, toca nele) e carrega no + tracejado que aparece.", "Pesquisa o cliente e escolhe-o."] },
        { q: "Como acrescento ou tiro uma pessoa de um cliente?", steps: ["Carrega no cliente: abre “quem está no cliente”.", "Usa Adicionar para pôr outro funcionário, ou Remover para tirar."] },
        { q: "Como envio os clientes de alguém por mensagem?", steps: ["Por baixo do nome do funcionário carrega em Copiar clientes da semana… (na vista Por dia: Copiar clientes do dia…).", "Escolhe se queres incluir a observação (código, chave…): por defeito vai sem ela.", "Carrega em Copiar e cola no WhatsApp, SMS ou email."] },
        { q: "Como cubro as férias de alguém?", steps: ["Carrega em Cobertura de férias.", "Escolhe quem vai estar fora e as datas.", "Escolhe quem cobre (todos para uma pessoa, ou cliente a cliente) e carrega em Criar cobertura.", "No dia a seguir ao fim, os clientes voltam sozinhos ao dono."] },
        { q: "Alguém avisou que falta. O que faço?", steps: ["Aparece “Ausente” na agenda e nas Pendências.", "Passa os clientes dele a outra pessoa (cobertura ou agenda).", "Marca a falta como resolvida."] },
        { q: "Como abro a ficha de um cliente?", steps: ["Carrega no nome do cliente e escolhe Abrir ficha do cliente."] },
      ],
    },
    horas: {
      summary: "Onde confirmas as horas de cada funcionário, pagas e fechas o período. Cada pessoa regista as suas horas no telemóvel; aqui vês, corriges e aprovas.",
      means: [
        ["A pagar no período (cartão verde)", "O total a pagar à equipa no período aberto, com quantos estão pagos, por pagar e pendentes."],
        ["Pendente", "O funcionário ainda não finalizou o mês."],
        ["Por pagar", "O funcionário finalizou o mês. Falta tu pagares e marcares como pago."],
        ["Pago", "Pagamento marcado. As horas ficam bloqueadas: para corrigir, desfaz primeiro o pagamento."],
        ["Reaberto", "O mês foi reaberto para correção e a pessoa pode voltar a mexer nas horas."],
        ["Atenção (linha amarela)", "Pontos para ti: horas extra por aprovar, cliente por confirmar, divisão para rever ou conflito. O motivo aparece ao lado."],
        ["Extra · por aprovar", "Horas extra pedidas pelo funcionário, à espera da tua aprovação."],
        ["Cliente por confirmar", "O funcionário escreveu um cliente que não está na lista. Escolhe a que cliente corresponde."],
        ["Rever divisão", "A semana de alguém já estava fechada quando um colega marcou o mesmo cliente, e o número de pessoas mudou. Carrega em Dividir por igual para repartir as horas por todos."],
        ["Conflito · Sozinho", "Um funcionário diz que trabalhou sozinho e outro marcou o mesmo cliente. Até decidires, cada um fica com a sua parte dividida."],
        ["Anulada", "Linha anulada: não conta para as horas, mas podes repô-la."],
        ["Revisões (n)", "Compara, semana a semana, as visitas previstas na agenda com as registadas: visita feita noutro dia, visita extra, sem registo, horas diferentes… Nada muda sem a tua decisão."],
      ],
      howto: [
        { q: "Como pago a um funcionário?", steps: ["Abre o funcionário (só pode ser pago depois de ele finalizar o mês).", "Carrega em Marcar como pago e confirma a data e o total.", "Só confirmes se já fizeste o pagamento: o mês dele fica bloqueado."] },
        { q: "Como fecho o período?", steps: ["Fechar período só fica disponível quando todos estão Pagos (e as despesas aprovadas).", "Ao fechar, o período vai para o Histórico e começa logo um novo, em branco.", "Isto não se desfaz."] },
        { q: "Como corrijo as horas de alguém?", steps: ["Abre o funcionário.", "Na linha, usa o lápis para mudar o cliente ou as horas, ou o X para anular.", "Se já está Pago: desmarca o pagamento ou usa Reabrir para correção."] },
        { q: "Como exporto?", steps: ["Exportar PDF (geral) no topo, para todos.", "Exportar PDF dentro de um funcionário, só para ele."] },
        { q: "Mudei a duração de um cliente. As horas antigas ficam erradas?", steps: ["Usa Recalcular horas: acerta os lançamentos deste período à duração atual.", "A divisão entre colegas e os minutos extra mantêm-se; quem já foi pago não entra."] },
      ],
    },
    monitoramento: {
      summary: "Mostra quem já preencheu as horas da semana e quem tem dias em aberto, para lembrares ou ajudares.",
      means: [
        ["Preenchido · Esqueceu de preencher · Ainda não chegou", "O estado de cada dia da semana: feito, dia que já passou e ficou vazio, ou dia que ainda não chegou."],
        ["Em dia · Com dias em falta", "Resumo no topo: quantos funcionários estão em dia e quantos têm dias em aberto."],
        ["Semana ok", "O funcionário já finalizou a semana."],
        ["Inativos e replacement", "Não aparecem nesta página."],
      ],
      howto: [
        { q: "Como lembro alguém?", steps: ["Carrega em Lembrar na linha do funcionário.", "Ele recebe um lembrete com quantos dias faltam e a linha fica “Lembrado”."] },
        { q: "Como preencho as horas por ele?", steps: ["Carrega em Preencher.", "O que registares fica marcado “pela gerência” e o funcionário pode reabrir a semana normalmente."] },
        { q: "Como vejo o extrato de alguém?", steps: ["Carrega no funcionário para ver o mês completo, ao vivo."] },
      ],
    },
    historico: {
      summary: "Todos os períodos já fechados, com horas, valor pago e ocorrências. Um período entra aqui quando o fechas em Horas.",
      means: [
        ["Valor pago · Horas", "O total pago à equipa e as horas trabalhadas nesse período, com a comparação face ao período anterior."],
        ["Reclamações · Elogios · Avisos · Pedidos", "Quantos houve no período e quantos foram resolvidos."],
      ],
      howto: [
        { q: "Como vejo o detalhe de um período?", steps: ["Carrega no período.", "Vês o resumo do mês, as ocorrências e as horas por funcionário (carrega num funcionário para ver dia a dia)."] },
        { q: "Como apago um período?", steps: ["Seleciona-o e carrega em Apagar.", "Tens de escrever APAGAR para confirmar.", "Perde-se de vez o registo de horas, valores e ocorrências, e o período sai dos gráficos. Não tem volta."] },
      ],
    },
    avisos: {
      summary: "A caixa de entrada da gerência: reclamações, elogios, avisos gerais e pedidos da equipa.",
      means: [
        ["Pedidos", "Pedidos da equipa, como a correção de horas de um período. Aprovar e reabrir período desbloqueia o mês desse funcionário."],
        ["Reclamações · Elogios · Avisos gerais", "O que a equipa (ou tu) registou sobre funcionários e clientes. Reclamações e elogios entram no histórico do cliente e nos destaques do Dashboard."],
        ["Selo no menu", "Conta só o que ainda não viste. Desaparece quando abres Avisos."],
        ["Período já fechado", "Aviso que pertence a um período que já foi fechado."],
      ],
      howto: [
        { q: "Como respondo a um pedido?", steps: ["Abre o pedido e carrega em Responder.", "Escreve a resposta e envia.", "Quando estiver tratado, marca como resolvido."] },
        { q: "Como crio um aviso?", steps: ["Carrega em Novo aviso.", "Escolhe o tipo (Reclamação, Elogio ou Aviso), o funcionário, o cliente e escreve o texto.", "Podes juntar uma foto e envia."] },
      ],
    },
    notas: {
      summary: "Os teus lembretes pessoais, com data.",
      means: [
        ["Hoje · Em atraso · Esta semana · Mais tarde", "As notas agrupam-se pela data. Em atraso = a data já passou."],
        ["Notificações", "Se as ativares neste aparelho, recebes o lembrete mesmo com o app fechado."],
      ],
      howto: [
        { q: "Como crio e apago uma nota?", steps: ["Escolhe a data, escreve o lembrete e carrega em Adicionar nota.", "Para apagar, usa o caixote: tens 5 segundos para Desfazer."] },
      ],
    },
    funcionarios: {
      summary: "A ficha de cada funcionário: dados, tipo de conta, clientes e documentos.",
      means: [
        ["Fixos · Replacement · Supervisores · Inativos", "Filtros no topo da lista. Replacement é uma conta temporária com data de validade."],
        ["Acaba em N dias · Expirou", "A validade de uma conta temporária. Conta expirada: prolonga a validade para a reativar."],
        ["Papel", "Funcionário, Supervisor ou Gerência supervisor (usa o ecrã de supervisor e pode alternar para a gerência)."],
        ["Vê todos os clientes", "Dá acesso à lista completa de clientes e não só aos da agenda dele."],
        ["Pode lançar despesas a reembolsar", "O funcionário lança, a gerência aprova. Entra no relatório dele, à parte das horas."],
        ["Parceiro (dupla)", "Com dupla, a agenda preenche-se pelos dois."],
        ["Clientes conhecidos", "Atalho: clientes que a pessoa faz de vez em quando aparecem logo no telemóvel dela. Não muda a agenda."],
        ["Data de início", "Vazio = desde o dia em que a conta foi criada. Põe uma data anterior se já trabalhava antes de entrar no app."],
        ["IBAN e documentos", "O IBAN aparece mascarado (Mostrar / Copiar). Cada documento tem o estado Em falta, Enviado ou Vencido e ficam num cofre privado, só da gerência."],
      ],
      howto: [
        { q: "Como crio um funcionário?", steps: ["Carrega em Novo Funcionário.", "Preenche o nome, um email real da pessoa, o contacto, o tipo de conta e o papel.", "Indica a data de início.", "No fim, carrega em Criar conta de acesso: copia a palavra-passe temporária, que não volta a aparecer."] },
        { q: "Como elimino um funcionário?", steps: ["Seleciona-o e carrega em Eliminar.", "Perdem-se as atribuições e as horas pendentes da semana atual. O histórico fechado não é afetado."] },
      ],
    },
    acessos: {
      summary: "Quem entra no app, com que email e com que papel.",
      means: [
        ["Funcionário", "Usa o app no telemóvel: horas, agenda, avisos."],
        ["Supervisor", "Como o funcionário, e vê também o Monitoramento."],
        ["Gerência supervisor", "Usa o ecrã de supervisor e pode alternar para a gerência."],
        ["Gerência", "Acesso total, incluindo pagamentos e palavras-passe."],
      ],
      howto: [
        { q: "Como redefino o acesso de alguém?", steps: ["Carrega em Redefinir e confirma.", "Copia logo a palavra-passe temporária: não aparece de novo.", "A pessoa escolhe a sua própria palavra-passe no primeiro login."] },
        { q: "Como mudo o papel ou o email?", steps: ["Abre a pessoa e muda o papel ou o email.", "Mudar o email muda também o login. Passar a Gerência pede confirmação."] },
      ],
    },
    definicoes: {
      summary: "Os dados e as regras da empresa. Está dividido em Perfil, Pagamento, Alertas e Zona de risco.",
      means: [
        ["Perfil · Dados da empresa", "Nome, foto e email de login (o email não se altera aqui). Morada, nº de empresa/IVA, IBAN e telefone aparecem no cabeçalho dos relatórios em PDF."],
        ["Dia de fechamento do período", "Um valor único para toda a empresa. Controla o relatório de pagamento em Horas e o corte automático de semana no registo do funcionário."],
        ["Alertas", "Quantos dias antes avisar de um contrato a vencer, os limites do medidor de reclamações, o prazo para finalizar o mês e como se calcula o Top 5 do Dashboard."],
        ["Zona de risco", "Alterar a palavra-passe da conta e Formatar dados."],
      ],
      howto: [
        { q: "Como mudo o dia de fecho?", steps: ["Em Pagamento, escolhe o novo dia e confirma.", "Muda o corte de todas as semanas e períodos futuros."] },
        { q: "O que faz Formatar dados?", steps: ["Apaga para sempre clientes, funcionários, horas, avisos e histórico.", "Tens de escrever FORMATAR. A conta de acesso da empresa não é afetada."] },
      ],
    },
  },
  staff: {},
};
