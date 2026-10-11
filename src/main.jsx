import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import InstallPage from "./views/InstallPage.jsx";
import "./index.css";

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
