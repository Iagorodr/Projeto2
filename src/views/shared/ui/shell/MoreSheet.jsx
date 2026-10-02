// Folha "Mais" (documento de design, 3.3): abre por cima da barra
// inferior. 70 px por linha — ícone em bloco de 44, texto 17px, seta.
// Itens: funcionário = Notas, Clientes, Histórico; supervisor também
// Monitoramento (com selo do nº de funcionários com dias em falta).
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4
// (comentário antigo corrigido aqui, varredura de QA, sem mudança de
// comportamento). Esc e clique fora fecham (mesma regra de acessibilidade
// das gavetas/diálogos, secção 1.7).
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";

function MoreSheet({ open, onClose, items }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 70, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", background: COLORS.card, borderRadius: `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0`,
          boxShadow: SHADOW.sh2, paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 44, height: 5, borderRadius: 3, background: COLORS.line }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { item.onSelect?.(); onClose?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, height: 70, padding: "0 18px",
                  border: "none", borderTop: i === 0 ? "none" : `1px solid ${COLORS.lineSoft}`,
                  background: "transparent", cursor: "pointer", fontFamily: "inherit", width: "100%",
                }}
              >
                <span style={{ width: 44, height: 44, borderRadius: 14, background: COLORS.forest50, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={1.8} color={COLORS.forest600} />
                  {item.badge != null && item.badge > 0 && (
                    <span
                      style={{
                        position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999,
                        background: COLORS.clay, color: "#3A1A0D", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
                <span style={{ flex: 1, textAlign: "left", fontSize: 17, fontWeight: 600, color: COLORS.ink }}>{item.label}</span>
                <ChevronRight size={18} color={COLORS.ink3} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { MoreSheet };
