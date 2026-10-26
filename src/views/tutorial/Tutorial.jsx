// Tutorial de primeiro acesso: cartões que se passam de lado (gerência 6, supervisor 5,
// funcionário 6). Desenho do Tomás ("Recorte da app"). Telemóvel: ecrã inteiro;
// PC/tablet: janela 740 × 470 sobre o fundo escurecido. "Saltar" não pede confirmação.
import { useEffect, useRef, useState } from "react";
import { ILLUSTRATIONS } from "./illustrations.js";
import { TUTORIAL_SLIDES, TUTORIAL_UI, ILLUS, WEEKDAY_INITIALS } from "../../models/tutorialTexts.js";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";

const FOREST = "#143F35";
const GREEN = "#1F7A5F";
const MINT = "#E4EFEA";
const TEXT = "#3E524B";
const SKIP = "#4F635C";
const DOT = "#C3D4CC";
const PAPER = "#F7FAF8";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const initialsOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : "")).toUpperCase();
};

// Troca os textos do SVG pelo idioma da app e põe o nome/empresa reais no 1.º cartão.
function localize(svg, lang, { userName, companyName }) {
  const dict = lang === "pt" ? {} : ILLUS[lang] || {};
  const weekdays = WEEKDAY_INITIALS[lang] || WEEKDAY_INITIALS.pt;
  const ui = TUTORIAL_UI[lang] || TUTORIAL_UI.pt;
  const first = String(userName || "").trim().split(/\s+/)[0];
  const company = String(companyName || "").trim();
  let wk = 0;
  return svg.replace(/(<text[^>]*>)([^<]*)(<\/text>)/g, (m, open, txt, close) => {
    if (/^[STQD]$/.test(txt)) return open + esc(weekdays[wk++ % 7]) + close;
    if (txt === "EX" && company) return open + esc(initialsOf(company)) + close;
    if (txt === "AN" && userName) return open + esc(initialsOf(userName)) + close;
    if (txt === "Empresa X" && company) return open + esc(clip(company, 18)) + close;
    if (txt === "Olá, Ana") return open + esc(first ? `${ui.hello}, ${clip(first, 14)}` : ui.hello) + close;
    const k = SHRINK[lang]?.[txt];
    return (k ? scaleFont(open, k) : open) + (dict[txt] ?? txt) + close;
  });
}

// Traduções mais compridas que o desenho prevê: letra um pouco menor (em vez de cortar o texto).
const SHRINK = { fr: { "Avisar falta": 0.86, "Dias em falta na equipa (133)": 0.92 } };
const scaleFont = (open, k) => open.replace(/font-size="([\d.]+)"/, (m, v) => `font-size="${(parseFloat(v) * k).toFixed(1)}"`);

const KEYFRAMES = `
@keyframes tutIn { from { opacity: 0; transform: translateX(var(--tut-dx, 24px)); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .tut-anim { animation: none !important; } }
`;

