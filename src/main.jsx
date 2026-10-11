import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import InstallPage from "./views/InstallPage.jsx";
import "./index.css";

// Se o app instalado abrir na página de instalação (acontece quando se
// instala a partir dela), segue direto para o app.
try {
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  if (standalone && window.location.pathname.replace(/\/+$/, "") === "/instalar") window.location.replace("/");
} catch (e) { /* ignora */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/+$/, "") === "/instalar" ? <InstallPage /> : <App />}
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Falha ao registar o service worker:", err);
    });
  });
}
