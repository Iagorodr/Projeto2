import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { T } from "../../models/i18n.js";
import { LangSwitcher, InstallAppButton } from "../shared/Layout.jsx";
import { LogoLockup } from "../shared/Logo.jsx";

function EmployeeMenuScreen({ lang, setLang, me, onNavigate, onLogout, avisosBadge }) {
  const t = T[lang].employeeMenu;
  const isSupervisor = me.role === "supervisor";
  const items = [
    { key: "horas", label: t.registerHours },
    { key: "avisos", label: t.notices, badge: avisosBadge },
    { key: "agenda", label: t.agenda },
    { key: "clientes", label: t.clients },
    { key: "historico", label: t.history },
    ...(isSupervisor ? [
      { key: "monitoramento", label: t.monitoring },
      { key: "notas", label: t.myNotes },
    ] : []),
  ];
  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.phoneProductRow}>
        <LogoLockup size={18} tone="default" />
      </div>
      <div style={mobStyles.header}>
        <span style={mobStyles.greeting}>{t.hello}, {me.name}</span>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <div style={mobStyles.menuList}>
        {items.map((item) => (
          <button key={item.key} style={mobStyles.menuButton} onClick={() => onNavigate(item.key)}>
            {item.label}
            {!!item.badge && <span style={mobStyles.menuBadge}>{item.badge}</span>}
          </button>
        ))}
      </div>
      <InstallAppButton lang={lang} />
      <div style={mobStyles.sairRow}>
        <button style={mobStyles.sairLink} onClick={onLogout}>{T[lang].common.logout}</button>
      </div>
    </div>
  );
}

export default EmployeeMenuScreen;