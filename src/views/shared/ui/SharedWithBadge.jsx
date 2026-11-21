// Selo "cliente feito por mais de uma pessoa neste dia": ícone de pessoas com
// o número de quem fez o cliente. Ao passar o rato ou tocar/clicar abre uma
// pequena lista com quem são (e a parte de cada um). Fica em posição fixa
// calculada a partir do botão, para não ser cortada pelo scroll da gaveta.
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Users } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";

const POPOVER_WIDTH = 300;

// people: [{ id, name, hoursLabel }]
function SharedWithBadge({ people, title, heading, note, summary }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  function close() { setOpen(false); setPinned(false); }

  // Posiciona por baixo do botão (ou por cima se não houver espaço), sempre
  // dentro da janela.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const h = popRef.current ? popRef.current.offsetHeight : 120;
    const below = window.innerHeight - r.bottom;
    const top = below >= h + 12 ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    const left = Math.min(Math.max(8, r.right - POPOVER_WIDTH), window.innerWidth - POPOVER_WIDTH - 8);
    setPos({ top, left });
  }, [open, people.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      close();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={title}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) setOpen(false); }}
        onClick={() => { if (pinned) close(); else { setPinned(true); setOpen(true); } }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 8px",
          borderRadius: 999, border: `1.5px solid ${COLORS.iconBorder}`, background: COLORS.mint,
          color: COLORS.vivo, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        <Users size={13} strokeWidth={2.4} />
        {people.length}
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: POPOVER_WIDTH, zIndex: 1000,
            background: COLORS.card, border: `1.5px solid ${COLORS.iconBorder}`, borderRadius: RADIUS.control,
            boxShadow: "0 8px 24px rgba(20,63,53,.18)", padding: "12px 14px", boxSizing: "border-box", maxWidth: "calc(100vw - 16px)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>{heading}</div>
          {people.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, color: COLORS.ink, padding: "3px 0" }}>
              <span style={{ fontWeight: p.self ? 700 : 500 }}>{p.name}</span>
              <span style={{ color: COLORS.ink2 }}>{p.hoursLabel}</span>
            </div>
          ))}
          {summary && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.line}`, fontSize: 13.5, lineHeight: 1.45 }}>
              {summary.rows ? summary.rows.map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: COLORS.ink2, padding: "2px 0" }}>
                  <span>{r.label}</span><span style={{ color: COLORS.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
                </div>
              )) : <div style={{ color: COLORS.ink2 }}>{summary.line}</div>}
              <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: RADIUS.chip, fontWeight: 700, fontSize: 13, background: summary.ok ? COLORS.okTint : COLORS.amberBg, color: summary.ok ? COLORS.okInk : COLORS.amberInk }}>{summary.ok ? "✓ " : "⚠ "}{summary.verdict}</div>
            </div>
          )}
          {note && <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 8, lineHeight: 1.45 }}>{note}</div>}
        </div>,
        document.body
      )}
    </>
  );
}

export { SharedWithBadge };
