// Versão nova publicada → o app atualiza-se sozinho.
// O app instalado no telemóvel fica aberto dias seguidos e continuaria com o
// código antigo (ex.: sem visitas avulsas). Compara o ficheiro principal que está
// a correr com o que o servidor tem agora:
//  • ao voltar ao app (depois de estar em segundo plano) → recarrega logo;
//  • com o app à frente → mostra uma faixa "Há uma versão nova · Atualizar".
const ENTRY_RE = /\/assets\/index-[\w-]+\.js/;
const TEXT = {
  pt: { msg: "Há uma versão nova do Servix.", btn: "Atualizar" },
  en: { msg: "A new version of Servix is available.", btn: "Update" },
  fr: { msg: "Une nouvelle version de Servix est disponible.", btn: "Mettre à jour" },
};

function runningEntry() {
  for (const s of document.querySelectorAll("script[src]")) {
    const m = s.src.match(ENTRY_RE);
    if (m) return m[0];
  }
  return null;
}
async function serverEntry() {
  const r = await fetch(`/?_v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) return null;
  const m = (await r.text()).match(ENTRY_RE);
  return m ? m[0] : null;
}
function showBanner() {
  if (document.getElementById("sx-update")) return;
  let lang = "pt";
  try { lang = (localStorage.getItem("servix_lang") || document.documentElement.lang || "pt").slice(0, 2); } catch { /* ignora */ }
  const t = TEXT[lang] || TEXT.pt;
  const bar = document.createElement("div");
  bar.id = "sx-update";
  bar.setAttribute("role", "status");
  bar.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 12px);z-index:200;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:14px;background:#123D2C;color:#fff;font-family:inherit;box-shadow:0 10px 30px rgba(0,0,0,.25);width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;font-size:14px;font-weight:600";
  const span = document.createElement("span");
  span.textContent = t.msg;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = t.btn;
  btn.style.cssText = "border:none;border-radius:10px;padding:8px 14px;background:#fff;color:#123D2C;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0";
  btn.onclick = () => window.location.reload();
  bar.append(span, btn);
  document.body.appendChild(bar);
}

export function startVersionCheck() {
  const mine = runningEntry();
  if (!mine) return; // modo de desenvolvimento
  let hiddenAt = 0;
  let checking = false;
  async function check(fromBackground) {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const latest = await serverEntry();
      if (latest && latest !== mine) {
        if (fromBackground) window.location.reload();
        else showBanner();
      }
    } catch { /* sem rede: tenta mais tarde */ } finally { checking = false; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    // Voltou ao app depois de pelo menos 30 s fora: nada a meio de escrever.
    check(hiddenAt > 0 && Date.now() - hiddenAt > 30000);
  });
  setInterval(() => { if (document.visibilityState === "visible") check(false); }, 15 * 60 * 1000);
  setTimeout(() => check(false), 60 * 1000);
}
