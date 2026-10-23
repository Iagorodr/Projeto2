// Folha "Mais" (documento de design, 3.3): abre por cima da barra
// inferior. 70 px por linha — ícone em bloco de 44, texto 17px, seta.
// Itens: funcionário = Notas, Clientes, Histórico; supervisor também
// Monitoramento (com selo do nº de funcionários com dias em falta).
//
// Introduzido na Etapa 3 (casca); já ligado a App.jsx desde a Etapa 4
// (comentário antigo corrigido aqui, varredura de QA, sem mudança de
// comportamento). Esc e clique fora fecham (mesma regra de acessibilidade
// das gavetas/diálogos, secção 1.7).
//
// Lote 4, 4.2 (achado da Marta): no celular o "Sair" não existia em
// lugar nenhum. Prop `user` nova (opcional, retrocompatível — nada muda
// para quem não a passa): mostra o nome de quem entrou acima da lista.
// O item com `logout: true` (sempre o último, ver App.jsx `moreItems`)
// não mostra a seta — é uma ação que encerra a sessão, não uma navegação.
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../../styles/tokens.js";
import { Avatar } from "../Avatar.jsx";

// `variant="grid"` (gerência no telemóvel, muitos itens): grelha de 3 colunas
// em vez de linhas de 70px, para caber sem rolar; o "Sair" fica numa linha à
// parte no fim. `lang/setLang/langNames` (opcionais): seletor de língua no topo.
function MoreSheet({ open, onClose, items, user, variant, activeKey, lang, setLang, langNames }) {
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
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px 14px" }}>
            <Avatar name={user.name} photoUrl={user.photoUrl} size={40} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            {lang && setLang && langNames && (
              <div role="group" aria-label="Língua" style={{ display: "flex", background: COLORS.lineSoft, borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 }}>
                {Object.keys(langNames).map((code) => (
                  <button
                    key={code} type="button" onClick={() => setLang(code)} aria-pressed={code === lang} title={langNames[code]}
                    style={{
                      minWidth: 40, height: 34, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                      background: code === lang ? COLORS.card : "transparent", color: code === lang ? COLORS.vivoInk : COLORS.ink2,
                      boxShadow: code === lang ? "0 1px 3px rgba(20,63,53,.15)" : "none",
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {variant === "grid" ? (() => {
          const tiles = items.filter((it) => !it.logout);
          const logout = items.find((it) => it.logout);
          return (
            <div style={{ maxHeight: "70dvh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, padding: "4px 14px 10px", borderTop: `1px solid ${COLORS.lineSoft}`, paddingTop: 12 }}>
                {tiles.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === activeKey;
                  return (
                    <button
                      key={item.key} type="button" onClick={() => { item.onSelect?.(); onClose?.(); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                        minHeight: 84, padding: "10px 4px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                        border: `1px solid ${active ? COLORS.forest200 : COLORS.lineSoft}`, background: active ? COLORS.forest50 : COLORS.card,
                      }}
                    >
                      <span style={{ width: 40, height: 40, borderRadius: 12, background: COLORS.rowIconBg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <Icon size={20} strokeWidth={1.9} color={COLORS.rowIconInk} />
                        {item.badge != null && item.badge > 0 && (
                          <span style={{ position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 999, background: COLORS.clay, color: "#3A1A0D", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{item.badge}</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink, textAlign: "center", lineHeight: 1.2, overflowWrap: "anywhere" }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              {logout && (
                <button
                  type="button" onClick={() => { logout.onSelect?.(); onClose?.(); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 56, padding: "0 18px", border: "none", borderTop: `1px solid ${COLORS.lineSoft}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: COLORS.ink }}
                >
                  <logout.icon size={20} strokeWidth={1.9} color={COLORS.rowIconInk} />
                  {logout.label}
                </button>
              )}
            </div>
          );
        })() : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            const isLogout = !!item.logout;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => { item.onSelect?.(); onClose?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, height: 70, padding: "0 18px",
                  border: "none", borderTop: i === 0 && !user ? "none" : `1px solid ${COLORS.lineSoft}`,
                  background: "transparent", cursor: "pointer", fontFamily: "inherit", width: "100%",
                }}
              >
                <span style={{ width: 44, height: 44, borderRadius: 14, background: COLORS.rowIconBg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={1.9} color={COLORS.rowIconInk} />
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
                {/* "Sair" encerra a sessão em vez de navegar — sem seta,
                    pra não parecer mais uma tela dentro da folha. */}
                {!isLogout && (
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.mint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ChevronRight size={16} strokeWidth={2.2} color={COLORS.vivo} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

export { MoreSheet };
