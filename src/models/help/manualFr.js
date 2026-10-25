// Manuels de la direction (fr). Même structure que manualPt.js — garder les trois langues synchronisées.
export const MANUAL_FR = {
  manager: {
    dashboard: {
      summary: "La vue d'ensemble de l'entreprise sur la période ouverte (par défaut, du 21 au 20). Elle montre ce qui rentre, ce qui sort et ce qui attend une décision de votre part.",
      means: [
        ["Résultat · Estimation", "Tant que la période est ouverte, c'est une estimation. « À recevoir » (ce que paient les donneurs d'ordre) moins « Employés » (ce qu'on paie à l'équipe, remboursements compris) donne la Marge, en € et en % de ce qui est reçu. Les donneurs d'ordre sans prix sont exclus du calcul."],
        ["D'où ça vient · sans prix", "Montre de quels donneurs d'ordre vient ce qui est reçu. « sans prix · hors calcul » signale des donneurs d'ordre ou des clients sans prix, exclus du calcul."],
        ["Points en attente", "Ce qui vous attend : heures sup à approuver, clients à confirmer, partages d'heures à revoir, visites à vérifier, dépenses à approuver, avis non lus, contrats bientôt échus ou échus… Le nombre est la quantité et la flèche mène à la page où on le règle. « À jour » = rien en attente."],
        ["Mois de donneurs d'ordre à clôturer", "Mois de donneurs d'ordre déjà terminés et pas encore clôturés (ou rouverts). Clôturez-les dans Donneurs d'ordre."],
        ["Temps forts de l'équipe", "Top 5 par heures, avec les compliments et les réclamations de chacun. Affiche les dernières périodes clôturées ou la période ouverte en temps réel, selon les Paramètres."],
        ["Clients par ville", "Carte de la Belgique et liste du nombre de clients par ville. Les clients sans ville valide apparaissent dans un avertissement à corriger."],
        ["Réclamations (jauge)", "Excellent, Raisonnable ou Critique, selon le nombre de réclamations du mois par rapport aux limites définies dans les Paramètres."],
        ["Évolution", "Graphique des heures ou des € par période (bouton € / Heures), avec la moyenne en pointillé et la variation par rapport à la période précédente."],
        ["Notes", "Vos rappels datés. Affiche aussi les prochains jours fériés belges (étiquette « Jour férié »), simplement comme rappel : ils ne modifient pas le planning."],
        ["Bandeau « Période terminée »", "Après la fin de la période, il y a un délai (Paramètres) pour la finaliser. Passé ce délai, le tableau de bord et les saisies sont bloqués jusqu'à la clôture de la période dans Heures."],
      ],
      howto: [
        { q: "Comment voir si le mois se passe bien ?", steps: ["Regardez la carte Résultat : la marge estimée.", "Consultez les points en attente : tout ce qui a un nombre est du travail à faire.", "Cliquez sur la flèche d'un point pour aller directement le régler."] },
      ],
    },
    clientes: {
      summary: "La liste des clients actifs, avec contrat, équipe et heures de la période. Ouvrez un client pour voir et modifier sa fiche complète.",
      means: [
        ["Heures de la période (barre)", "Heures faites / heures prévues jusqu'à aujourd'hui, selon le planning et les données du client. « À jour », « En retard Xh » ou « Au-dessus +Xh » indique si c'est dans le prévu. « Aucune visite prévue » = le client n'est dans le planning de personne."],
        ["Contrat bientôt échu · Expiré", "Une étiquette quand il reste peu de jours avant la fin du contrat (l'alerte se règle dans les Paramètres) ou quand il est déjà terminé."],
        ["Équipe", "Qui a ce client dans son planning. « +N » = il y a d'autres personnes."],
        ["Fixe · Remplacement", "Fixe est un client normal. Remplacement est temporaire et demande une date de début et de fin."],
        ["Fréquence", "Hebdomadaire, bimensuelle, mensuelle ou un jour sur deux. Elle décide dans quelles semaines et quels jours la visite apparaît au planning."],
        ["Comptage des heures", "« Partagées entre l'équipe » : les heures du client se répartissent entre ceux qui y travaillent. « Individuel » : chacun saisit la durée complète."],
        ["Donneur d'ordre", "Qui paie les heures de ce client (créé dans Donneurs d'ordre). Le tarif horaire est prérempli avec celui par défaut du donneur d'ordre, mais vous pouvez le modifier."],
        ["Documents", "Contrat, justificatif du lieu, assurance/licence… sont conservés dans un coffre privé visible uniquement par la direction (jusqu'à 10 Mo chacun)."],
        ["Réclamations et compliments", "Historique par année, conservé à partir des avis envoyés."],
      ],
      howto: [
        { q: "Comment créer un client ?", steps: ["Cliquez sur Nouveau client.", "Remplissez le nom, le type, la ville (choisissez-en une dans la liste), l'adresse et le contact.", "Définissez le contrat, les heures par mois, le tarif horaire et la durée de la visite.", "Choisissez les jours de la semaine, la fréquence et le donneur d'ordre.", "Enregistrez. Pour que quelqu'un s'en occupe, ajoutez-le au planning dans Plannings."] },
        { q: "J'ai changé la durée d'un client. Et les heures déjà saisies ?", steps: ["À l'enregistrement, l'app demande s'il faut l'appliquer aux saisies de la période ouverte.", "Les personnes déjà payées ne sont pas touchées.", "Plus tard, vous pouvez aussi utiliser Heures → Recalculer les heures."] },
        { q: "Comment envoyer les données d'un client à quelqu'un ?", steps: ["Ouvrez la fiche du client et cliquez sur Copier les infos.", "Choisissez d'inclure ou non la remarque (code, clé…) et copiez le texte.", "Collez-le dans WhatsApp, SMS ou e-mail."] },
        { q: "Comment supprimer des clients ?", steps: ["Sélectionnez-en un ou plusieurs et cliquez sur Supprimer.", "Ils disparaissent aussi des plannings. L'historique des périodes déjà clôturées n'est pas touché."] },
      ],
    },
    contratantes: {
      summary: "Les donneurs d'ordre sont ceux qui paient l'entreprise pour les heures faites chez les clients. Ici vous définissez ce que paie chacun, le cycle du rapport et clôturez le mois de chacun.",
      means: [
        ["Paie par heure · Paie l'employé", "Ce que le donneur d'ordre paie par heure et ce que l'on paie à l'employé (valeur par défaut pour les nouveaux clients). La différence est la marge par heure."],
        ["Direct · Prix par client", "Les clients directs n'ont pas de donneur d'ordre : chaque client a son propre prix, défini dans sa fiche."],
        ["Facturation · Paiement", "Le jour du mois où l'on facture et le délai de paiement (en jours), compté à partir de la fin de la période."],
        ["Période du rapport", "Par défaut, la période générale (du 21 au 20, chaque mois). Vous pouvez donner à un donneur d'ordre sa propre période : d'autres jours, ou une répétition tous les 2 mois ou plus."],
        ["États du mois", "En cours (période encore ouverte) · À clôturer (terminé, pas encore clôturé) · Clôturé (valeurs figées) · Rouvert (peut de nouveau changer) · Sans heures."],
        ["Tarif horaire manquant", "Sans prix, le donneur d'ordre n'est pas compté dans le total « à recevoir » du tableau de bord."],
        ["Couleur", "Chaque donneur d'ordre a une couleur fixe dans les graphiques."],
      ],
      howto: [
        { q: "Comment créer un donneur d'ordre ?", steps: ["Cliquez sur Nouveau donneur d'ordre.", "Saisissez le nom, le tarif horaire qu'il paie et ce que l'on paie à l'employé.", "Définissez le jour de facturation et le délai de paiement.", "Enregistrez. Choisissez-le ensuite dans la fiche de chaque client."] },
        { q: "Comment clôturer le mois d'un donneur d'ordre ?", steps: ["Ouvrez le donneur d'ordre puis Mois → Clôturer le mois.", "L'assistant a 4 étapes : Revoir (points en attente), Croiser, Joindre (documents) et Clôturer.", "Une fois clôturé, les valeurs sont figées.", "Pour corriger, utilisez Rouvrir (un motif est demandé)."] },
        { q: "Comment télécharger le rapport d'heures en PDF ?", steps: ["Ouvrez le donneur d'ordre → Rapports d'heures.", "Cliquez sur Voir le rapport puis sur Télécharger le PDF.", "Pour chaque client, le rapport indique combien de visites ont été faites, les heures et qui les a faites (sans dates)."] },
        { q: "« N clients sans donneur d'ordre » est apparu.", steps: ["L'origine écrite sur ces clients ne correspond à aucun donneur d'ordre.", "Choisissez le donneur d'ordre de chacun directement dans la liste."] },
      ],
    },
    agendas: {
      summary: "La semaine type de chaque employé : quels clients il fait chaque jour. Elle se répète chaque semaine jusqu'à ce que vous la changiez.",
      means: [
        ["Par employé · Par jour", "Deux vues : une ligne par employé avec les 7 jours, ou un jour à la fois avec les clients et ceux qui les font."],
        ["Durée et total", "Chaque client affiche la durée de la visite. Sous le nom de l'employé, vous voyez ses heures de la semaine."],
        ["Orange · Partagé", "2 personnes ou plus chez le même client le même jour : elles forment une équipe et la durée se partage entre elles (le badge indique combien)."],
        ["Couleurs de fréquence", "La légende en haut l'explique : violet = client bimensuel, bleu = mensuel, ambre = un jour sur deux. L'icône de flèches marque aussi les bimensuels et mensuels."],
        ["Absent · Sans couverture", "« Absent » : l'employé a signalé son absence. « Sans couverture » : clients de cette personne qui n'ont pas encore quelqu'un d'autre ce jour-là."],
        ["Aujourd'hui", "Le jour d'aujourd'hui est mis en évidence dans la semaine."],
        ["« couvre X » · « couvert par Y »", "Le client fait partie d'une couverture de vacances : temporairement fait par quelqu'un d'autre."],
      ],
      howto: [
        { q: "Comment mettre un client dans le planning de quelqu'un ?", steps: ["Passez la souris sur le jour de l'employé (sur téléphone, touchez-le) et cliquez sur le + en pointillé qui apparaît.", "Cherchez le client et choisissez-le."] },
        { q: "Comment ajouter ou retirer une personne d'un client ?", steps: ["Cliquez sur le client : « qui est chez le client » s'ouvre.", "Utilisez Ajouter pour mettre un autre employé, ou Retirer pour en enlever un."] },
        { q: "Comment envoyer les clients de quelqu'un par message ?", steps: ["Sous le nom de l'employé, cliquez sur Copier les clients de la semaine… (dans la vue Par jour : Copier les clients du jour…).", "Choisissez d'inclure ou non la remarque (code, clé…) : par défaut elle n'est pas incluse.", "Cliquez sur Copier et collez dans WhatsApp, SMS ou e-mail."] },
        { q: "Comment couvrir les vacances de quelqu'un ?", steps: ["Cliquez sur Remplacement de congés.", "Choisissez qui sera absent et les dates.", "Choisissez qui couvre (tout à une personne, ou client par client) et cliquez sur Créer le remplacement.", "Le lendemain de la fin, les clients reviennent tout seuls à leur titulaire."] },
        { q: "Quelqu'un a signalé une absence. Que faire ?", steps: ["« Absent » apparaît dans le planning et dans les points en attente.", "Passez ses clients à quelqu'un d'autre (couverture ou planning).", "Marquez l'absence comme réglée."] },
        { q: "Comment ouvrir la fiche d'un client ?", steps: ["Cliquez sur le nom du client et choisissez Ouvrir la fiche du client."] },
      ],
    },
    horas: {
      summary: "L'endroit où vous confirmez les heures de chaque employé, les payez et clôturez la période. Chacun saisit ses heures sur son téléphone ; ici vous vérifiez, corrigez et approuvez.",
      means: [
        ["À payer sur la période (carte verte)", "Le total à payer à l'équipe sur la période ouverte, avec le nombre de payés, à payer et en attente."],
        ["En attente", "L'employé n'a pas encore finalisé le mois."],
        ["À payer", "L'employé a finalisé le mois. Il reste à payer et à marquer comme payé."],
        ["Payé", "Paiement marqué. Les heures sont verrouillées : pour corriger, annulez d'abord le paiement."],
        ["Rouvert", "Le mois a été rouvert pour correction et la personne peut de nouveau modifier ses heures."],
        ["Attention (ligne jaune)", "Points pour vous : heures sup à approuver, client à confirmer, partage à revoir ou conflit. Le motif s'affiche à côté."],
        ["Extra · à approuver", "Heures supplémentaires demandées par l'employé, en attente de votre approbation."],
        ["Client à confirmer", "L'employé a saisi un client qui n'est pas dans la liste. Choisissez de quel client il s'agit."],
        ["Revoir le partage", "La semaine de quelqu'un était déjà clôturée quand un collègue a saisi le même client, et le nombre de personnes a changé. Cliquez sur Partager à parts égales pour répartir les heures entre tous."],
        ["Conflit · Seul", "Un employé dit avoir travaillé seul et un autre a saisi le même client. Tant que vous n'avez pas décidé, chacun garde sa part partagée."],
        ["Annulée", "Ligne annulée : elle ne compte pas dans les heures, mais vous pouvez la rétablir."],
        ["Vérifications (n)", "Compare, semaine par semaine, les visites prévues au planning avec celles saisies : visite faite un autre jour, visite en plus, sans saisie, heures différentes… Rien ne change sans votre décision."],
      ],
      howto: [
        { q: "Comment payer un employé ?", steps: ["Ouvrez l'employé (il ne peut être payé qu'après avoir finalisé le mois).", "Cliquez sur Marquer comme payé et confirmez la date et le total.", "Ne confirmez que si vous avez effectué le paiement : son mois est alors verrouillé."] },
        { q: "Comment clôturer la période ?", steps: ["Clôturer la période n'est disponible que lorsque tout le monde est Payé (et les dépenses approuvées).", "En clôturant, la période va dans l'Historique et une nouvelle, vide, commence aussitôt.", "Cela ne peut pas être annulé."] },
        { q: "Comment corriger les heures de quelqu'un ?", steps: ["Ouvrez l'employé.", "Sur la ligne, utilisez le crayon pour changer le client ou les heures, ou le X pour annuler.", "S'il est déjà Payé : annulez le paiement ou utilisez Rouvrir pour correction."] },
        { q: "Comment exporter ?", steps: ["Exporter en PDF (général) en haut, pour tout le monde.", "Exporter en PDF dans la fiche d'un employé, pour lui seul."] },
        { q: "J'ai changé la durée d'un client. Les anciennes heures sont-elles fausses ?", steps: ["Utilisez Recalculer les heures : elle ajuste les saisies de cette période à la durée actuelle.", "Le partage entre collègues et les minutes sup sont conservés ; les personnes déjà payées sont ignorées."] },
      ],
    },
    monitoramento: {
      summary: "Montre qui a déjà rempli les heures de la semaine et qui a des jours ouverts, pour relancer ou aider.",
      means: [
        ["Rempli · A oublié de remplir · Pas encore", "L'état de chaque jour de la semaine : fait, jour passé resté vide, ou jour pas encore arrivé."],
        ["À jour · Avec jours manquants", "Résumé en haut : combien d'employés sont à jour et combien ont des jours ouverts."],
        ["Semaine ok", "L'employé a déjà finalisé la semaine."],
        ["Inactifs et remplacement", "Ils n'apparaissent pas sur cette page."],
      ],
      howto: [
        { q: "Comment relancer quelqu'un ?", steps: ["Cliquez sur Relancer sur la ligne de l'employé.", "Il reçoit un rappel indiquant combien de jours manquent et la ligne affiche « Relancé »."] },
        { q: "Comment remplir les heures à sa place ?", steps: ["Cliquez sur Remplir.", "Ce que vous saisissez est marqué « par la direction » et l'employé peut rouvrir la semaine normalement."] },
        { q: "Comment voir le relevé de quelqu'un ?", steps: ["Cliquez sur l'employé pour voir le mois complet, en direct."] },
      ],
    },
    historico: {
      summary: "Toutes les périodes déjà clôturées, avec heures, montant payé et événements. Une période arrive ici quand vous la clôturez dans Heures.",
      means: [
        ["Montant payé · Heures", "Le total payé à l'équipe et les heures travaillées sur cette période, comparés à la période précédente."],
        ["Réclamations · Compliments · Avis · Demandes", "Combien il y en a eu sur la période et combien ont été réglés."],
      ],
      howto: [
        { q: "Comment voir le détail d'une période ?", steps: ["Cliquez sur la période.", "Vous voyez le résumé du mois, les événements et les heures par employé (cliquez sur un employé pour voir jour par jour)."] },
        { q: "Comment supprimer une période ?", steps: ["Sélectionnez-la et cliquez sur Supprimer.", "Vous devez saisir SUPPRIMER pour confirmer.", "Le relevé des heures, des montants et des événements est perdu définitivement et la période disparaît des graphiques. Il n'y a pas de retour en arrière."] },
      ],
    },
    avisos: {
      summary: "La boîte de réception de la direction : réclamations, compliments, avis généraux et demandes de l'équipe.",
      means: [
        ["Demandes", "Demandes de l'équipe, comme la correction des heures d'une période. Approuver et rouvrir la période déverrouille le mois de cet employé."],
        ["Réclamations · Compliments · Avis généraux", "Ce que l'équipe (ou vous) a enregistré sur des employés et des clients. Les réclamations et compliments vont dans l'historique du client et les temps forts du tableau de bord."],
        ["Pastille du menu", "Ne compte que ce que vous n'avez pas encore vu. Elle disparaît quand vous ouvrez Avis."],
        ["Période déjà clôturée", "Un avis qui appartient à une période déjà clôturée."],
      ],
      howto: [
        { q: "Comment répondre à une demande ?", steps: ["Ouvrez la demande et cliquez sur Répondre.", "Écrivez la réponse et envoyez-la.", "Quand c'est traité, marquez-la comme réglée."] },
        { q: "Comment créer un avis ?", steps: ["Cliquez sur Nouvel avis.", "Choisissez le type (Réclamation, Compliment ou Avis), l'employé, le client et écrivez le texte.", "Vous pouvez ajouter une photo, puis envoyer."] },
      ],
    },
    notas: {
      summary: "Vos rappels personnels, avec une date.",
      means: [
        ["Aujourd'hui · En retard · Cette semaine · Plus tard", "Les notes sont regroupées par date. En retard = la date est passée."],
        ["Notifications", "Si vous les activez sur cet appareil, vous recevez le rappel même avec l'app fermée."],
      ],
      howto: [
        { q: "Comment créer et supprimer une note ?", steps: ["Choisissez la date, écrivez le rappel et cliquez sur Ajouter une note.", "Pour supprimer, utilisez la corbeille : vous avez 5 secondes pour Annuler."] },
      ],
    },
    funcionarios: {
      summary: "La fiche de chaque employé : données, type de compte, clients et documents.",
      means: [
        ["Fixes · Remplacement · Superviseurs · Inactifs", "Filtres en haut de la liste. Remplacement est un compte temporaire avec une date de validité."],
        ["Fin dans N jours · Expiré", "La validité d'un compte temporaire. Compte expiré : prolongez la validité pour le réactiver."],
        ["Rôle", "Employé, Superviseur ou Direction superviseur (utilise l'écran superviseur et peut basculer vers la direction)."],
        ["Voit tous les clients", "Donne accès à la liste complète des clients et pas seulement à ceux de son planning."],
        ["Peut saisir des dépenses à rembourser", "L'employé saisit, la direction approuve. Cela va dans son rapport, à part des heures."],
        ["Partenaire (duo)", "Avec un duo, le planning se remplit pour les deux."],
        ["Clients connus", "Raccourci : les clients que la personne fait de temps en temps apparaissent tout de suite sur son téléphone. Cela ne change pas le planning."],
        ["Date de début", "Vide = depuis le jour de création du compte. Mettez une date antérieure si la personne travaillait avant d'entrer dans l'app."],
        ["IBAN et documents", "L'IBAN s'affiche masqué (Afficher / Copier). Chaque document a l'état Manquant, Envoyé ou Expiré et est conservé dans un coffre privé, réservé à la direction."],
      ],
      howto: [
        { q: "Comment créer un employé ?", steps: ["Cliquez sur Nouvel employé.", "Remplissez le nom, l'e-mail réel de la personne, le contact, le type de compte et le rôle.", "Indiquez la date de début.", "À la fin, cliquez sur Créer le compte d'accès : copiez le mot de passe temporaire, il ne s'affiche plus ensuite."] },
        { q: "Comment supprimer un employé ?", steps: ["Sélectionnez-le et cliquez sur Supprimer.", "Les attributions et les heures en attente de la semaine en cours sont perdues. L'historique clôturé n'est pas touché."] },
      ],
    },
    acessos: {
      summary: "Qui se connecte à l'app, avec quel e-mail et quel rôle.",
      means: [
        ["Employé", "Utilise l'app sur son téléphone : heures, planning, avis."],
        ["Superviseur", "Comme l'employé, et voit aussi la Surveillance."],
        ["Direction superviseur", "Utilise l'écran superviseur et peut basculer vers la direction."],
        ["Direction", "Accès total, y compris paiements et mots de passe."],
      ],
      howto: [
        { q: "Comment réinitialiser l'accès de quelqu'un ?", steps: ["Cliquez sur Réinitialiser et confirmez.", "Copiez tout de suite le mot de passe temporaire : il ne s'affiche plus.", "La personne choisit son propre mot de passe à la première connexion."] },
        { q: "Comment changer le rôle ou l'e-mail ?", steps: ["Ouvrez la personne et changez le rôle ou l'e-mail.", "Changer l'e-mail change aussi l'identifiant. Passer à Direction demande une confirmation."] },
      ],
    },
    definicoes: {
      summary: "Les données et les règles de l'entreprise. C'est divisé en Profil, Paiement, Alertes et Zone à risque.",
      means: [
        ["Profil · Données de l'entreprise", "Nom, photo et e-mail de connexion (l'e-mail ne se change pas ici). Adresse, n° d'entreprise/TVA, IBAN et téléphone apparaissent dans l'en-tête des rapports PDF."],
        ["Jour de clôture de la période", "Une valeur unique pour toute l'entreprise. Elle contrôle le rapport de paiement dans Heures et la coupure automatique de la semaine dans la saisie de l'employé."],
        ["Alertes", "Combien de jours à l'avance avertir d'un contrat qui se termine, les limites de la jauge de réclamations, le délai pour finaliser le mois et comment se calcule le Top 5 du tableau de bord."],
        ["Zone à risque", "Changer le mot de passe du compte et Formater les données."],
      ],
      howto: [
        { q: "Comment changer le jour de clôture ?", steps: ["Dans Paiement, choisissez le nouveau jour et confirmez.", "Cela change la coupure de toutes les semaines et périodes futures."] },
        { q: "Que fait Formater les données ?", steps: ["Supprime définitivement clients, employés, heures, avis et historique.", "Vous devez saisir FORMATER pour confirmer. Le compte de connexion de l'entreprise n'est pas touché."] },
      ],
    },
  },
  staff: {},
};
