// Tutorial de primeiro acesso: textos dos cartões (pt/en/fr), por perfil.
// Perfis: manager (gerência), supervisor, employee (funcionário). O desenho é do Tomás
// (17 cartões); as frases são as do guião. Os textos dentro das ilustrações (SVG) são
// trocados por idioma com ILLUS (chave = texto em português do desenho).

export const TUTORIAL_UI = {
  pt: { skip: "Saltar", prev: "Anterior", next: "Seguinte", start: "Começar", label: "Tutorial de boas-vindas", hello: "Olá", step: (i, n) => `Cartão ${i} de ${n}`, review: "Rever tutorial", reviewHint: "Os cartões de boas-vindas, outra vez." },
  en: { skip: "Skip", prev: "Back", next: "Next", start: "Get started", label: "Welcome tutorial", hello: "Hello", step: (i, n) => `Card ${i} of ${n}`, review: "Review tutorial", reviewHint: "The welcome cards, once more." },
  fr: { skip: "Passer", prev: "Précédent", next: "Suivant", start: "Commencer", label: "Tutoriel de bienvenue", hello: "Bonjour", step: (i, n) => `Carte ${i} sur ${n}`, review: "Revoir le tutoriel", reviewHint: "Les cartes de bienvenue, encore une fois." },
};

const HELP_LAST = {
  pt: "Toque em ? (ou em Mais > Ajuda no telemóvel) para ver como funciona ou pedir apoio. Pode rever este tutorial aí.",
  en: "Tap ? (or More > Help on your phone) to see how things work or ask for support. You can review this tutorial there.",
  fr: "Touchez ? (ou Plus > Aide sur le téléphone) pour voir comment ça marche ou demander de l'aide. Vous pouvez y revoir ce tutoriel.",
};

