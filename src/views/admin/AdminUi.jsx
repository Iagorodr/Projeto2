// Peças visuais da página de administração (/admin).
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW, FONT } from "../../styles/tokens.js";

export const inputStyle = {
  width: "100%", height: 42, borderRadius: RADIUS.control, border: `1px solid ${COLORS.lineInput}`,
  padding: "0 12px", fontSize: 14, color: COLORS.ink, background: COLORS.card, boxSizing: "border-box", fontFamily: "inherit",
};

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink2 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: COLORS.ink3, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

const TONES = {
  ok: { bg: COLORS.okTint, ink: COLORS.okInk },
  warn: { bg: COLORS.amberBg, ink: COLORS.amberInk },
  bad: { bg: COLORS.alertTint, ink: COLORS.alert },
  off: { bg: "#E8ECEA", ink: "#4B5A53" },
};
export function Badge({ tone = "ok", children }) {
  const t = TONES[tone] || TONES.ok;
  return (
    <span style={{ display: "inline-block", background: t.bg, color: t.ink, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// Janela por cima da página (Esc ou clicar fora fecha).
export function Dialog({ title, onClose, children, width = 520 }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto", zIndex: 50 }}
    >
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        style={{ width, maxWidth: "100%", background: COLORS.card, borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, padding: "22px 22px 24px", outline: "none", boxSizing: "border-box" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 19, fontWeight: 600, color: COLORS.ink }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.ink3, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
