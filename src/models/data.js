// Dados iniciais (seed) e constantes estáticas do app. Camada "Model".
import { LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings, Archive, Store, Building2, Home as HouseIcon, Factory } from "lucide-react";

const LANG_NAMES = { pt: "Português", en: "English", fr: "Français" };

const TYPE_ICONS = { store: Store, office: Building2, house: HouseIcon, factory: Factory };

const MONTHS_ABBR_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DAY_LABELS_1_7 = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 7: "DOM" };

const AGENDA_DAYS = [1, 2, 3, 4, 5, 6, 7];

const TODAY = new Date(2026, 8, 16);

const MENU_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "clientes", icon: Users, label: "Clientes" },
  { key: "agendas", icon: CalendarDays, label: "Agendas" },
  { key: "horas", icon: Clock, label: "Horas" },
  { key: "historico", icon: Archive, label: "Histórico" },
  { key: "avisos", icon: Bell, label: "Avisos" },
  { key: "funcionarios", icon: UsersRound, label: "Funcionarios" },
  { key: "definicoes", icon: Settings, label: "Definições" },
];

const INITIAL_CLIENTS = [
  { id: 1, name: "Cliente X", type: "store", city: "Wavre", address: "Rua Cle de la tion 120E, Wavre", contact: "921837645", contractStart: "01/12/2025", contractEnd: "01/12/2030", hoursMonth: 24, valueHour: 15, frequency: "weekly", availability: "10:00 a 15:00", duration: 120, days: [1, 3, 5], description: "Limpeza geral. Atenção especial: casas de banho e cozinha.", priorities: "Limpar banheiros, cozinha e ter atenção as teias de aranha.", note: "Código de acesso: 2120", clientType: "fixo", clientValidUntil: "", origin: "Próprio" },
  { id: 2, name: "Cliente T", type: "office", city: "Bruxelles", address: "Avenue Louise 200, 1050 Bruxelles", contact: "484512309", contractStart: "10/01/2026", contractEnd: "10/01/2028", hoursMonth: 16, valueHour: 15, frequency: "weekly", availability: "Sempre aberto", duration: 90, days: [1, 4], description: "Limpeza geral do escritório.", priorities: "Atenção especial à cozinha comum.", note: "", clientType: "fixo", clientValidUntil: "", origin: "XLG" },
  { id: 3, name: "Cliente Z", type: "house", city: "Bruxelles", address: "Chaussée de Charleroi 45, 1060 Bruxelles", contact: "473445566", contractStart: "05/02/2026", contractEnd: "05/02/2027", hoursMonth: 12, valueHour: 15, frequency: "weekly", availability: "10:00 a 15:00", duration: 90, days: [2, 5], description: "Limpeza geral, sem restrição de horário.", priorities: "Atenção aos vidros da entrada.", note: "", clientType: "fixo", clientValidUntil: "", origin: "Próprio" },
  { id: 4, name: "Cliente D", type: "office", city: "Bruxelles", address: "Rue Neuve 8, 1000 Bruxelles", contact: "470112233", contractStart: "12/03/2026", contractEnd: "12/03/2027", hoursMonth: 6, valueHour: 15, frequency: "biweekly", availability: "Seg ou Ter", duration: 90, days: [1], description: "Limpeza quinzenal, mais profunda.", priorities: "Tapetes e estofos das cadeiras.", note: "Confirmar por SMS até às 9h do dia anterior.", clientType: "fixo", clientValidUntil: "", origin: "CleanUp" },
  { id: 5, name: "Cliente A - Escritório Norte", type: "factory", city: "Bruxelles", address: "Boulevard Anspach 30, 1000 Bruxelles", contact: "471998877", contractStart: "20/04/2026", contractEnd: "20/10/2026", hoursMonth: 4, valueHour: 15, frequency: "biweekly", availability: "Entre 12h e 14h", duration: 60, days: [3], description: "Só chão e casas de banho, exceto gabinetes individuais.", priorities: "Evitar aspirador depois das 13h30.", note: "Evitar aspirador depois das 13h30, costuma haver reunião.", clientType: "replacement", clientValidUntil: "2026-11-30", origin: "XLG" },
  { id: 6, name: "Cliente Etienne", type: "office", city: "Wavre", address: "Rue Etienne 5, 1300 Wavre", contact: "472334412", contractStart: "01/06/2026", contractEnd: "01/06/2027", hoursMonth: 3, valueHour: 15, frequency: "monthly", availability: "Sempre aberto", duration: 90, days: [2], description: "Limpeza mensal completa.", priorities: "Cozinha e sala de arquivo.", note: "Código do alarme fica só com o gerente — ligar antes de entrar.", clientType: "fixo", clientValidUntil: "", origin: "Próprio" },
  { id: 7, name: "Cliente B - Residência Wavre", type: "house", city: "Wavre", address: "Avenue des Ardennes 22, 1300 Wavre", contact: "477112233", contractStart: "05/03/2026", contractEnd: "05/03/2027", hoursMonth: 20, valueHour: 18, frequency: "weekly", availability: "Após as 18h", duration: 150, days: [6], description: "Casa particular. Limpeza geral, exceto o escritório do 1º andar.", priorities: "Cozinha, casas de banho e trocar lençóis do quarto principal.", note: "Tem cão, é tranquilo mas ladra nos primeiros minutos. Chave fica com o vizinho do nº 24.", clientType: "fixo", clientValidUntil: "", origin: "CleanUp" },
];

