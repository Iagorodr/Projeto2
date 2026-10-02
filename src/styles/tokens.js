// Tokens de forma, sombra e espaço do documento de design (secção 1.3),
// em JS pra uso nos objetos de estilo inline (o resto do app usa objetos
// JS, não CSS "de verdade" — ver o comentário em index.css pros mesmos
// valores como variáveis CSS). Ficheiro novo, aditivo: styles.js continua
// com os valores que já tinha em cada regra (não foi tocado); ligar estes
// tokens aos componentes existentes é trabalho de Etapa 2 (componentes) e
// Etapa 4 (ecrãs), não desta etapa de fundação.
const RADIUS = {
  card: 20,
  sheetMobile: 28, // só os cantos de cima, no CSS de quem usar
  control: 12, // gerência
  controlMobile: 16, // supervisor / mobile (14-16 no documento; 16 escolhido)
  chip: 10,
  pill: 999,
};

const SHADOW = {
  sh1: "0 1px 2px rgba(20,63,53,.06), 0 8px 20px -12px rgba(20,63,53,.16)", // cartões
  sh2: "0 2px 4px rgba(20,63,53,.10), 0 22px 40px -18px rgba(20,63,53,.45)", // herói, hover, popovers
};

// Espaço em múltiplos de 4.
const SPACE = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24 };

// Duração de transições em hover/foco (120-150ms, respeitando
// prefers-reduced-motion — quem usar isto trata isso na própria regra).
const MOTION = { fast: "120ms", slow: "150ms" };

// Ícones (secção 1.4). Decisão do Iago (2026-09-30): manter lucide-react
// em vez de trocar pra Tabler — o documento assumia Tabler "já usada", mas
// o app usa lucide-react. lucide-react não tem um "default" global de
// traço/tamanho (cada <Icon /> recebe strokeWidth/size por instância), daí
// só dá pra fixar aqui os valores-padrão a passar nas instâncias; ligar
// isso a cada ícone existente é trabalho visual de ecrã/componente (Etapa
// 2/4), não desta etapa.
const ICON = {
  strokeWidth: 1.8,
  size: 20, // por defeito
  sizeBottomBar: 24, // barras inferiores (mobile)
};

// Referência: nome do documento (Tabler) -> equivalente mais próximo em
// lucide-react. Só documentação pra quem for mexer nos ecrãs depois — NÃO
// aplicado automaticamente aqui. Onde o ícone atual do app já diverge do
// mapeamento do documento (Notas, Funcionários, Definições), a troca do
// ÍCONE ESCOLHIDO (não só traço/tamanho) é uma mudança visual de ecrã,
// deixada pra Etapa 4, igual foi decidido pros títulos em maiúsculas e
// pro formatador de horas.
//   Dashboard        layout-dashboard        -> LayoutDashboard   (já bate)
//   Clientes         users                   -> Users             (já bate)
//   Agendas          calendar                -> CalendarDays      (já bate, variante)
//   Horas            clock                   -> Clock             (já bate)
//   Monitoramento    eye                     -> Eye                (já bate)
//   Histórico        archive                 -> Archive           (já bate)
//   Avisos           bell                    -> Bell               (já bate)
//   Notas            file-text               -> FileText          (app usa StickyNote — diverge)
//   Funcionários     user                    -> User               (app usa UsersRound — diverge)
//   Acessos          key                     -> KeyRound          (já bate)
//   Definições       adjustments-horizontal  -> SlidersHorizontal  (app usa Settings — diverge)
//   Supervisor       shield                  -> Shield            (já bate, ShieldCheck usado)
//   Partilhado       users                   -> Users             (já bate)
//   Quinzenal/mensal refresh                 -> RefreshCw/RefreshCcw
//   Falta            alert-triangle          -> AlertTriangle
//   Feito            check                   -> Check             (já bate)

// Tipografia (secção 1.2). Pilhas de fonte, pra não repetir a string em
// cada componente novo (os ecrãs existentes já escrevem isto solto em
// vários sítios — ver styles.js — isso não muda aqui, é só pros
// componentes novos da Etapa 2 em diante).
const FONT = {
  heading: "'Poppins', sans-serif", // títulos e números grandes (peso 600; 500 só em rótulos de marca)
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export { RADIUS, SHADOW, SPACE, MOTION, ICON, FONT };
