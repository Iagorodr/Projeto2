// Mapa de cor/ícone por tipo de Aviso (documento, 4.7, literal): "bloco de
// ícone colorido por tipo (pedido = clay-tint, reclamação = alert-tint,
// elogio = ok-tint, aviso = forest-50)". Partilhado entre o ecrã da
// gerência (AvisosScreen.jsx, 4.7) e o ecrã do funcionário/supervisor
// (EmployeeAvisosScreen.jsx, 5.6) — precisa nos dois já nesta etapa (o
// mesmo critério do SearchSelect/PhotoDropzone), por isso fica aqui em vez
// de duplicado em cada ficheiro.
import { MessageSquare, ThumbsUp, Info, PackageX } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";

const TYPE_META = {
  pedido: { bg: COLORS.clayTint, icon: PackageX, iconColor: COLORS.clayInk },
  reclamacao: { bg: COLORS.alertTint, icon: MessageSquare, iconColor: COLORS.alert },
  elogio: { bg: COLORS.okTint, icon: ThumbsUp, iconColor: COLORS.okInk },
  aviso: { bg: COLORS.forest50, icon: Info, iconColor: COLORS.forest600 },
};

// Bloco de ícone pequeno usado em cada cartão de item (não confundir com
// os "cartões grandes selecionáveis" das gavetas/sheets — esses são
// específicos de cada ecrã, por terem alturas e layouts diferentes).
function TypeIconBlock({ type, size = 40 }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: RADIUS.chip, background: meta.bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon size={size <= 34 ? 15 : 18} color={meta.iconColor} />
    </div>
  );
}

export { TYPE_META, TypeIconBlock };
