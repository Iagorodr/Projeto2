import { useEffect, useState } from "react";

// O navegador dispara "beforeinstallprompt" quando a PWA pode ser instalada
// (Android/Chrome, Edge, etc.) — guardamos esse evento para poder chamar
// prompt() mais tarde, no clique do nosso próprio botão, em vez de deixar o
// navegador mostrar o banner dele por conta própria. No iOS a Apple nunca
// dispara este evento — lá o único caminho é o manual (Partilhar > Adicionar
// ao Ecrã Principal), por isso expomos "isIOS" para a UI mostrar instruções
// em vez de tentar chamar prompt().
function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    const standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = window.navigator && window.navigator.standalone === true;
    return !!(standalone || iosStandalone);
  });

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent || "");

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === "accepted";
  }

  return { installed, isIOS, canPromptNative: !!deferredPrompt, promptInstall };
}

export { useInstallPrompt };
