import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { LANG_NAMES, MENU_ITEMS } from "../../models/data.js";

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

function Sidebar({ activeKey, onNavigate, onLogout, company }) {
  return (
    <div style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.avatar}>{!company.hasPhoto && company.name.slice(0, 1)}</div>
        <div>
          <div style={styles.brandName}>{company.name}</div>
          <div style={styles.brandEmail}>{company.email}</div>
        </div>
      </div>
      <div style={styles.menuList}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              style={{ ...styles.menuItem, ...(active ? styles.menuItemActive : {}) }}
              onClick={() => onNavigate(item.key)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <button style={styles.sairRow} onClick={onLogout}>Sair</button>
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

function Field({ label, full, children }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
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

export { LangSwitcher, Sidebar, TopBar, Field, ViewField };
