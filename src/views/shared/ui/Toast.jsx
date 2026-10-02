// Toast (documento de design, 2.11): em baixo ao centro, 5 s, com
// "Desfazer" quando a ação é reversível (remover cliente de uma agenda,
// eliminar nota, marcar pago).
//
// Já existe hoje um "toast" simples por ecrã (`closedToast` em
// HorasScreen.jsx, `styles.toast` em mobStyles.js) — sem "Desfazer" e sem
// forma de disparar de qualquer sítio da app. Este módulo é NOVO e ainda
// não está ligado a nada: dá o componente visual (`Toast`) e a
// infraestrutura pra disparar de qualquer ecrã (`ToastProvider` +
// `useToast()`), mas envolver `<App>` com `<ToastProvider>` fica pra
// Etapa 3 (casca), e trocar os toasts locais que já existem por este é
// trabalho de Etapa 4 — aqui só ficam prontos pra uso.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, actionLabel, onAction }
  const timerRef = useRef(null);

  const showToast = useCallback((message, { actionLabel, onAction, closeLabel } = {}) => {
    clearTimeout(timerRef.current);
    setToast({ message, actionLabel, onAction, closeLabel });
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={() => { toast.onAction?.(); dismiss(); }}
          onDismiss={dismiss}
          closeLabel={toast.closeLabel}
        />
      )}
    </ToastContext.Provider>
  );
}

// showToast(message, { actionLabel: "Desfazer", onAction: () => ... })
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() precisa de um <ToastProvider> por cima na árvore.");
  return ctx;
}

function Toast({ message, actionLabel, onAction, onDismiss, closeLabel = "Fechar" }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 14,
        background: COLORS.forest900, color: "#fff",
        padding: "12px 16px", borderRadius: RADIUS.control, boxShadow: SHADOW.sh2,
        fontSize: 13, zIndex: 80, maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: "none", background: "transparent", color: COLORS.clay,
            fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit",
          }}
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={closeLabel}
        style={{ border: "none", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer", padding: 0, fontSize: 15, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

export { ToastProvider, useToast, Toast };
