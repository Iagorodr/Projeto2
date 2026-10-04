import { useEffect, useState } from "react";
import { RADIUS } from "../styles/tokens.js";

// A casca (documento de design, 3.2) usa 3 níveis — PC ≥1024, tablet
// 640-1023, telemóvel <640 — diferentes do único corte de `useIsMobile`
// (700px, pensado só para "cabe/não cabe" em ecrãs que não foram
// redesenhados para mobile). Os componentes novos da casca (Etapa 3:
// AppSidebar, MobileBottomBar, PageHeader...) usam este hook; os ecrãs
// antigos continuam com `useIsMobile` até serem trocados na Etapa 4.
function getTier(width) {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function useBreakpoint() {
  const [tier, setTier] = useState(
    typeof window !== "undefined" ? getTier(window.innerWidth) : "desktop"
  );

  useEffect(() => {
    function onResize() { setTier(getTier(window.innerWidth)); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return tier; // "mobile" | "tablet" | "desktop"
}

// Lote 4, 4.4 (achado da Marta): "pointer: coarse" sobe para o tamanho de
// toque mesmo em largura de desktop — é o caso do iPad na horizontal
// (≥1024px de largura, mas sem mouse). Sem isto ele cairia no tier
// "desktop" por largura e receberia controlos pensados pra mouse (40px)
// numa tela sem cursor de precisão.
function useCoarsePointer() {
  const getsCoarse = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  const [coarse, setCoarse] = useState(getsCoarse);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(pointer: coarse)");
    function onChange() { setCoarse(mq.matches); }
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange); // Safari antigo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return coarse;
}

// Lote 4, 4.4: tokens de controlo por DISPOSITIVO (não só por largura de
// tela) — altura 40 no desktop (mouse) e 48 no tablet, no celular, ou no
// desktop com ponteiro grosso (iPad horizontal); raio 12 no desktop e no
// tablet, 16 só no celular (o raio sobe por tamanho de tela real, não
// por ponteiro — um iPad horizontal continua com cantos de 12, documento
// 3.2); área mínima de clique = a própria altura (40×40 / 48×48).
function useControlSize() {
  const tier = useBreakpoint();
  const coarse = useCoarsePointer();
  const touchSized = tier !== "desktop" || coarse;
  return {
    tier,
    coarse,
    height: touchSized ? 48 : 40,
    radius: tier === "mobile" ? RADIUS.controlMobile : RADIUS.control,
    minTap: touchSized ? 48 : 40,
  };
}

export { useBreakpoint, useCoarsePointer, useControlSize };
