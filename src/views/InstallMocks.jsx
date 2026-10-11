import React from "react";
import { Share, MoreVertical, ChevronDown, Copy, Bookmark, Glasses, Star, Printer, PlusSquare,
  Search, Camera, ChevronLeft, ChevronRight, BookOpen, Layers, Download, Plus, Clock } from "lucide-react";

// Ilustrações simples dos ecrãs do telemóvel, com a opção a tocar destacada.
// São desenhos feitos em código (não capturas reais), por isso funcionam nas 3 línguas.

const RED = "#E5484D";
const L = {
  pt: { copy: "Copiar", fav: "Adicionar a Favoritos", more: "Ver Mais", airdrop: "AirDrop", msgs: "Mensagens", mail: "E-mail", wa: "WhatsApp",
    favList: "Adicionar aos favoritos", qr: "Criar um QR code", find: "Buscar na página", print: "Imprimir", add: "Adicionar à Tela de Início",
    cancel: "Cancelar", addBtn: "Adicionar", addTitle: "Adicionar à Tela de Início", url: "servix-empresa-x.vercel.app",
    newTab: "Nova guia", bookmarks: "Favoritos", history: "Histórico", install: "Instalar app", share: "Partilhar…", installQ: "Instalar app?", installBtn: "Instalar" },
  en: { copy: "Copy", fav: "Add to Favorites", more: "Show More", airdrop: "AirDrop", msgs: "Messages", mail: "Mail", wa: "WhatsApp",
    favList: "Add to Favorites", qr: "Create a QR code", find: "Find on Page", print: "Print", add: "Add to Home Screen",
    cancel: "Cancel", addBtn: "Add", addTitle: "Add to Home Screen", url: "servix-empresa-x.vercel.app",
    newTab: "New tab", bookmarks: "Bookmarks", history: "History", install: "Install app", share: "Share…", installQ: "Install app?", installBtn: "Install" },
  fr: { copy: "Copier", fav: "Ajouter aux favoris", more: "Plus", airdrop: "AirDrop", msgs: "Messages", mail: "Mail", wa: "WhatsApp",
    favList: "Ajouter aux favoris", qr: "Créer un QR code", find: "Rechercher", print: "Imprimer", add: "Sur l'écran d'accueil",
    cancel: "Annuler", addBtn: "Ajouter", addTitle: "Sur l'écran d'accueil", url: "servix-empresa-x.vercel.app",
    newTab: "Nouvel onglet", bookmarks: "Favoris", history: "Historique", install: "Installer l'application", share: "Partager…", installQ: "Installer l'appli ?", installBtn: "Installer" },
};

const hl = (on) => (on ? { outline: `3px solid ${RED}`, outlineOffset: 2, boxShadow: `0 0 0 7px rgba(229,72,77,.22)`, animation: "svxPulse 1.4s ease-in-out infinite" } : {});

function Frame({ children, bg = "#fff", style }) {
  return (
    <div style={{ width: "100%", maxWidth: 290, margin: "12px auto 0", borderRadius: 20, border: "6px solid #1c1c1e", background: bg, overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,.18)", ...style }}>
      {children}
    </div>
  );
}

function Status() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px 3px", fontSize: 10, fontWeight: 700, color: "#111" }}>
      <span>9:41</span><span>●●● ▮</span>
    </div>
  );
}

function AppLogo({ size = 34 }) {
  return <img src="/icon-192.png" alt="" width={size} height={size} style={{ borderRadius: size * 0.23, flexShrink: 0 }} />;
}

// Barra de endereço do Chrome no iPhone (partilhar no canto superior direito)
function ChromeBar({ t }) {
  return (
    <Frame bg="#F3F6F4">
      <Status />
      <div style={{ margin: "2px 8px 8px", background: "#E4E7EA", borderRadius: 12, display: "flex", alignItems: "center", padding: "7px 10px", gap: 8 }}>
        <Camera size={14} color="#444" />
        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#222", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.url}</div>
        <div style={{ borderRadius: 8, padding: 3, ...hl(true) }}><Share size={15} color="#222" /></div>
      </div>
      <PageBlur />
    </Frame>
  );
}

