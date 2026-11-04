// Páginas carregadas a pedido (React.lazy) com o próprio <Suspense> — assim só a
// área da página espera; o menu e a barra de baixo ficam sempre no sítio.
import { Suspense, lazy } from "react";
import { COLORS } from "../../styles/colors.js";

const loaders = new Map();

function PageFallback() {
  // Esqueleto discreto (aparece só se a rede for lenta; normalmente é instantâneo).
  return (
    <div aria-busy="true" style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 14, animation: "b1-fade .3s .25s both" }}>
      <div style={{ width: 220, height: 26, borderRadius: 8, background: COLORS.lineSoft }} />
      <div style={{ width: "100%", maxWidth: 680, height: 96, borderRadius: 18, background: COLORS.lineSoft }} />
      <div style={{ width: "100%", maxWidth: 680, height: 220, borderRadius: 18, background: COLORS.lineSoft }} />
    </div>
  );
}

// Se um deploy novo trocar os ficheiros enquanto a app está aberta, o chunk
// antigo deixa de existir: recarrega a página uma vez em vez de ficar em branco.
function withReload(loader) {
  return () => loader().then((m) => { try { sessionStorage.removeItem("servix.chunkReload"); } catch { /* ignora */ } return m; }).catch((err) => {
    try {
      const k = "servix.chunkReload";
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); window.location.reload(); return new Promise(() => {}); }
    } catch { /* sem sessionStorage */ }
    throw err;
  });
}

export function lazyPage(loader, { fallback } = {}) {
  const safe = withReload(loader);
  const L = lazy(safe);
  function Page(props) {
    return (
      <Suspense fallback={fallback === undefined ? <PageFallback /> : fallback}>
        <L {...props} />
      </Suspense>
    );
  }
  loaders.set(Page, safe);
  return Page;
}

// Pré-carrega páginas quando o browser está livre.
export function prefetchPages(pages) {
  const run = () => pages.forEach((P) => { const l = loaders.get(P); if (l) l().catch(() => {}); });
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
