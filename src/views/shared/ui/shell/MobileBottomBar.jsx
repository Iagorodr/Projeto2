// Barra inferior mobile (documento de design, 3.3): 5 posições fixas —
// Início · Horas · Agenda · Avisos · Mais. Selo numérico no ícone de Avisos.
//
// No ecrã Horas esta barra é SUBSTITUÍDA pela BottomActionBar (2.15/5.2.6)
// — decisão de qual mostrar é de quem monta o ecrã (Etapa 4), não deste
// componente.
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4.
//
// QA (achado do Iago, 3ª volta — texto do Tomás/Toni): volta a ficar
// COLADA nas 3 bordas (esquerda/direita/baixo), sem margem nem cantos
// arredondados nem sombra de elevação — desfaz o "dock flutuante" da 2ª
// volta (decisão revista explicitamente pelo Iago depois de ver o texto
// do Tomás, não um esquecimento). Também cresce: conteúdo com ~100px de
// altura total (antes ~60), ícone 26→28, rótulo 12→13.5 semibold. Como já
// não flutua, a área segura do iPhone (`env(...)`) vira `paddingBottom`
// da própria barra (soma à altura visível) em vez de `marginBottom`
// (que só fazia sentido pra abrir um vão por baixo da barra flutuante).
// `BottomActionBar.jsx` (Horas) tem seu próprio comentário explicando
// como o novo offset acompanha essa altura maior.
//
// QA (achado do Iago, 1ª volta): recolorida pra seguir a mesma "teoria"
// do menu de PC/tablet (AppSidebar.jsx) — fundo verde-escuro (gradiente),
// ícone/rótulo brancos translúcidos por omissão e clay (laranja) no item
// selecionado.
//
// QA (achado do Iago, 3ª volta): gradiente trocado por um verde mais
// vivo — era quase preto (#16483A→#0F3129, perto do forest900); agora
// forest600→forest800, a mesma família mas claramente mais verde/vivo em
// vez de ficar quase sem matiz.
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS } from "../../../../styles/tokens.js";

function MobileBottomBar({ items, activeKey, onNavigate }) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, zIndex: 30,
        background:
          "radial-gradient(circle at 10% 8%, rgba(226,138,101,.18), transparent 45%), " +
          "linear-gradient(180deg, #1F6F5C 0%, #143F35 100%)",
        display: "flex", justifyContent: "space-around",
        padding: "18px 4px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
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
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              width: 66, height: 64, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              position: "relative",
            }}
          >
            <span
              style={{
                width: 48, height: 32, borderRadius: RADIUS.chip, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? COLORS.clay : "transparent", position: "relative",
              }}
            >
              <Icon size={28} strokeWidth={1.8} color={iconColor} />
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
            <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 600, color: labelColor }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MobileBottomBar };