function PageBlur() {
  return (
    <div style={{ padding: "6px 14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ height: 14, width: "55%", borderRadius: 7, background: "#D6DDD9" }} />
      <div style={{ height: 10, width: "85%", borderRadius: 5, background: "#E3E8E5" }} />
      <div style={{ height: 10, width: "70%", borderRadius: 5, background: "#E3E8E5" }} />
    </div>
  );
}

// Barra de baixo do Safari
function SafariBar({ t }) {
  return (
    <Frame bg="#F3F6F4">
      <Status />
      <PageBlur />
      <div style={{ height: 44 }} />
      <div style={{ background: "#F7F7F8", borderTop: "1px solid #DADDE0", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "9px 6px" }}>
        <ChevronLeft size={18} color="#2A6CF0" />
        <ChevronRight size={18} color="#9AA3AB" />
        <div style={{ borderRadius: 8, padding: 3, ...hl(true) }}><Share size={18} color="#2A6CF0" /></div>
        <BookOpen size={18} color="#2A6CF0" />
        <Layers size={18} color="#2A6CF0" />
      </div>
    </Frame>
  );
}

function SheetHeader({ t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px 8px", borderBottom: "1px solid #D9D9DE" }}>
      <AppLogo />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#111" }}>Servix</div>
        <div style={{ fontSize: 9.5, color: "#6b6b70", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.url}</div>
      </div>
    </div>
  );
}

function AppsRow({ t }) {
  const apps = [["#2E8BFF", t.airdrop], ["#3DDC63", t.msgs], ["#2F7DF6", t.mail], ["#25D366", t.wa]];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 8px", borderBottom: "1px solid #D9D9DE" }}>
      {apps.map(([c, n]) => (
        <div key={n} style={{ width: 54, textAlign: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: c, margin: "0 auto 3px" }} />
          <div style={{ fontSize: 8.5, color: "#222" }}>{n}</div>
        </div>
      ))}
    </div>
  );
}

function ActionsRow({ t, expanded, highlightMore }) {
  const acts = [[Copy, t.copy], [Bookmark, t.fav], [Glasses, "Lista de Leitura"]];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 8px" }}>
      {acts.map(([I, n], i) => (
        <div key={i} style={{ width: 54, textAlign: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E0E0E4", margin: "0 auto 3px", display: "flex", alignItems: "center", justifyContent: "center" }}><I size={16} color="#222" /></div>
          <div style={{ fontSize: 8, color: "#222", lineHeight: 1.1 }}>{i === 2 ? (t.copy === "Copiar" ? "Lista de Leitura" : t.copy === "Copy" ? "Reading List" : "Liste de lecture") : n}</div>
        </div>
      ))}
      <div style={{ width: 54, textAlign: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#E0E0E4", margin: "0 auto 3px", display: "flex", alignItems: "center", justifyContent: "center", ...hl(highlightMore) }}>
          <ChevronDown size={18} color="#222" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        </div>
        <div style={{ fontSize: 8, color: "#222" }}>{t.more}</div>
      </div>
    </div>
  );
}

function SheetCollapsed({ t }) {
  return (
    <Frame bg="#E9EEEB">
      <div style={{ height: 30, background: "#E9EEEB" }}><Status /></div>
      <div style={{ background: "#F6F6F8", borderRadius: "18px 18px 0 0", padding: "12px 12px 6px" }}>
        <SheetHeader t={t} />
        <AppsRow t={t} />
        <ActionsRow t={t} highlightMore />
      </div>
    </Frame>
  );
}

function SheetExpanded({ t }) {
  const rows = [[Star, t.favList, false], [Search, t.find, false], [Printer, t.print, false]];
  return (
    <Frame bg="#E9EEEB">
      <div style={{ height: 30, background: "#E9EEEB" }}><Status /></div>
      <div style={{ background: "#F6F6F8", borderRadius: "18px 18px 0 0", padding: "12px 12px 8px" }}>
        <SheetHeader t={t} />
        <ActionsRow t={t} expanded />
        <div style={{ background: "#EAEAEE", borderRadius: 10, padding: "0 10px", marginBottom: 8 }}>
          {rows.map(([I, n], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", fontSize: 11, color: "#222", borderBottom: i < rows.length - 1 ? "1px solid #D5D5DA" : "none" }}>
              <I size={15} />{n}
            </div>
          ))}
        </div>
        <div style={{ background: "#EAEAEE", borderRadius: 10, padding: "0 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", fontSize: 11, fontWeight: 600, color: "#111", borderRadius: 6, ...hl(true) }}>
            <PlusSquare size={15} />{t.add}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function IosConfirm({ t }) {
  return (
    <Frame bg="#E9EEEB">
      <div style={{ height: 30, background: "#E9EEEB" }}><Status /></div>
      <div style={{ background: "#F6F6F8", borderRadius: "18px 18px 0 0", padding: "12px 12px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, fontSize: 11 }}>
          <span style={{ color: "#2A6CF0" }}>{t.cancel}</span>
          <span style={{ fontWeight: 700, color: "#111" }}>{t.addTitle}</span>
          <span style={{ color: "#2A6CF0", fontWeight: 700, borderRadius: 6, padding: "1px 4px", ...hl(true) }}>{t.addBtn}</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <AppLogo size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111", borderBottom: "1px solid #E0E0E4", paddingBottom: 4 }}>Servix</div>
            <div style={{ fontSize: 9.5, color: "#6b6b70", paddingTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.url}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function AndroidDots({ t }) {
  return (
    <Frame bg="#F3F6F4">
      <Status />
      <div style={{ margin: "2px 8px 8px", background: "#EDEFF2", borderRadius: 22, display: "flex", alignItems: "center", padding: "8px 8px 8px 14px", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 11, color: "#222", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.url}</div>
        <div style={{ borderRadius: 8, padding: 3, ...hl(true) }}><MoreVertical size={16} color="#222" /></div>
      </div>
      <PageBlur />
    </Frame>
  );
}

function AndroidMenu({ t }) {
  const rows = [[Plus, t.newTab], [Star, t.bookmarks], [Clock, t.history]];
  return (
    <Frame bg="#F3F6F4">
      <Status />
      <div style={{ margin: "2px 8px 14px 60px", background: "#fff", borderRadius: 14, boxShadow: "0 3px 12px rgba(0,0,0,.25)", padding: "6px 10px" }}>
        {rows.map(([I, n], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 11, color: "#222" }}><I size={14} />{n}</div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", fontSize: 11, fontWeight: 600, color: "#111", borderRadius: 6, ...hl(true) }}><Download size={14} />{t.install}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 11, color: "#222" }}><Share size={14} />{t.share}</div>
      </div>
    </Frame>
  );
}

function AndroidInstall({ t }) {
  return (
    <Frame bg="#7A8580" style={{ paddingBottom: 18 }}>
      <Status />
      <div style={{ margin: "26px 14px 10px", background: "#fff", borderRadius: 22, padding: "16px 14px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 12 }}>{t.installQ}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <AppLogo size={30} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#111" }}>Servix</div>
            <div style={{ fontSize: 9.5, color: "#6b6b70" }}>{t.url}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 11.5, fontWeight: 600 }}>
          <span style={{ color: "#2A6CF0", padding: "6px 10px" }}>{t.cancel}</span>
          <span style={{ background: "#2A6CF0", color: "#fff", padding: "6px 14px", borderRadius: 16, ...hl(true) }}>{t.installBtn}</span>
        </div>
      </div>
    </Frame>
  );
}

const SHOTS = { chromeBar: ChromeBar, safariBar: SafariBar, sheetCollapsed: SheetCollapsed, sheetExpanded: SheetExpanded, iosConfirm: IosConfirm, androidDots: AndroidDots, androidMenu: AndroidMenu, androidInstall: AndroidInstall };

function Shot({ name, lang }) {
  const C = SHOTS[name];
  if (!C) return null;
  return <C t={L[lang] || L.pt} />;
}

export { Shot };
