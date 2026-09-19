import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { EMP_T } from "../../models/translations.js";
import { LangSwitcher } from "../shared/Layout.jsx";

function EmployeeMenuScreen({ lang, setLang, me, onNavigate, onLogout, onSwitchToManagement, avisosBadge }) {
  const t = EMP_T.pt;
  const items = [
    { key: "horas", label: t.menu.horas },
    { key: "avisos", label: t.menu.avisos, badge: avisosBadge },
    { key: "agenda", label: t.menu.agenda },
    { key: "clientes", label: t.menu.clientes },
    { key: "historico", label: "HISTÓRICO" },
  ];
  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <span style={mobStyles.greeting}>{t.menu.ola}, {me.name}</span>
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
      <div style={mobStyles.sairRow}>
        <button style={mobStyles.sairLink} onClick={onLogout}>{t.menu.sair}</button>
        <button style={mobStyles.switchLink} onClick={onSwitchToManagement}>{t.switchToMgmt}</button>
      </div>
    </div>
  );
}

export default EmployeeMenuScreen;
