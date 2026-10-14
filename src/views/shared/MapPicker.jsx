// Escolha do aplicativo de mapas ao tocar no endereço de um cliente.
//
// Folha inferior no telemóvel / cartão ao centro no PC (mesmo padrão do
// MoreSheet e do ConfirmDialog). Cada opção é uma ligação normal (<a>), para
// o sistema poder abrir o aplicativo instalado; no Android há ainda "Outro
// aplicativo…" (ligação geo:), que abre o seletor do sistema com todos os
// aplicativos de mapas instalados. Ver `models/mapLinks.js`.
import { useEffect, useState } from "react";
import { MapPin, Navigation, Copy, Check, X, ExternalLink } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { T } from "../../models/i18n.js";
import { detectPlatform, placeQuery, mapOptions } from "../../models/mapLinks.js";

const OPTION_ICON = { apple: MapPin, google: MapPin, waze: Navigation, other: ExternalLink };

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cai para o método antigo */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const rowStyle = {
  display: "flex", alignItems: "center", gap: 14, height: 62, padding: "0 18px", width: "100%",
  border: "none", borderTop: `1px solid ${COLORS.lineSoft}`, background: "transparent",
  cursor: "pointer", fontFamily: "inherit", textDecoration: "none", color: COLORS.ink, boxSizing: "border-box",
};

function MapPickerSheet({ open, onClose, query, lang }) {
  const c0 = T[lang].common;
  const [copied, setCopied] = useState(false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : true);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    // Esc fecha só esta folha (captura + stopImmediatePropagation): por baixo
    // pode estar uma gaveta que também fecharia com o mesmo Esc.
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose?.();
    }
    function onResize() { setIsNarrow(window.innerWidth < 640); }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    onResize();
    return () => { window.removeEventListener("keydown", onKeyDown, true); window.removeEventListener("resize", onResize); };
  }, [open, onClose]);

  if (!open || !query) return null;

  const options = mapOptions(query, detectPlatform());

  async function handleCopy() {
    const ok = await copyText(query);
    if (ok) { setCopied(true); setTimeout(() => onClose?.(), 900); }
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={c0.mapPickTitle}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,49,41,.45)", zIndex: 95, display: "flex", alignItems: isNarrow ? "flex-end" : "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isNarrow ? "100%" : 380, background: COLORS.card, boxShadow: SHADOW.sh2, overflow: "hidden",
          borderRadius: isNarrow ? `${RADIUS.sheetMobile}px ${RADIUS.sheetMobile}px 0 0` : RADIUS.card,
          paddingBottom: isNarrow ? "env(safe-area-inset-bottom, 12px)" : 0,
        }}
      >
        {isNarrow && (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
            <div style={{ width: 44, height: 5, borderRadius: 3, background: COLORS.line }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 18px 12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink }}>{c0.mapPickTitle}</div>
            <div style={{ fontSize: 13, color: COLORS.ink2, marginTop: 2, overflowWrap: "anywhere" }}>{query}</div>
          </div>
          <button
            type="button" onClick={onClose} aria-label={c0.close || "×"}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: COLORS.lineSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X size={18} strokeWidth={2} color={COLORS.ink2} />
          </button>
        </div>

        {options.map((o) => {
          const Icon = OPTION_ICON[o.key] || MapPin;
          const external = o.external !== false;
          return (
            <a
              key={o.key} href={o.href} style={rowStyle}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => { setTimeout(() => onClose?.(), 0); }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 12, background: COLORS.rowIconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={19} strokeWidth={1.9} color={COLORS.rowIconInk} />
              </span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 16, fontWeight: 600 }}>{c0[o.labelKey]}</span>
            </a>
          );
        })}

        <button type="button" onClick={handleCopy} style={rowStyle}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: COLORS.rowIconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {copied ? <Check size={19} strokeWidth={2.2} color={COLORS.vivo} /> : <Copy size={19} strokeWidth={1.9} color={COLORS.rowIconInk} />}
          </span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 16, fontWeight: 600, color: copied ? COLORS.vivo : COLORS.ink }}>
            {copied ? c0.mapAddressCopied : c0.mapCopyAddress}
          </span>
        </button>
      </div>
    </div>
  );
}

// Controla a folha e entrega `onOpen` a quem desenha o endereço (render prop),
// para o próprio texto do endereço e o botão "Abrir no mapa" abrirem a mesma
// folha. Sem endereço, `onOpen` é null e nada abre.
function MapTrigger({ client, lang, render }) {
  const [open, setOpen] = useState(false);
  const query = placeQuery(client);
  return (
    <>
      {render({ onOpen: query ? () => setOpen(true) : null })}
      <MapPickerSheet open={open} onClose={() => setOpen(false)} query={query} lang={lang} />
    </>
  );
}

export { MapPickerSheet, MapTrigger };