const INITIAL_STAFF = [
  { id: 1, name: "Maria Silva", email: "maria.silva@empresax.com", contact: "471223344", password: "••••••••", accountType: "fixo", status: "ativo", validUntil: "", iban: "BE68 5390 0754 7034" },
  { id: 2, name: "João Pedro", email: "joao.pedro@empresax.com", contact: "472334455", password: "••••••••", accountType: "fixo", status: "ativo", validUntil: "", iban: "BE71 0961 2345 6769" },
  { id: 3, name: "Ana Costa", email: "ana.costa@empresax.com", contact: "473445566", password: "••••••••", accountType: "fixo", status: "ativo", validUntil: "", iban: "BE43 0689 9999 9501" },
  { id: 4, name: "Carlos Souza", email: "carlos.souza@empresax.com", contact: "474556677", password: "••••••••", accountType: "replacement", status: "inativo", validUntil: "2026-10-15", iban: "" },
];

const INITIAL_ASSIGNMENTS = {
  "1-1": [1], "2-1": [1],
  "1-3": [1], "2-3": [1],
  "1-5": [1, 2],
  "3-2": [3],
  "4-6": [7],
};

const INITIAL_HORAS = {
  1: { status: "finalizado", paid: true, entries: [
    { date: "01/09", clientId: 1, hours: 2, extra: false, approved: true, voided: false },
    { date: "03/09", clientId: 1, hours: 2, extra: false, approved: true, voided: false },
    { date: "03/09", clientId: 2, hours: 1.5, extra: false, approved: true, voided: false },
    { date: "05/09", clientId: 1, hours: 2.5, extra: true, approved: true, voided: false },
    { date: "08/09", clientId: 1, hours: 2, extra: false, approved: true, voided: false },
  ]},
  2: { status: "pendente", paid: false, entries: [
    { date: "02/09", clientId: 1, hours: 2, extra: false, approved: true, voided: false },
    { date: "04/09", clientId: 1, hours: 2, extra: false, approved: true, voided: false },
    { date: "09/09", clientId: 1, hours: 3, extra: true, approved: false, voided: false },
  ]},
  3: { status: "finalizado", paid: false, entries: [
    { date: "01/09", clientId: 3, hours: 1.5, extra: false, approved: true, voided: false },
    { date: "05/09", clientId: 3, hours: 1.5, extra: false, approved: true, voided: false },
    { date: "08/09", clientId: 3, hours: 2, extra: true, approved: true, voided: false },
  ]},
  4: { status: "pendente", paid: false, entries: [
    { date: "06/09", clientId: 7, hours: 2.5, extra: false, approved: true, voided: false },
  ]},
};

const INITIAL_MISSING = [
  { id: 1, staffId: 1, clientId: 1, text: "Falta detergente multiusos e sacos de lixo grandes.", date: "12/09", resolved: false, response: "" },
  { id: 2, staffId: 2, clientId: 2, text: "Acabou o papel higiénico na casa de banho.", date: "10/09", resolved: true, response: "Já foi reposto, obrigado por avisar." },
];

const INITIAL_SENT = [
  { id: 1, type: "elogio", staffId: 3, clientId: 3, text: "O trabalho tem sido bem feito, tudo como foi pedido e ainda mais. Parabéns!", date: "08/09", hasPhoto: false, read: false },
  { id: 2, type: "reclamacao", staffId: 4, clientId: 7, text: "Cliente reportou que a cozinha ficou com manchas na bancada.", date: "05/09", hasPhoto: true, read: false },
  { id: 3, type: "aviso", staffId: 1, clientId: 1, text: "A inspetora vai passar hoje à tarde, capricha na receção.", date: "16/09", hasPhoto: false, read: false },
];

const EMPTY_CLIENT = {
  name: "", type: "office", city: "", address: "", contact: "",
  contractStart: "", contractEnd: "", hoursMonth: "", valueHour: "",
  frequency: "weekly", availability: "", duration: "", days: [],
  description: "", priorities: "", note: "",
  clientType: "fixo", clientValidUntil: "", origin: "",
};

const CLIENT_TYPES = { store: "Loja", office: "Escritório", house: "Residência", factory: "Fábrica" };

const FREQS = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" };

const EMPTY_STAFF = { name: "", email: "", contact: "", password: "", accountType: "fixo", status: "ativo", validUntil: "", iban: "" };

const WEEKDAY_FULL_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const DAY_ABBR_SUN0_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export { LANG_NAMES, TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, MENU_ITEMS, INITIAL_CLIENTS, INITIAL_STAFF, INITIAL_ASSIGNMENTS, INITIAL_HORAS, INITIAL_MISSING, INITIAL_SENT, EMPTY_CLIENT, CLIENT_TYPES, FREQS, EMPTY_STAFF, WEEKDAY_FULL_PT, DAY_ABBR_SUN0_PT };
