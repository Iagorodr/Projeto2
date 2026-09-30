import { useEffect, useState } from "react";

// Detecta ecrã estreito (telemóvel) para adaptar layouts que foram
// desenhados só para desktop — hoje é o caso do login e do painel de
// gerência. Não é um redesenho mobile completo, é só para a experiência
// não ficar quebrada (colunas sobrepostas, conteúdo cortado) se alguém
// abrir essas telas num telemóvel.
function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
}

export { useIsMobile };
