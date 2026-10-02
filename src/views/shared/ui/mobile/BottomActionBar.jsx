// BottomActionBar (documento de design, 2.15 + detalhe em 5.2.6): barra
// fixa em baixo. À esquerda "Total do dia · 2h30" (Poppins 600 26), à
// direita botão primário 58 ("Finalizar dia"). Por cima, opcionalmente,
// um botão secundário de largura total (ex.: "Finalizar semana") — quem
// usa o componente decide quando esse botão aparece (5.2.6: só com todos
// os dias da semana registados ou sem clientes — lógica de Etapa 4).
//
// Puramente apresentacional.
import { COLORS } from "../../../../styles/colors.js";
import { FONT } from "../../../../styles/tokens.js";
import { Button } from "../Button.jsx";

function BottomActionBar({
  totalLabel, primaryLabel, onPrimary, primaryDisabled, primaryDisabledReason,
  secondaryLabel, onSecondary,
}) {
  return (
    <div
      style={{
        position: "sticky", bottom: 0, left: 0, right: 0, background: COLORS.card,
        borderTop: `1px solid ${COLORS.line}`, padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: "0 -4px 16px rgba(20,63,53,.08)",
      }}
    >
      {secondaryLabel && (
        <Button variant="secondary" size="mobile" onClick={onSecondary} style={{ width: "100%" }}>
          {secondaryLabel}
        </Button>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, color: COLORS.ink, whiteSpace: "nowrap" }}>
          {totalLabel}
        </div>
        <Button
          variant="primary" size="mobile" onClick={onPrimary}
          disabled={primaryDisabled} disabledReason={primaryDisabledReason} disabledReasonBelow
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export { BottomActionBar };
