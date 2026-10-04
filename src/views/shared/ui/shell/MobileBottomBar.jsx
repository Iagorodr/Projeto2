// Barra inferior mobile (documento de design, 3.3): 5 posições fixas —
// Início · Horas · Agenda · Avisos · Mais. Selo numérico no ícone de Avisos.
//
// No ecrã Horas esta barra é SUBSTITUÍDA pela BottomActionBar (2.15/5.2.6)
// — decisão de qual mostrar é de quem monta o ecrã (Etapa 4), não deste
// componente.
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4.
//
// QA (achado do Iago, 2ª volta — "tá feio, segue estes exemplos"):
// mandou uma folha de referência com 11 estilos de barra inferior
// (Glassmorphism, Floating, Neumorphism, Pill Highlight, Center FAB,
// Gradient Bold, Outline Icons, Tab with Indicator, Curved Background,
// Dock Style iOS...) pra escolher uma direção e adotar — confirmado
// "Dock flutuante, verde escuro": mistura "Dock Style (iOS)" +
// "Pill Highlight" dos exemplos, mas SEM trocar de paleta — mantém o
// mesmo gradiente forest escuro + brilho clay do `AppSidebar.jsx` (ver
// comentário mais antigo abaixo), só muda a FORMA. Antes era uma faixa
// reta, encostada nas 3 bordas (esquerda/direita/baixo), sem elevação —
// agora "descola": margem nos 3 lados, cantos arredondados nos 4
// (RADIUS.card, mesmo raio das outras superfícies elevadas do app, não
// um valor novo) e `SHADOW.sh2` (mesma sombra de popover/diálogo) pra
// dar profundidade. O item ativo ganha uma pílula CLAY SÓLIDA (antes era
// um branco translúcido quase imperceptível) — ícone escuro por cima
// (`#3A1A0D`, mesmo tom já usado no texto do selo de Avisos sobre clay,
// pra manter contraste) — mais perto do "Pill Highlight" do exemplo.
// `marginBottom` passa a somar a área segura do iPhone (`env(...)`) à
// folga de flutuação (10px) em vez de só `paddingBottom`, senão a barra
// flutuante ficaria "grudada" no próprio entalhe/gesture-bar.
//
// QA (achado do Iago, 1ª volta): recolorida pra seguir a mesma "teoria"
// do menu de PC/tablet (AppSidebar.jsx) — fundo verde-escuro (gradiente,
// não só forest900 sólido — ver `background` abaixo), ícone/rótulo
// brancos translúcidos por omissão e clay (laranja) no item selecionado.
// Faixa também ficou mais alta (ícone 24→26, blocos e paddings maiores).
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";

function MobileBottomBar({ items, activeKey, onNavigate }) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, zIndex: 30,
        margin: "0 10px", marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        borderRadius: RADIUS.card, boxShadow: SHADOW.sh2,
        background:
          "radial-gradient(circle at 10% 8%, rgba(226,138,101,.18), transparent 45%), " +
          "linear-gradient(180deg, #16483A 0%, #0F3129 100%)",
        display: "flex", justifyContent: "space-around",
        padding: "10px 4px",
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        const iconColor = active ? "#3A1A0D" : "rgba(255,255,255,.78)";
        const labelColor = active ? "#fff" : "rgba(255,255,255,.78)";
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              width: 64, height: 40, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              position: "relative",
            }}
          >
            <span
              style={{
                width: 46, height: 30, borderRadius: RADIUS.chip, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? COLORS.clay : "transparent", position: "relative",
              }}
            >
              <Icon size={26} strokeWidth={1.8} color={iconColor} />
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    position: "absolute", top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 999,
                    background: COLORS.clay, color: "#3A1A0D", fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1,
                    border: `1.5px solid ${COLORS.forest900}`,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: labelColor }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MobileBottomBar };
