import { useEffect, useState } from "react";

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

export { useBreakpoint };
