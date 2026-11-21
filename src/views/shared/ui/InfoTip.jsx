// InfoTip (documento de design, Lote 4, 4.5 — achado da Marta: "Textos
// explicativos demais: usar botões (i)"). Ícone (i) que abre um balão com
// o texto completo, no lugar de deixar sempre visível um texto pequeno
// (11 a 13 px) que hoje não muda nenhuma decisão na hora. Regra do
// relatório: só fica à vista o que muda uma decisão agora, o motivo de um
// botão desativado, ou um aviso de estado — o resto vira isto.
//
// Ícone de 20 px dentro de uma área de toque de 40 (desktop) / 48
// (tablet, celular, ou ponteiro grosso) por `useControlSize` — mesma
// régua da 4.4 — sem fundo nem contorno (só a área de clique, o desenho
// visível é só o ícone). Abre ao passar o mouse e, no toque, ao
// tocar/clicar; fecha com Esc ou clique fora; acessível por teclado (Tab
// alcança o botão, foco abre o balão, Esc fecha); `aria-label` (passado
// por quem usa, já traduzido) e o balão ligado ao botão por
// `aria-describedby`, como pede o documento.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS } from "../../../styles/tokens.js";
import { useControlSize } from "../../../hooks/useBreakpoint.js";

function InfoTip({ text, label = "Mais informações", style, balloonStyle }) {
  const [open, setOpen] = useState(false);
  const { minTap } = useControlSize();
  const balloonId = useId();
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const balloonRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // O balão é desenhado por cima de tudo (fixo, no body) e fica sempre dentro do ecrã:
  // numa gaveta ou perto da borda direita não é cortado.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = balloonRef.current ? balloonRef.current.offsetWidth : 260;
    const h = balloonRef.current ? balloonRef.current.offsetHeight : 80;
    const below = window.innerHeight - r.bottom;
    const top = below >= h + 12 ? r.bottom + 2 : Math.max(8, r.top - h - 2);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
    setPos({ top, left });
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target) && !(balloonRef.current && balloonRef.current.contains(e.target))) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      // O mouseenter/mouseleave ficam no wrapper (não só no botão) para o
      // balão não fechar quando o cursor desce do ícone até o próprio
      // balão (ex.: pra selecionar o texto).
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", ...style }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? balloonId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          width: minTap, height: minTap, border: "none", background: "transparent", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          color: COLORS.ink3, flexShrink: 0,
        }}
      >
        <Info size={20} strokeWidth={1.8} />
      </button>
      {open && createPortal(
        <div
          ref={balloonRef}
          id={balloonId}
          role="tooltip"
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 1000,
            background: COLORS.card, color: COLORS.ink, border: `1px solid ${COLORS.line}`,
            borderRadius: RADIUS.control, boxShadow: "0 4px 14px rgba(20,63,53,.15)",
            padding: "10px 12px", fontSize: 12.5, fontWeight: 400, lineHeight: 1.45,
            maxWidth: "min(300px, calc(100vw - 16px))", width: "max-content",
            ...balloonStyle,
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}

export { InfoTip };
