// Barra inferior mobile (documento de design, 3.3): 5 posições fixas —
// Início · Horas · Agenda · Avisos · Mais. Selo numérico no ícone de Avisos.
//
// No ecrã Horas esta barra é SUBSTITUÍDA pela BottomActionBar (2.15/5.2.6)
// — decisão de qual mostrar é de quem monta o ecrã (Etapa 4), não deste
// componente.
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4.
//
// QA (achado do Iago): recolorida pra seguir a mesma "teoria" do menu de
// PC/tablet (AppSidebar.jsx) — fundo verde-escuro (forest900, o tom mais
// escuro do gradiente da sidebar), ícone/rótulo brancos translúcidos por
// omissão e clay (laranja) no item selecionado, em vez de pílula clara
// sobre fundo branco. Faixa também ficou mais alta (ícone 24→26, blocos e
// paddings maiores) a pedido dele. `paddingBottom` trocado de 16 fixo para
// `env(safe-area-inset-bottom, 16px)` — mesma convenção já usada no
// MoreSheet.jsx, cobre o entalhe/gesture-bar do iPhone sem empurrar demais
// em aparelhos sem área segura.
import { COLORS } from "../../../../styles/colors.js";

function MobileBottomBar({ items, activeKey, onNavigate }) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, left: 0, right: 0, background: COLORS.forest900,
        display: "flex", justifyContent: "space-around",
        paddingTop: 12, paddingBottom: "env(safe-area-inset-bottom, 16px)", zIndex: 30,
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        const color = active ? COLORS.clay : "rgba(255,255,255,.78)";
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
                width: 46, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "rgba(255,255,255,.13)" : "transparent", position: "relative",
              }}
            >
              <Icon size={26} strokeWidth={1.8} color={color} />
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    position: "absolute", top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 999,
                    background: COLORS.clay, color: "#3A1A0D", fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MobileBottomBar };
