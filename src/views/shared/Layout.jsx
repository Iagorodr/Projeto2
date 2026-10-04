import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
  Download, Share, LogOut,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { LANG_NAMES, MENU_ITEMS } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { LogoLockup, LogoMark } from "./Logo.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { useControlSize } from "../../hooks/useBreakpoint.js";
import { useInstallPrompt } from "../../hooks/useInstallPrompt.js";

// Lote 4, 4.4 (achado da Marta: "seletor de idioma hoje 104×30"): não
// tinha altura/raio próprios — vinham só do padding (~28-30px) e de um
// raio solto de 8px (`styles.langButton`). Agora 40/48 e raio 12/16 por
// `useControlSize`, igual a todos os outros controlos.
function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const { height, radius } = useControlSize();
  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...styles.langButton, height, borderRadius: radius }} onClick={() => setOpen((o) => !o)}>
        {LANG_NAMES[lang]}
        <ChevronDown size={14} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div style={{ ...styles.langMenu, top: height + 4, borderRadius: radius }}>
          {Object.keys(LANG_NAMES).map((code) => (
            <button
              key={code}
              style={{ ...styles.langMenuItem, fontWeight: code === lang ? 600 : 400 }}
              onClick={() => { setLang(code); setOpen(false); }}
            >
              {LANG_NAMES[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// `items`/`labels` deixam a barra lateral reutilizável fora da gerência —
// ver o modo desktop do supervisor em App.jsx, que passa SUPERVISOR_MENU_ITEMS
// e um dicionário de rótulos próprio em vez do menu completo da gerência.
// `brandOverride` troca o nome/subtítulo da empresa pelo do próprio supervisor.
// `collapsed` (documento, 3.2: "Na agenda da gerência a sidebar recolhe a
// ícones (76 px) para dar espaço à grelha") força o mesmo visual "só
// ícones" que já existe pra ecrãs estreitos (`isMobile`), só que a
// pedido de UM ecrã específico, independente da largura real da janela
// — por isso 76px aqui (não os 64px do colapso por largura, que é outro
// caso já existente e não mexido). Prop nova, opcional, sem efeito em
// nenhum outro ecrã que não a passe.
function Sidebar({ activeKey, onNavigate, onLogout, company, lang, items, labels, brandOverride, collapsed }) {
  const t = labels || T[lang].sidebar;
  const menuItems = items || MENU_ITEMS;
  const brandName = brandOverride ? brandOverride.name : company.name;
  const brandSub = brandOverride ? brandOverride.sub : company.email;
  const isMobile = useIsMobile();
  const iconOnly = collapsed || isMobile;

  // Lote 4, 4.2 (achado da Marta): o menu rolava junto com a página — em
  // telas longas (Clientes chega a 2695px) o "Sair" ficava inacessível
  // sem rolar até ao fim. `position: sticky` + `height: 100dvh` prendem a
  // barra à janela em vez de deixá-la crescer junto com o `shell` (que
  // continua com `overflow: clip` — não `hidden` — em styles.js, senão o
  // próprio `shell` passaria a ser a "janela de rolagem" de referência do
  // sticky, e ele nunca prenderia à janela real). `alignSelf: flex-start`
  // evita que o `align-items: stretch` do `shell` (flex) brigue com a
  // altura explícita.
  const stickyStyle = { position: "sticky", top: 0, height: "100dvh", alignSelf: "flex-start" };

  // No desktop a barra mostra logo + nome da empresa + rótulo de cada
  // item. Num ecrã estreito isso não cabe, então vira uma faixa fina só
  // com os ícones — a navegação continua igual, só sem o texto.
  const sidebarStyle = iconOnly
    ? { ...styles.sidebar, ...stickyStyle, width: collapsed ? 76 : 64, padding: "14px 6px", alignItems: "center" }
    : { ...styles.sidebar, ...stickyStyle };
  const menuItemStyle = (active) => {
    const base = { ...styles.menuItem, ...(active ? styles.menuItemActive : {}) };
    return iconOnly ? { ...base, justifyContent: "center", padding: "10px 0", gap: 0 } : base;
  };

  return (
    <div style={sidebarStyle}>
      <div style={iconOnly ? { ...styles.sidebarProductRow, padding: "8px", display: "flex", justifyContent: "center" } : styles.sidebarProductRow}>
        {iconOnly ? <LogoMark size={20} tone="default" /> : <LogoLockup size={20} tone="default" />}
      </div>
      {!iconOnly && (
        <div style={styles.brand}>
          <div style={styles.avatar}>
            {!brandOverride && company.photoUrl ? <img src={company.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : brandName.slice(0, 1)}
          </div>
          <div>
            <div style={styles.brandName}>{brandName}</div>
            <div style={styles.brandEmail}>{brandSub}</div>
          </div>
        </div>
      )}
      <div style={styles.menuList}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              style={menuItemStyle(active)}
              onClick={() => onNavigate(item.key)}
              title={iconOnly ? t[item.key] : undefined}
            >
              <span style={{ ...styles.menuIconWrap, ...(active ? styles.menuIconWrapActive : {}) }}>
                <Icon size={15} />
              </span>
              {!iconOnly && <span>{t[item.key]}</span>}
            </button>
          );
        })}
      </div>
      {/* Lote 4, 4.2: trocado o caractere "⏻" (7×30px, sem área de toque
          real) por um botão de verdade com o ícone `LogOut` — 42px de
          altura, ícone+rótulo no modo completo, só o ícone (com
          aria-label e tooltip) no modo recolhido. */}
      <button
        type="button"
        onClick={onLogout}
        aria-label={T[lang].common.logout}
        title={iconOnly ? T[lang].common.logout : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", height: 42, boxSizing: "border-box",
          padding: iconOnly ? 0 : "0 10px", justifyContent: iconOnly ? "center" : "flex-start",
          marginTop: 12, borderTop: `1px solid ${COLORS.border}`, borderLeft: "none", borderRight: "none", borderBottom: "none",
          background: "none", color: COLORS.textSoft, fontSize: 13, fontWeight: 600, cursor: "pointer",
          textAlign: "left", fontFamily: "inherit", flexShrink: 0,
        }}
      >
        <LogOut size={16} />
        {!iconOnly && <span>{T[lang].common.logout}</span>}
      </button>
    </div>
  );
}

function Field({ label, full, required, error, children }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={styles.fieldLabel}>
        {label}
        {required && <span style={{ color: COLORS.extra }}> *</span>}
      </div>
      {children}
      {error && <div style={styles.fieldError}>{error}</div>}
    </div>
  );
}