export const TUTORIAL_SLIDES = {
  pt: {
    manager: [
      { title: "Bem-vindo ao Servix", body: "Clientes, horas e equipa num só sítio. Em um minuto mostramos o essencial." },
      { title: "O Dashboard", body: "O resumo da empresa: quanto entra, quanto sai e a margem. Em Pendências vê o que precisa da sua decisão." },
      { title: "Clientes, Contratantes e Agendas", body: "Crie os clientes, diga quem paga cada um (Contratantes) e quem o faz em cada dia (Agendas)." },
      { title: "Horas", body: "Os funcionários registam o dia. A gerência aprova o extra, resolve as dúvidas e fecha o período. Em Monitoramento vê quem ainda não preencheu." },
      { title: "Acessos", body: "Crie o login de cada pessoa em Acessos. No primeiro acesso, cada uma escolhe a sua palavra-passe." },
      { title: "Precisa de ajuda?", body: "Em qualquer página, toque em ? para ver como funciona ou pedir apoio. Pode rever este tutorial no Ajuda." },
    ],
    supervisor: [
      { title: "Bem-vindo ao Servix", body: "Tem as ferramentas de funcionário e mais algumas para acompanhar a equipa." },
      { title: "O seu dia", body: "No Início vê os clientes de hoje, quanto já registou na semana e o que precisa da sua atenção." },
      { title: "Registar as horas", body: "Marque os clientes que fez, finalize o dia e, no fim, a semana e o mês." },
      { title: "A sua equipa", body: "Em Monitoramento vê quem está em dia e quem tem dias em falta, e pode lembrar essa pessoa. Em Avisos pode reportar um elogio ou um problema sobre um colega." },
      { title: "Precisa de ajuda?", body: HELP_LAST.pt },
    ],
    employee: [
      { title: "Bem-vindo ao Servix", body: "Aqui vê os seus clientes, regista as horas e vê quanto vai receber." },
      { title: "O seu dia", body: "No Início vê os clientes de hoje, quanto já registou na semana e o que lhe falta fazer." },
      { title: "Registar as horas", body: "Em Horas, marque os clientes que fez e finalize o dia. No fim da semana, finalize a semana; no fim do período, o mês." },
      { title: "Agenda e Clientes", body: "Na Agenda vê os clientes de cada dia. Toque num cliente para ver o endereço e as instruções e abri-lo no mapa." },
      { title: "Avisos", body: "Vai faltar? Use Avisar falta. Falta produto ou há um problema no local? Envie um aviso, com foto se quiser. A resposta da gerência chega aqui." },
      { title: "Precisa de ajuda?", body: HELP_LAST.pt },
    ],
  },
  en: {
    manager: [
      { title: "Welcome to Servix", body: "Clients, hours and team in one place. In one minute we'll show you the essentials." },
      { title: "The Dashboard", body: "The company overview: what comes in, what goes out and the margin. In Pending items you see what needs your decision." },
      { title: "Clients, Contractors and Schedules", body: "Create the clients, say who pays for each one (Contractors) and who does it each day (Schedules)." },
      { title: "Hours", body: "Staff log their day. Management approves the extra, sorts out doubts and closes the period. In Monitoring you see who hasn't filled in yet." },
      { title: "Access", body: "Create each person's login in Access. On first login, each person picks their own password." },
      { title: "Need help?", body: "On any page, tap ? to see how things work or ask for support. You can review this tutorial in Help." },
    ],
    supervisor: [
      { title: "Welcome to Servix", body: "You have the staff tools plus a few more to keep track of the team." },
      { title: "Your day", body: "On Home you see today's clients, how much you've logged this week and what needs your attention." },
      { title: "Log your hours", body: "Mark the clients you did, finish the day and, at the end, the week and the month." },
      { title: "Your team", body: "In Monitoring you see who is up to date and who has missing days, and you can remind them. In Notices you can report praise or a problem about a colleague." },
      { title: "Need help?", body: HELP_LAST.en },
    ],
    employee: [
      { title: "Welcome to Servix", body: "Here you see your clients, log your hours and see how much you will receive." },
      { title: "Your day", body: "On Home you see today's clients, how much you've logged this week and what is left to do." },
      { title: "Log your hours", body: "In Hours, mark the clients you did and finish the day. At the end of the week, finish the week; at the end of the period, the month." },
      { title: "Schedule and Clients", body: "In Schedule you see each day's clients. Tap a client to see the address and instructions and open it on the map." },
      { title: "Notices", body: "Going to be absent? Use Report absence. Missing product or a problem on site? Send a notice, with a photo if you like. Management's reply arrives here." },
      { title: "Need help?", body: HELP_LAST.en },
    ],
  },
  fr: {
    manager: [
      { title: "Bienvenue sur Servix", body: "Clients, heures et équipe au même endroit. En une minute, nous vous montrons l'essentiel." },
      { title: "Le tableau de bord", body: "Le résumé de l'entreprise : ce qui rentre, ce qui sort et la marge. Dans Points en attente, vous voyez ce qui attend votre décision." },
      { title: "Clients, Donneurs d'ordre et Plannings", body: "Créez les clients, indiquez qui paie chacun (Donneurs d'ordre) et qui le fait chaque jour (Plannings)." },
      { title: "Heures", body: "Les employés saisissent leur journée. La direction approuve les heures en plus, règle les doutes et clôture la période. Dans Surveillance, vous voyez qui n'a pas encore rempli." },
      { title: "Accès", body: "Créez le login de chaque personne dans Accès. À la première connexion, chacun choisit son mot de passe." },
      { title: "Besoin d'aide ?", body: "Sur n'importe quelle page, touchez ? pour voir comment ça marche ou demander de l'aide. Vous pouvez revoir ce tutoriel dans Aide." },
    ],
    supervisor: [
      { title: "Bienvenue sur Servix", body: "Vous avez les outils d'employé et quelques-uns de plus pour suivre l'équipe." },
      { title: "Votre journée", body: "Dans Accueil, vous voyez les clients du jour, combien vous avez saisi cette semaine et ce qui demande votre attention." },
      { title: "Saisir les heures", body: "Cochez les clients faits, finalisez la journée et, à la fin, la semaine et le mois." },
      { title: "Votre équipe", body: "Dans Surveillance, vous voyez qui est à jour et qui a des jours manquants, et vous pouvez le lui rappeler. Dans Avis, vous pouvez signaler un compliment ou un problème sur un collègue." },
      { title: "Besoin d'aide ?", body: HELP_LAST.fr },
    ],
    employee: [
      { title: "Bienvenue sur Servix", body: "Ici, vous voyez vos clients, saisissez vos heures et voyez ce que vous allez recevoir." },
      { title: "Votre journée", body: "Dans Accueil, vous voyez les clients du jour, combien vous avez saisi cette semaine et ce qu'il vous reste à faire." },
      { title: "Saisir les heures", body: "Dans Heures, cochez les clients faits et finalisez la journée. En fin de semaine, finalisez la semaine ; en fin de période, le mois." },
      { title: "Planning et Clients", body: "Dans Planning, vous voyez les clients de chaque jour. Touchez un client pour voir l'adresse et les consignes et l'ouvrir sur la carte." },
      { title: "Avis", body: "Absent ? Utilisez Signaler une absence. Produit manquant ou problème sur place ? Envoyez un avis, avec photo si vous voulez. La réponse de la direction arrive ici." },
      { title: "Besoin d'aide ?", body: HELP_LAST.fr },
    ],
  },
};

