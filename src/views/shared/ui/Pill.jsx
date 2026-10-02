// Pílula / selo (documento de design, 2.3): altura 24, padding 3×10,
// 12 px 600, raio 999 (pill). Cada `variant` é um par fundo+texto do
// documento.
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs
// redesenhados na Etapa 4, incluindo AcessosScreen.jsx (o antigo
// `styles.statusBadge` que o comentário citava já não tem nenhum uso) —
// comentário antigo corrigido aqui, varredura de QA pós-Etapa 4, sem
// mudança de comportamento.
import { Shield } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";

const VARIANTS = {
  pending: { bg: COLORS.amberBg, ink: COLORS.amberInk }, // pendente / por tratar
  owed: { bg: COLORS.forest100, ink: COLORS.forest800 }, // por pagar (finalizado, ainda não pago)
  paid: { bg: COLORS.okTint, ink: COLORS.okInk }, // pago / OK / em dia
  reopened: { bg: COLORS.clayTint, ink: COLORS.clayInk }, // reaberto para correção
  missing: { bg: COLORS.alertTint, ink: COLORS.alert }, // em falta / erro
  neutral: { bg: COLORS.lineSoft, ink: COLORS.ink2 }, // neutro / inativo
};

function Pill({ variant = "neutral", icon: Icon, children }) {
  const { bg, ink } = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        height: 24, padding: "3px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, background: bg, color: ink,
        lineHeight: 1, whiteSpace: "nowrap",
      }}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

// Duas semânticas de SupervisorTag (documento, 2.3) — não misturar:
//   kind="role"   -> papel do funcionário em tabelas e Acessos (cinzento-azulado)
//   kind="origin" -> origem de uma mensagem em Avisos ("Enviado por supervisor", clay-tint)
// `children` é o texto (o app é pt/en/fr — quem usa o componente passa a
// string já traduzida vinda de T[lang], igual se faz com <Pill>; este
// componente só resolve a cor certa por `kind`, nunca escreve texto fixo).
// Nota: o documento também descreve um terceiro selo, "Supervisora"
// (identidade no topo em mobile/tablet: fundo clay sólido, texto
// #3A1A0D) — esse é um elemento mais específico da casca mobile/tablet
// (secção 5), não uma das "duas semânticas" de SupervisorTag; fica pra
// quando montarmos essa parte da casca (Etapa 2.15 / Etapa 3), pra não
// inventar já um componente sem o contexto de layout à volta.
function SupervisorTag({ kind = "role", children }) {
  const { bg, ink } = kind === "origin"
    ? { bg: COLORS.clayTint, ink: COLORS.clayInk }
    : { bg: COLORS.steelBg, ink: COLORS.steelInk };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        height: 24, padding: "3px 10px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, background: bg, color: ink,
        lineHeight: 1, whiteSpace: "nowrap",
      }}
    >
      <Shield size={11} strokeWidth={1.8} />
      {children}
    </span>
  );
}

export { Pill, SupervisorTag };
