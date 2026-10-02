// Diálogo de confirmação (documento de design, 2.10): centrado, 420 de
// largura (mobile: sheet compacta). Título curto, corpo com a
// CONSEQUÊNCIA ESCRITA (não só "tem a certeza?"), botão "Cancelar"
// (secundário) + ação (primário, ou perigo sólido se `destructive`).
// "Formatar dados": obriga a escrever uma palavra (ex.: FORMATAR) — ver
// `requireTypedWord`.
//
// Introduzido na Etapa 2 (componentes); já ligado a todas as confirmações
// destrutivas dos ecrãs redesenhados na Etapa 4 (`styles.modalOverlay`/
// `modalCard` continuam a existir só para o aviso de instalação iOS em
// Layout.jsx, que não é uma confirmação destrutiva) — comentário antigo
// corrigido aqui, varredura de QA pós-Etapa 4, sem mudança de
// comportamento.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";
import { useIsMobile } from "../../../hooks/useIsMobile.js";
import { Button } from "./Button.jsx";

function ConfirmDialog({
  open, title, body, cancelLabel = "Cancelar", confirmLabel = "Confirmar",
  destructive, onCancel, onConfirm, requireTypedWord, typedWordHint,
}) {
  const isMobile = useIsMobile();
  const [typed, setTyped] = useState("");

  // Esc fecha (documento, secção 1.7 — acessibilidade).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) { if (e.key === "Escape") onCancel?.(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // Limpa a palavra digitada sempre que o diálogo (re)abre, senão fica a
  // palavra da vez anterior e o botão de ação destrava sozinho.
  useEffect(() => { if (open) setTyped(""); }, [open]);

  if (!open) return null;

  const blocked = requireTypedWord && typed.trim().toUpperCase() !== requireTypedWord.toUpperCase();

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 90,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        padding: isMobile ? 0 : 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, width: isMobile ? "100%" : 420,
          borderRadius: isMobile ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          boxShadow: SHADOW.sh2, padding: 24, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{title}</div>
          <button
            type="button" onClick={onCancel} aria-label={cancelLabel}
            style={{
              width: 28, height: 28, borderRadius: "50%", border: "none", background: COLORS.bg,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              color: COLORS.ink3, flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: requireTypedWord ? 14 : 22 }}>
          {body}
        </div>

        {requireTypedWord && (
          <div style={{ marginBottom: 22 }}>
            {typedWordHint && <div style={{ fontSize: 12, color: COLORS.ink3, marginBottom: 6 }}>{typedWordHint}</div>}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedWord}
              style={{
                width: "100%", height: 44, borderRadius: RADIUS.control, boxSizing: "border-box",
                border: `1px solid ${COLORS.lineInput}`, padding: "0 12px", fontSize: 14,
                color: COLORS.ink, fontFamily: "inherit",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={destructive ? "dangerSolid" : "primary"}
            onClick={onConfirm}
            disabled={blocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
