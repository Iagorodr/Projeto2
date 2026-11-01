// Gaveta / drawer (documento de design, 2.9): substitui as janelas modais
// no meio do ecrã. Desktop: vem da direita, largura 560 (Horas: 640 — quem
// usa passa `width={640}`), sobreposição rgba(15,49,41,.45). Cabeçalho
// pegajoso (ícone/avatar + título + selo + ações + fechar 40), corpo com
// scroll, rodapé pegajoso com ações. Esc e clique fora fecham; com
// alterações por guardar, pede confirmação antes.
// Em ecrãs < 640: sheet inferior, 92% da altura, alça 44×5, raio 28 só em
// cima, rodapé pegajoso com botões de 56 (o rodapé em si é passado pelo
// chamador via `footer` — este componente só garante que fica pegajoso e
// com a altura/toque certos, não decide o que tem lá dentro).
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs de
// edição/detalhe redesenhados na Etapa 4, no lugar dos antigos modais
// centrados (`styles.modalOverlay`/`styles.modalCard`) — comentário
// antigo corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento. Os diálogos centrados (ConfirmDialog) ficam só para
// confirmações, como o documento pede — nunca para edição/detalhe, que é
// o papel da Gaveta.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";
import { ConfirmDialog } from "./ConfirmDialog.jsx";

function Drawer({
  open, onClose, width = 560,
  icon: Icon, avatar, title, pill, headerActions,
  footer, children,
  dirty, unsavedTitle = "Alterações por guardar", unsavedBody = "Tens alterações que ainda não foram guardadas. Queres mesmo sair sem guardar?",
  unsavedCancelLabel = "Continuar a editar", unsavedConfirmLabel = "Sair sem guardar",
  closeLabel = "Fechar",
}) {
  const [confirmClose, setConfirmClose] = useState(false);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose?.();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) { if (e.key === "Escape") requestClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dirty, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Mobile (<640): sheet inferior, 92% da altura, cantos de cima
          arredondados, alça de arrasto. Desktop: painel encostado à
          direita, altura inteira. O corte é 640px (o breakpoint do
          documento pra esta gaveta), diferente dos 700px de
          `useIsMobile` — por isso o `DrawerBody` calcula a sua própria
          largura de ecrã em vez de reaproveitar aquele hook. */}
      <DrawerBody
        open={open} onRequestClose={requestClose} width={width}
        icon={Icon} avatar={avatar} title={title} pill={pill} headerActions={headerActions}
        footer={footer} closeLabel={closeLabel}
      >
        {children}
      </DrawerBody>

      <ConfirmDialog
        open={confirmClose}
        title={unsavedTitle}
        body={unsavedBody}
        cancelLabel={unsavedCancelLabel}
        confirmLabel={unsavedConfirmLabel}
        destructive
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); onClose?.(); }}
      />
    </>
  );
}

function DrawerBody({ open, onRequestClose, width, icon: Icon, avatar, title, pill, headerActions, footer, closeLabel, children }) {
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 640); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(21,24,22,.45)", zIndex: 85, animation: "b1-fade .2s ease both",
        display: "flex", justifyContent: isNarrow ? "center" : "flex-end", alignItems: isNarrow ? "flex-end" : "stretch",
      }}
      onClick={onRequestClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, boxShadow: SHADOW.sh2,
          display: "flex", flexDirection: "column",
          width: isNarrow ? "100%" : width,
          // Redesign B1: no telemóvel a folha sobe de baixo e só ocupa o que precisa;
          // no PC a gaveta desliza da direita.
          height: isNarrow ? "auto" : "100%", maxHeight: isNarrow ? "92%" : undefined,
          borderRadius: isNarrow ? "30px 30px 0 0" : 0,
          animation: isNarrow ? "b1-sheet-up .32s var(--ease) both" : "b1-sheet-left .32s var(--ease) both",
        }}
      >
        {isNarrow && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 44, height: 5, borderRadius: 3, background: COLORS.line }} />
          </div>
        )}

        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: isNarrow ? "8px 22px 6px" : "18px 22px",
            borderBottom: isNarrow ? "none" : `1px solid ${COLORS.line}`, flexShrink: 0,
          }}
        >
          {avatar}
          {!avatar && Icon && (
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.forest50, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.forest600, flexShrink: 0 }}>
              <Icon size={17} strokeWidth={1.8} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "'Archivo Variable', 'Archivo Display', sans-serif", fontSize: isNarrow ? 24 : 19, lineHeight: 1.15, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isNarrow ? "normal" : "nowrap" }}>{title}</div>
              {pill}
            </div>
          </div>
          {headerActions}
          <button
            type="button" onClick={onRequestClose} aria-label={closeLabel}
            style={{
              width: 40, height: 40, borderRadius: RADIUS.control, border: "none",
              background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: COLORS.ink3, flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div style={{ flex: isNarrow ? "0 1 auto" : 1, overflowY: "auto", padding: isNarrow ? "8px 22px 18px" : 22 }}>
          {children}
        </div>

        {footer && (
          <div className={isNarrow ? "b1-sheet-footer" : undefined} style={{ flexShrink: 0, padding: isNarrow ? "4px 22px calc(env(safe-area-inset-bottom, 0px) + 18px)" : 16, borderTop: isNarrow ? "none" : `1px solid ${COLORS.line}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export { Drawer };
