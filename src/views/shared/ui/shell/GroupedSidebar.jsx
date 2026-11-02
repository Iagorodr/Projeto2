// Menu lateral da gerência por grupos (redesign B1). Nenhuma página sai nem muda
// de nome: só ficam arrumadas em 4 grupos (Dia a dia · Cadastros · Dinheiro ·
// Sistema).
//   aberto (PC):  nomes dos grupos, contadores com número, "Ver como funcionário"
//                 e a conta no fundo; "Recolher menu" fecha.
//   fechado:      trilho só com ícones; linha fina entre grupos; contador vira
//                 ponto amarelo.
// O estado aberto/fechado fica guardado neste aparelho.
import { useState } from "react";
import { LogOut, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { Avatar } from "../Avatar.jsx";
import { LogoBadge } from "../../Logo.jsx";
import { useGlobalSearch } from "../../GlobalSearch.jsx";

const STORE_KEY = "servix.menuCollapsed";
function readCollapsed(def) {
  try { const v = localStorage.getItem(STORE_KEY); return v == null ? def : v === "1"; } catch { return def; }
}

function GroupedSidebar({
  groups, activeKey, onNavigate, user, onLogout, logoutLabel, extraItems = [],
  defaultCollapsed = false, labels,
}) {
  const search = useGlobalSearch();
  const onSearch = search ? search.open : null;
  const [collapsed, setCollapsedRaw] = useState(() => readCollapsed(defaultCollapsed));
  const setCollapsed = (v) => { setCollapsedRaw(v); try { localStorage.setItem(STORE_KEY, v ? "1" : "0"); } catch { /* ignora */ } };
  const width = collapsed ? 76 : 244;

  const renderItem = (item, i) => {
    const active = item.key === activeKey;
    const Icon = item.icon;
    const hasBadge = item.badge != null && item.badge > 0;
    return (
      <button
        key={item.key} type="button" onClick={() => onNavigate(item.key)}
        title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className="sx-navitem"
        style={{
          display: "flex", alignItems: "center", gap: 11, position: "relative", width: "100%",
          height: 40, padding: collapsed ? 0 : "0 10px", justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: 15, border: "none", cursor: "pointer", fontFamily: "inherit",
          background: active ? "#fff" : "transparent", color: active ? "var(--p2)" : "#fff",
          animationDelay: `${i * 22}ms`,
        }}
      >
        <span style={{ position: "relative", display: "flex" }}>
          <Icon size={20} strokeWidth={active ? 2.3 : 1.9} color={active ? "var(--p1)" : "#fff"} style={{ opacity: active ? 1 : 0.85 }} />
          {hasBadge && collapsed && (
            <span style={{ position: "absolute", top: -3, right: -4, width: 9, height: 9, borderRadius: 9, background: "#F2C14E", boxShadow: "0 0 0 2px var(--p1)" }} />
          )}
        </span>
        {!collapsed && (
          <>
            <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: active ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
            {hasBadge && (
              <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#F2C14E", color: "#151816", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{item.badge}</span>
            )}
          </>
        )}
      </button>
    );
  };

  let n = 0;
  return (
    <nav
      aria-label="Menu"
      style={{
        width, flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 16, height: "calc(100dvh - 32px)", alignSelf: "flex-start", margin: 16, marginRight: 4,
        padding: collapsed ? "16px 12px" : "16px 14px", boxSizing: "border-box", borderRadius: collapsed ? 38 : 30,
        background: "var(--p1)", color: "#fff", transition: "width .28s var(--ease), padding .28s var(--ease), border-radius .28s var(--ease)",
        boxShadow: "0 18px 40px -24px var(--p1-shadow)",
        overflow: "hidden",
      }}
    >
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "0 0 12px" : "2px 4px 12px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <LogoBadge size={collapsed ? 44 : 44} tone="light" />
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.subtitle}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: collapsed ? "column" : "row", gap: 6, marginBottom: 10 }}>
        <button
          type="button" onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? labels.expand : labels.collapse} aria-label={collapsed ? labels.expand : labels.collapse}
          style={{ flex: collapsed ? "none" : 1, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "#fff", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 8, padding: collapsed ? 0 : "0 10px", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
        >
          {collapsed ? <ChevronsRight size={17} /> : <><ChevronsLeft size={17} /> {labels.collapse}</>}
        </button>
        {onSearch && (
          <button
            type="button" onClick={onSearch} title={`${labels.search} (Ctrl+K)`} aria-label={labels.search}
            style={{ width: collapsed ? "100%" : 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,.22)", background: "rgba(255,255,255,.08)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Search size={17} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.25) transparent", display: "flex", flexDirection: "column", gap: 2 }}>
        {groups.map((g, gi) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {gi > 0 && <div style={{ height: 1, background: "rgba(255,255,255,.16)", margin: collapsed ? "8px 8px" : "8px 4px 2px" }} />}
            {!collapsed && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.6, padding: "6px 10px 4px" }}>{g.label}</div>}
            {g.items.map((it) => renderItem(it, n++))}
          </div>
        ))}
        {extraItems.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.16)", display: "flex", flexDirection: "column", gap: 2 }}>
            {extraItems.map((it) => renderItem(it, n++))}
          </div>
        )}
      </div>

      <button
        type="button" onClick={onLogout} aria-label={logoutLabel} title={collapsed ? logoutLabel : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, height: 42, marginTop: 8, padding: collapsed ? 0 : "0 10px", justifyContent: collapsed ? "center" : "flex-start", border: "none", borderTop: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "rgba(255,255,255,.85)", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}
      >
        <LogOut size={18} />
        {!collapsed && logoutLabel}
      </button>
    </nav>
  );
}

export { GroupedSidebar };
