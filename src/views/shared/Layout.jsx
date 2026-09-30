import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
  Download, Share,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { LANG_NAMES, MENU_ITEMS } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { LogoLockup, LogoMark } from "./Logo.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { useInstallPrompt } from "../../hooks/useInstallPrompt.js";

function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button style={styles.langButton} onClick={() => setOpen((o) => !o)}>
        {LANG_NAMES[lang]}
        <ChevronDown size={14} style={{ marginLeft: 4 }} />
      </button>
      {open && (
        <div style={styles.langMenu}>
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

function Sidebar({ activeKey, onNavigate, onLogout, company, lang, items, labels, brandOverride }) {
  const t = labels || T[lang].sidebar;
  const menuItems = items || MENU_ITEMS;
  const brandName = brandOverride ? brandOverride.name : company.name;
  const brandSub = brandOverride ? brandOverride.sub : company.email;
  const isMobile = useIsMobile();

  // No desktop a barra mostra logo + nome da empresa + rótulo de cada
  // item. Num ecrã estreito isso não cabe, então vira uma faixa fina só
  // com os ícones — a navegação continua igual, só sem o texto.
  const sidebarStyle = isMobile
    ? { ...styles.sidebar, width: 64, padding: "14px 6px", alignItems: "center" }
    : styles.sidebar;
  const menuItemStyle = (active) => {
    const base = { ...styles.menuItem, ...(active ? styles.menuItemActive : {}) };
    return isMobile ? { ...base, justifyContent: "center", padding: "10px 0", gap: 0 } : base;
  };

  return (
    <div style={sidebarStyle}>
      <div style={isMobile ? { ...styles.sidebarProductRow, padding: "8px", display: "flex", justifyContent: "center" } : styles.sidebarProductRow}>
        {isMobile ? <LogoMark size={20} tone="default" /> : <LogoLockup size={20} tone="default" />}
      </div>
      {!isMobile && (
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
              title={isMobile ? t[item.key] : undefined}
            >
              <span style={{ ...styles.menuIconWrap, ...(active ? styles.menuIconWrapActive : {}) }}>
                <Icon size={15} />
              </span>
              {!isMobile && <span>{t[item.key]}</span>}
            </button>
          );
        })}
      </div>
      <button style={{ ...styles.sairRow, ...(isMobile ? { fontSize: 11, padding: "8px 0" } : {}) }} onClick={onLogout} title={isMobile ? T[lang].common.logout : undefined}>
        {isMobile ? "⏻" : T[lang].common.logout}
      </button>
    </div>
  );
}

function TopBar({ lang, setLang, label }) {
  return (
    <div style={styles.topBar}>
      <div style={styles.todayLabel}>{label}</div>
      <LangSwitcher lang={lang} setLang={setLang} />
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

export { LangSwitcher, Sidebar, TopBar, Field, ViewField, InstallAppButton };