// Textos dentro das ilustrações (chave = português do desenho). O que não está aqui
// (nomes, números, horas, morada) fica igual em todos os idiomas.
export const ILLUS = {
  en: {
    "Funcionário": "Staff", "Gerência": "Management", "Supervisor": "Supervisor", "Funcionários": "Staff",
    "Horas": "Hours", "Agenda": "Schedule", "Clientes": "Clients", "Hoje": "Today",
    "1 de 5 feitos": "1 of 5 done", "5 clientes · 9h30 previstos": "5 clients · 9h30 planned",
    "Próximo: Cliente 29 · 2h30": "Next: Client 29 · 2h30", "Registar horas": "Log hours",
    "Precisa da sua atenção": "Needs your attention", "Dias por registar (14)": "Days to log (14)",
    "desde segunda-feira, 21/09": "since Monday, 21/09", "Aviso por ler (1)": "Unread notice (1)", "da gerência": "from management",
    "Esta semana": "This week", "Segunda, 26/10": "Monday, 26/10", "Finalizar dia": "Finish day",
    "Dia": "Day", "Semana": "Week", "Mês": "Month", "SEG": "MON", "TER": "TUE",
    "Cliente 29": "Client 29", "Cliente 12": "Client 12", "Cliente 7": "Client 7",
    "Limpeza geral · atenção às casas de banho": "General cleaning · mind the bathrooms",
    "Abrir no mapa": "Open on map", "Avisar falta": "Report absence", "+ Novo aviso": "+ New notice",
    "Os meus avisos": "My notices", "Falta de produto": "Missing product", "Cliente 29 · com foto": "Client 29 · with photo",
    "Resposta da gerência": "Reply from management", "Obrigado pelo aviso!": "Thanks for the notice!",
    "Já mandámos o produto para": "We've already sent the product for", "amanhã de manhã.": "tomorrow morning.", "Resolvido": "Resolved",
    "No PC": "On PC", "Histórico": "History", "Notas": "Notes", "Ajuda": "Help", "Instalar a app": "Install the app", "Sair": "Log out",
    "Início": "Home", "Avisos": "Notices", "Mais": "More", "No telemóvel: Mais › Ajuda": "On phone: More › Help",
    "Bem-vindo ao Servix": "Welcome to Servix", "Resultado": "Result", "21 Set – 20 Out": "21 Sep – 20 Oct",
    "A receber": "To receive", "Margem": "Margin", "22% do que se recebe": "22% of what is received",
    "Pendências": "Pending items", "Visitas por conferir": "Visits to check", "Meses por fechar": "Months to close",
    "Contratos vencidos": "Expired contracts", "Toque aqui": "Tap here", "27 clientes · 13 cidades": "27 clients · 13 cities",
    "Contratantes": "Contractors", "Quem paga cada um": "Who pays for each", "Agendas": "Schedules", "Quem faz, em cada dia": "Who does it, each day",
    "preenchido": "filled in", "em falta": "missing", "3 pendências por ver": "3 pending to check",
    "Acessos": "Access", "+ Criar acesso": "+ Create access", "Cada pessoa escolhe a sua palavra-passe": "Each person picks their own password",
    "Como funciona": "How it works", "Reportar um problema": "Report a problem", "Rever tutorial": "Review tutorial",
    "Ferramentas de funcionário": "Staff tools", "Monitoramento": "Monitoring", "+ acompanhar a equipa": "+ follow the team",
    "Dias em falta na equipa (133)": "Missing days in team (133)", "12 funcionários com dias em falta": "12 staff with missing days",
    "Em dia": "Up to date", "3 dias em falta": "3 days missing", "1 dia em falta": "1 day missing", "Lembrar": "Remind",
  },
  fr: {
    "Funcionário": "Employé", "Gerência": "Direction", "Supervisor": "Superviseur", "Funcionários": "Employés",
    "Horas": "Heures", "Agenda": "Planning", "Clientes": "Clients", "Hoje": "Aujourd'hui",
    "1 de 5 feitos": "1 sur 5 faits", "5 clientes · 9h30 previstos": "5 clients · 9h30 prévues",
    "Próximo: Cliente 29 · 2h30": "Suivant : Client 29 · 2h30", "Registar horas": "Saisir les heures",
    "Precisa da sua atenção": "À votre attention", "Dias por registar (14)": "Jours à saisir (14)",
    "desde segunda-feira, 21/09": "depuis lundi 21/09", "Aviso por ler (1)": "Avis non lu (1)", "da gerência": "de la direction",
    "Esta semana": "Cette semaine", "Segunda, 26/10": "Lundi 26/10", "Finalizar dia": "Finaliser la journée",
    "Dia": "Jour", "Semana": "Semaine", "Mês": "Mois", "SEG": "LUN", "TER": "MAR",
    "Cliente 29": "Client 29", "Cliente 12": "Client 12", "Cliente 7": "Client 7",
    "Limpeza geral · atenção às casas de banho": "Nettoyage général · salles de bain",
    "Abrir no mapa": "Ouvrir sur la carte", "Avisar falta": "Signaler une absence", "+ Novo aviso": "+ Nouvel avis",
    "Os meus avisos": "Mes avis", "Falta de produto": "Produit manquant", "Cliente 29 · com foto": "Client 29 · avec photo",
    "Resposta da gerência": "Réponse de la direction", "Obrigado pelo aviso!": "Merci pour l'avis !",
    "Já mandámos o produto para": "Nous avons déjà envoyé le produit", "amanhã de manhã.": "pour demain matin.", "Resolvido": "Réglé",
    "No PC": "Sur PC", "Histórico": "Historique", "Notas": "Notes", "Ajuda": "Aide", "Instalar a app": "Installer l'app", "Sair": "Se déconnecter",
    "Início": "Accueil", "Avisos": "Avis", "Mais": "Plus", "No telemóvel: Mais › Ajuda": "Sur téléphone : Plus › Aide",
    "Bem-vindo ao Servix": "Bienvenue sur Servix", "Resultado": "Résultat", "21 Set – 20 Out": "21 sept. – 20 oct.",
    "A receber": "À recevoir", "Margem": "Marge", "22% do que se recebe": "22 % de ce qui est reçu",
    "Pendências": "En attente", "Visitas por conferir": "Visites à vérifier", "Meses por fechar": "Mois à clôturer",
    "Contratos vencidos": "Contrats expirés", "Toque aqui": "Touchez ici", "27 clientes · 13 cidades": "27 clients · 13 villes",
    "Contratantes": "Donneurs d'ordre", "Quem paga cada um": "Qui paie chacun", "Agendas": "Plannings", "Quem faz, em cada dia": "Qui le fait, chaque jour",
    "preenchido": "rempli", "em falta": "manquant", "3 pendências por ver": "3 à vérifier",
    "Acessos": "Accès", "+ Criar acesso": "+ Créer un accès", "Cada pessoa escolhe a sua palavra-passe": "Chacun choisit son mot de passe",
    "Como funciona": "Comment ça marche", "Reportar um problema": "Signaler un problème", "Rever tutorial": "Revoir le tutoriel",
    "Ferramentas de funcionário": "Outils d'employé", "Monitoramento": "Surveillance", "+ acompanhar a equipa": "+ suivre l'équipe",
    "Dias em falta na equipa (133)": "Jours manquants équipe (133)", "12 funcionários com dias em falta": "12 employés avec jours manquants",
    "Em dia": "À jour", "3 dias em falta": "3 jours manquants", "1 dia em falta": "1 jour manquant", "Lembrar": "Rappeler",
  },
};

// Iniciais dos dias da semana nas faixas (seg → dom).
export const WEEKDAY_INITIALS = {
  pt: ["S", "T", "Q", "Q", "S", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  fr: ["L", "M", "M", "J", "V", "S", "D"],
};