// Botão "Baixar app": no Android/Chrome dispara o diálogo nativo de
// instalação (guardado via beforeinstallprompt). No iOS a Apple não deixa
// disparar isso por código — lá abrimos um pop-up com o passo a passo
// manual (Partilhar > Adicionar ao Ecrã Principal). Se a app já está
// instalada, ou se o navegador não oferece nenhum dos dois caminhos
// (ex.: desktop), o botão simplesmente não aparece.
function InstallAppButton({ lang }) {
  const t = T[lang].common;
  const { installed, isIOS, canPromptNative, promptInstall } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (installed || (!canPromptNative && !isIOS)) return null;

  function handleClick() {
    if (canPromptNative) promptInstall();
    else if (isIOS) setShowIOSHelp(true);
  }

  return (
    <>
      <button style={styles.installAppButton} onClick={handleClick}>
        <Download size={14} style={{ marginRight: 6 }} />
        {t.installApp}
      </button>
      {showIOSHelp && (
        <div style={styles.modalOverlay} onClick={() => setShowIOSHelp(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{t.installAppIOSTitle}</div>
              <button style={styles.modalClose} onClick={() => setShowIOSHelp(false)}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Share size={16} color={COLORS.primaryDark} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={styles.defSettingHint}>{t.installAppIOSStep1}</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Plus size={16} color={COLORS.primaryDark} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={styles.defSettingHint}>{t.installAppIOSStep2}</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Check size={16} color={COLORS.primaryDark} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={styles.defSettingHint}>{t.installAppIOSStep3}</div>
              </div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.saveButton} onClick={() => setShowIOSHelp(false)}>{t.gotIt}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ViewField({ label, full, icon: Icon, children }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={styles.viewFieldLabel}>
        {Icon && <Icon size={12} style={{ marginRight: 5 }} />}
        {label}
      </div>
      <div style={styles.viewFieldValue}>{children}</div>
    </div>
  );
}

export { LangSwitcher, Sidebar, Field, ViewField, InstallAppButton };
