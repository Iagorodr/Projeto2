// Selo "cliente feito por mais de uma pessoa neste dia": ícone de pessoas com
// o número de quem fez o cliente. Ao passar o rato ou tocar/clicar abre uma
// pequena lista com quem são (e a parte de cada um). Fica em posição fixa
// calculada a partir do botão, para não ser cortada pelo scroll da gaveta.
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Users } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";

const POPOVER_WIDTH = 240;

// people: [{ id, name, hoursLabel }]
function SharedWithBadge({ people, title, heading, note }) {
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
      {open && (
        <div
          ref={popRef}
          role="tooltip"
          style={{
            position: "fixed", top: pos.top, left: pos.left, width: POPOVER_WIDTH, zIndex: 1000,
            background: COLORS.card, border: `1.5px solid ${COLORS.iconBorder}`, borderRadius: RADIUS.control,
            boxShadow: "0 8px 24px rgba(20,63,53,.18)", padding: "10px 12px", boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 6 }}>{heading}</div>
          {people.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: COLORS.ink, padding: "2px 0" }}>
              <span style={{ fontWeight: p.self ? 700 : 500 }}>{p.name}</span>
              <span style={{ color: COLORS.ink2 }}>{p.hoursLabel}</span>
            </div>
          ))}
          {note && <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 6 }}>{note}</div>}
        </div>
      )}
    </>
  );
}

export { SharedWithBadge };
