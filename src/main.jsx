import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import InstallPage from "./views/InstallPage.jsx";
import "@fontsource-variable/archivo/wdth.css";
import "./index.css";
import { applyStoredTheme } from "./styles/theme.js";
import { startVersionCheck } from "./versionCheck.js";

// Cor da empresa: a última usada neste aparelho, logo no arranque (a da empresa chega depois do login).
applyStoredTheme();

// Página de administração da plataforma (/admin): carregada só quando preciso,
// para não pesar no app das empresas.
const AdminApp = React.lazy(() => import("./views/admin/AdminApp.jsx"));
const path = window.location.pathname.replace(/\/+$/, "");

// Se o app instalado abrir na página de instalação (acontece quando se
// instala a partir dela), segue direto para o app.
try {
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  if (standalone && window.location.pathname.replace(/\/+$/, "") === "/instalar") window.location.replace("/");
} catch (e) { /* ignora */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {path === "/instalar" ? <InstallPage /> : path === "/admin" ? <Suspense fallback={null}><AdminApp /></Suspense> : <App />}
  </React.StrictMode>
);

// Ecrã de carregamento (index.html): sai com um esmorecer quando a app já desenhou.
try {
  const ld = document.getElementById("sx-loader");
  if (ld) setTimeout(() => { ld.style.opacity = "0"; setTimeout(() => ld.remove(), 400); }, 450);
} catch (e) { /* ignora */ }

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Falha ao registar o service worker:", err);
    });
  });
}

// Versão nova publicada: o app aberto há dias atualiza-se sozinho (ver versionCheck.js).
try { if (import.meta.env.PROD) startVersionCheck(); } catch (e) { /* ignora */ }
