// Barra inferior mobile (documento de design, 3.3): 5 posições fixas —
// Início · Horas · Agenda · Avisos · Mais. Bloco de 58×32 com ícone 24
// (fundo forest-100 quando ativo) e etiqueta 12px (peso 600 + forest-700
// quando ativa; ink-3 quando não). Fundo branco, contorno superior line,
// padding inferior 16 (área segura). Selo numérico no ícone de Avisos.
//
// No ecrã Horas esta barra é SUBSTITUÍDA pela BottomActionBar (2.15/5.2.6)
// — decisão de qual mostrar é de quem monta o ecrã (Etapa 4), não deste
// componente.
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4
// (comentário antigo corrigido aqui, varredura de QA, sem mudança de
// comportamento).
import { COLORS } from "../../../../styles/colors.js";

function MobileBottomBar({ items, activeKey, onNavigate }) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, left: 0, right: 0, background: COLORS.card,
        borderTop: `1px solid ${COLORS.line}`, display: "flex", justifyContent: "space-around",
        paddingTop: 8, paddingBottom: 16, zIndex: 30,
      }}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              width: 58, height: 32, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              position: "relative",
            }}
          >
            <span
              style={{
                width: 40, height: 26, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? COLORS.forest100 : "transparent", position: "relative",
              }}
            >
              <Icon size={24} strokeWidth={1.8} color={active ? COLORS.forest700 : COLORS.ink3} />
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
            <span style={{ fontSize: 12, fontWeight: active ? 600 : 500, color: active ? COLORS.forest700 : COLORS.ink3 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MobileBottomBar };
