// Estado de gravação sempre visível (redesign B1, funcionalidade nova n.º 1):
// "A guardar…" → "✓ Guardado" → "Sem rede". Não é modo offline: as alterações
// ficam no aparelho e gravam sozinhas quando a rede volta (ver useAppController).
import { Check, CloudOff, Loader2, RotateCw } from "lucide-react";
import { T } from "../../../models/i18n.js";

const CHIP = {
  saved: { bg: "rgba(255,255,255,.18)", ink: "#fff" },
  savedLight: { bg: "var(--p1-12)", ink: "var(--p2)" },
  saving: { bg: "rgba(255,255,255,.18)", ink: "#fff" },
  savingLight: { bg: "#EEF0EC", ink: "#5A625C" },
  offline: { bg: "#D6454A", ink: "#fff" },
};

// `onDark`: o chip está sobre a cor da empresa (cabeçalho do Início).
export function SaveChip({ state = "saved", lang = "pt", onDark = false, style }) {
  const c = T[lang].common;
  const key = state === "offline" ? "offline" : state === "saving" ? (onDark ? "saving" : "savingLight") : (onDark ? "saved" : "savedLight");
  const { bg, ink } = CHIP[key];
  const label = state === "offline" ? c.saveOffline : state === "saving" ? c.saveSaving : c.saveSaved;
  const Icon = state === "offline" ? CloudOff : state === "saving" ? Loader2 : Check;
  return (
    <span role="status" aria-live="polite" style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999,
      background: bg, color: ink, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, ...style,
    }}>
      <Icon size={15} strokeWidth={2.6} style={state === "saving" ? { animation: "b1-spin 1s linear infinite" } : undefined} />
      {label}
    </span>
  );
}

// Barra vermelha (sem rede) com "Tentar de novo".
export function OfflineBar({ state, lang = "pt", onRetry, style }) {
  if (state !== "offline") return null;
  const c = T[lang].common;
  return (
    <div role="alert" className="b1-rise" style={{
      display: "flex", alignItems: "center", gap: 10, background: "#D6454A", color: "#fff",
      borderRadius: 16, padding: "10px 12px 10px 14px", ...style,
    }}>
      <CloudOff size={18} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{c.saveOfflineBar}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", borderRadius: 12,
          border: "none", background: "#fff", color: "#B8343A", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0,
        }}>
          <RotateCw size={15} strokeWidth={2.6} /> {c.saveRetry}
        </button>
      )}
    </div>
  );
}