export default function Tutorial({ lang = "pt", role = "employee", userName = "", companyName = "", onClose }) {
  const tier = useBreakpoint();
  const wide = tier !== "mobile";
  const ui = TUTORIAL_UI[lang] || TUTORIAL_UI.pt;
  const slides = (TUTORIAL_SLIDES[lang] || TUTORIAL_SLIDES.pt)[role] || TUTORIAL_SLIDES.pt.employee;
  const art = ILLUSTRATIONS[role] || ILLUSTRATIONS.employee;
  const n = slides.length;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const touch = useRef(null);
  const boxRef = useRef(null);
  const last = i === n - 1;

  const go = (d) => {
    const j = i + d;
    if (j < 0) return;
    if (j >= n) { onClose?.(); return; }
    setDir(d);
    setI(j);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const html = localize(art[Math.min(i, art.length - 1)], lang, { userName, companyName });
  const slide = slides[i];
  const anim = { animation: "tutIn .28s ease both", ["--tut-dx"]: dir > 0 ? "24px" : "-24px" };

  const skip = (
    <button type="button" onClick={() => onClose?.()} style={{
      border: "none", background: "transparent", color: SKIP, font: "600 15px Inter, sans-serif",
      minHeight: 48, minWidth: 48, padding: "0 8px", cursor: "pointer", borderRadius: 12,
    }}>{ui.skip}</button>
  );

  const controls = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-hidden={i === 0 ? "true" : undefined} style={{
        height: 56, padding: wide ? "0 14px" : "0 18px", borderRadius: 18, background: "#fff", border: `2px solid ${GREEN}`,
        color: GREEN, font: `600 ${wide ? 15 : 16}px Inter, sans-serif`, cursor: i === 0 ? "default" : "pointer",
        opacity: i === 0 ? 0.35 : 1, flexShrink: 0,
      }}>{ui.prev}</button>
      <div role="img" aria-label={ui.step(i + 1, n)} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {slides.map((_, k) => (
          <span key={k} style={{
            display: "block", height: 8, width: k === i ? 20 : 8, borderRadius: 8,
            background: k === i ? GREEN : DOT, transition: "width .2s",
          }} />
        ))}
      </div>
      <button type="button" onClick={() => go(1)} style={{
        height: 56, padding: wide ? "0 14px" : "0 18px", borderRadius: 18, border: "none", color: "#fff",
        background: "linear-gradient(135deg, #238A69, #1A6F56)", font: `600 ${wide ? 15 : 16}px Inter, sans-serif`,
        cursor: "pointer", boxShadow: "0 8px 18px rgba(31,122,95,.28)", flexShrink: 0, minWidth: 96,
      }}>{last ? ui.start : ui.next}</button>
    </div>
  );

  const titleStyle = { margin: 0, font: "600 28px/1.2 Poppins, sans-serif", color: FOREST };
  const bodyStyle = { margin: "10px 0 0", font: "400 17px/1.5 Inter, sans-serif", color: TEXT, minHeight: 104 };

  const art2 = (
    <div key={i} className="tut-anim" style={{ ...anim, width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: html }} />
  );

  if (wide) {
    return (
      <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={ui.label} style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,30,24,.55)", outline: "none",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <style>{KEYFRAMES}</style>
        <div style={{
          width: 740, maxWidth: "100%", height: 470, borderRadius: 28, overflow: "hidden", display: "flex",
          background: PAPER, boxShadow: "0 30px 80px rgba(10,30,24,.4)",
        }}>
          <div style={{ width: 358, flexShrink: 0, background: MINT, overflow: "hidden" }}>{art2}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "0 28px 26px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", height: 60, alignItems: "center", marginRight: -8 }}>{skip}</div>
            <div key={i} className="tut-anim" style={{ ...anim, flex: 1, minHeight: 0 }}>
              <h2 style={titleStyle}>{slide.title}</h2>
              <p style={{ ...bodyStyle, minHeight: 0 }}>{slide.body}</p>
            </div>
            {controls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={ui.label} style={{
      position: "fixed", inset: 0, zIndex: 1000, background: PAPER, display: "flex", flexDirection: "column", outline: "none",
      height: "100dvh", padding: "0 16px calc(26px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box",
      overflowY: "auto",
    }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{KEYFRAMES}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", height: 60, flexShrink: 0 }}>{skip}</div>
      <div style={{
        flex: "1 1 auto", minHeight: 220, maxHeight: 470, borderRadius: 28, background: MINT, overflow: "hidden",
        width: "100%", maxWidth: 358, alignSelf: "center",
      }}>{art2}</div>
      <div key={i} className="tut-anim" style={{ ...anim, flexShrink: 0, padding: "16px 4px 14px", maxWidth: 358, alignSelf: "center", width: "100%" }}>
        <h2 style={titleStyle}>{slide.title}</h2>
        <p style={bodyStyle}>{slide.body}</p>
      </div>
      <div style={{ flexShrink: 0, maxWidth: 358, alignSelf: "center", width: "100%", marginTop: "auto" }}>{controls}</div>
    </div>
  );
}
