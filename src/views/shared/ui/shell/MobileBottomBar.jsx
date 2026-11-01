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

// Redesign B1: barra branca; o separador ativo leva uma pílula clara da cor da
// empresa e o ícone/rótulo nessa cor. Selos de contagem a vermelho.
function MobileBottomBar({ items, activeKey, onNavigate }) {
  return (
    <div
      style={{
        // Sangra até às bordas (a `pageStyle` do App dá 14px de margem no telemóvel).
        margin: "0 -14px -14px",
        position: "sticky", bottom: 0, zIndex: 30,
        background: "#FFFFFF", borderTop: `1px solid ${COLORS.line}`,
        display: "flex", justifyContent: "space-around",
        padding: "10px 4px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        const color = active ? "var(--p1)" : COLORS.ink3;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              width: 70, height: 60, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              position: "relative",
            }}
          >
            <span
              style={{
                width: 60, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? "var(--p1-12)" : "transparent", position: "relative", transition: "background .2s",
              }}
            >
              <Icon size={24} strokeWidth={2} color={color} />
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    position: "absolute", top: -4, right: 6, minWidth: 18, height: 18, borderRadius: 999,
                    background: COLORS.dangerSolid, color: "#FFFFFF", fontSize: 10.5, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", lineHeight: 1,
                    border: "2px solid #fff",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: active ? COLORS.ink : COLORS.ink3 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MobileBottomBar };
