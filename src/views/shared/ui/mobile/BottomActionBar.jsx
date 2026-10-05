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
// a MobileBottomBar ocupa em vez de ficar colada em `bottom:0`. Offset
// atualizado junto com a volta da MobileBottomBar pro estilo "colado"
// (mesma volta, texto do Tomás/Toni): 100px de altura de conteúdo
// (18px + botão 64 + 18px, ver MobileBottomBar.jsx) + área segura do
// iPhone, já que agora ela soma via `paddingBottom` da própria barra em
// vez de `marginBottom` de um vão de flutuação.
//
// QA (achado do Iago, 3ª volta): o botão principal passa a TROCAR DE
// TEXTO ("Marque um cliente" enquanto não há nada marcado → "Finalizar
// dia" assim que há) em vez do padrão do resto do app (mesmo texto +
// explicação por baixo quando desativado) — decisão consciente, pedida
// explicitamente pro Tomás/Toni, só pra este botão.
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
        // QA (achado do Iago, print, 2ª rodada): com `sticky`, a barra só
        // "gruda" depois que a página rola — com pouco conteúdo (dia sem
        // marcações) ela ficava solta no meio da tela, com um vão em
        // cima do menu. No telemóvel agora é `fixed`: sempre presa à
        // tela, encostada em cima da barra de navegação (100px + área
        // segura, a mesma altura da MobileBottomBar), na largura toda.
        // Fora do telemóvel (tablet) continua `sticky` como antes.
        position: floatAboveMobileBar ? "fixed" : "sticky",
        bottom: floatAboveMobileBar ? "calc(env(safe-area-inset-bottom, 0px) + 100px)" : 0,
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
      {/* QA (achado do Iago, 2ª rodada, com print): "Total do dia" em
          Poppins 600 26 + botão nunca tinham `min-width:0`/encolhimento
          — num telemóvel estreito a dupla ficava maior que a largura
          disponível e o texto (nowrap) vazava por cima do botão em vez
          de encolher ou cortar. Label ganha `minWidth:0` +
          `overflow:hidden` + `textOverflow:"ellipsis"` (encolhe e corta
          em "…" se faltar espaço, nunca mais invade o botão) e desce um
          pouco de tamanho (22, vinha de 26); botão ganha
          `flexShrink:0` pra nunca perder a própria largura. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 22, color: COLORS.ink, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {totalLabel}
        </div>
        <Button
          variant="primary" size="actionBarPrimary" onClick={onPrimary}
          disabled={primaryDisabled} disabledReason={primaryDisabledReason} disabledReasonBelow
          style={{ flexShrink: 0 }}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export { BottomActionBar };
