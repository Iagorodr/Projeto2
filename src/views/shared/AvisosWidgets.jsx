import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { clientById, staffById } from "../../models/utils.js";
import { T } from "../../models/i18n.js";

function SectionHeader({ icon: Icon, title, count, open, onToggle }) {
  return (
    <button style={styles.avSection} onClick={onToggle}>
      <span style={styles.avSectionTitle}>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", marginRight: 8 }} />
        <Icon size={15} style={{ marginRight: 8 }} />
        {title}
      </span>
      <span style={styles.avSectionCount}>{count}</span>
    </button>
  );
}

function SupervisorTag({ lang }) {
  const c0 = T[lang].common;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: COLORS.primaryTint, color: COLORS.primaryDark, fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: "2px 8px", marginLeft: 8 }}>
      {c0.sentBySupervisor}
    </span>
  );
}

function ItemListSimple({ items, staff, clients, lang }) {
  const t = T[lang].avisos;
  if (items.length === 0) return <div style={styles.avItemsList}><div style={styles.avNoItems}>{t.nothingHere}</div></div>;
  return (
    <div style={styles.avItemsList}>
      {items.map((it) => {
        const s = staffById(staff, it.staffId), c = clientById(clients, it.clientId);
        const fromSupervisor = it.sentBy === "supervisor";
        return (
          <div key={it.id} style={{ ...styles.avItemCard, ...(fromSupervisor ? { borderLeft: `3px solid ${COLORS.primary}` } : {}) }}>
            <div style={styles.avItemTopRow}>
              <div>
                <div style={styles.avItemTitle}>
                  {s ? s.name : "—"} · {c ? c.name : "—"}
                  {fromSupervisor && <SupervisorTag lang={lang} />}
                </div>
                <div style={styles.avItemDate}>{it.date}{it.hasPhoto && ` · ${t.withPhoto}`}</div>
              </div>
            </div>
            <div style={styles.avItemText}>{it.text}</div>
          </div>
        );
      })}
    </div>
  );
}

export { SectionHeader, ItemListSimple, SupervisorTag };
