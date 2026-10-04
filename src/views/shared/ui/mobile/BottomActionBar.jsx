// BottomActionBar (documento de design, 2.15 + detalhe em 5.2.6): barra
// fixa em baixo. À esquerda "Total do dia · 2h30" (Poppins 600 26), à
// direita botão primário 58 ("Finalizar dia"). Por cima, opcionalmente,
// um botão secundário de largura total (ex.: "Finalizar semana") — quem
// usa o componente decide quando esse botão aparece (5.2.6: só com todos
// os dias da semana registados ou sem clientes — lógica de Etapa 4).
//
// QA (achado do Iago, 3ª volta — "menu mobile pagina de horas ele
// espande"): no mobile "puro" esta barra convive com a MobileBottomBar
// da casca (App.jsx) — as duas são `position:sticky,bottom:0`
// independentes, sem conhecimento uma da outra, então disputavam o MESMO
// lugar no fundo da janela em vez de empilhar. `floatAboveMobileBar`
// (quem monta o ecrã decide, conforme a camada — ver
// EmployeeHorasScreen.jsx) sobe esta barra pra ficar ACIMA do espaço que
// a MobileBottomBar ocupa (altura 60 + folga de flutuação 10 + área
// segura do iPhone, ver MobileBottomBar.jsx) em vez de ficar colada em
// `bottom:0`, com mais 8px de respiro entre as duas.
import { COLORS } from "../../../../styles/colors.js";
import { FONT } from "../../../../styles/tokens.js";
import { Button } from "../Button.jsx";

function BottomActionBar({
  totalLabel, primaryLabel, onPrimary, primaryDisabled, primaryDisabledReason,
  secondaryLabel, onSecondary, floatAboveMobileBar,
}) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: floatAboveMobileBar ? "calc(env(safe-area-inset-bottom, 0px) + 78px)" : 0,
        left: 0, right: 0, background: COLORS.card,
        borderTop: `1px solid ${COLORS.line}`, padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: "0 -4px 16px rgba(20,63,53,.08)",
        zIndex: 20,
      }}
    >
      {/* Lote 4, 4.4 (achado da Marta): "56 só no botão principal da
          barra de ação fixa" — o secundário volta ao tamanho automático
          (48 numa tela mobile), só o primário usa os 56 fixos. */}
      {secondaryLabel && (
        <Button variant="secondary" onClick={onSecondary} style={{ width: "100%" }}>
          {secondaryLabel}
        </Button>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, color: COLORS.ink, whiteSpace: "nowrap" }}>
          {totalLabel}
        </div>
        <Button
          variant="primary" size="actionBarPrimary" onClick={onPrimary}
          disabled={primaryDisabled} disabledReason={primaryDisabledReason} disabledReasonBelow
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export { BottomActionBar };
