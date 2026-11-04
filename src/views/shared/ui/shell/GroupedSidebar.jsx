// Menu lateral da gerência por grupos (redesign B1). Nenhuma página sai nem muda
// de nome: só ficam arrumadas em 4 grupos (Dia a dia · Cadastros · Dinheiro ·
// Sistema).
//   aberto (PC):  nomes dos grupos, contadores com número, "Ver como funcionário"
//                 e a conta no fundo; "Recolher menu" fecha.
//   fechado:      trilho só com ícones; linha fina entre grupos; contador vira
//                 ponto amarelo.
// O estado aberto/fechado fica guardado neste aparelho.
// Nunca corta itens: conforme a altura disponível, primeiro aperta (linhas mais
// baixas, sem títulos de grupo); se ainda não couber, os últimos grupos passam
// para um botão «•••» com popover (Sistema primeiro, depois Dinheiro, …). Como
// último recurso a lista faz scroll — nunca esconde páginas.
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, ChevronsLeft, ChevronsRight, Search, MoreHorizontal } from "lucide-react";
import { COLORS } from "../../../../styles/colors.js";
import { Avatar } from "../Avatar.jsx";
import { LogoBadge } from "../../Logo.jsx";
import { useGlobalSearch } from "../../GlobalSearch.jsx";

const STORE_KEY = "servix.menuCollapsed";
function readCollapsed(def) {
  try { const v = localStorage.getItem(STORE_KEY); return v == null ? def : v === "1"; } catch { return def; }
}

// Alturas (px) usadas para calcular o que cabe. Têm de bater com os estilos abaixo.
const H = { item: 40, itemDense: 32, gap: 2, label: 25, sepOpen: 11, sepClosed: 17, sepDense: 9, extraPad: 17 };

function GroupedSidebar({
  groups, activeKey, onNavigate, user, onLogout, logoutLabel, extraItems = [],
  defaultCollapsed = false, labels,
}) {
  const search = useGlobalSearch();
  const onSearch = search ? search.open : null;
  const [collapsed, setCollapsedRaw] = useState(() => readCollapsed(defaultCollapsed));
  const setCollapsed = (v) => { setCollapsedRaw(v); try { localStorage.setItem(STORE_KEY, v ? "1" : "0"); } catch { /* ignora */ } };
  const width = collapsed ? 76 : 244;

  // ── medir a altura disponível e decidir densidade / grupos no «•••» ──
  const navRef = useRef(null);
  const areaRef = useRef(null);
  const moreWrapRef = useRef(null);
  const [fit, setFit] = useState({ dense: false, overflow: 0 });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = moreWrapRef;

  const required = useCallback((dense, overflow) => {
    const itemH = dense ? H.itemDense : H.item;
    const kept = groups.slice(0, groups.length - overflow);
    let h = 0;
    kept.forEach((g, gi) => {
      if (gi > 0) h += H.gap + (dense ? H.sepDense : collapsed ? H.sepClosed : H.sepOpen);
      if (!collapsed && !dense) h += H.label;
      h += g.items.length * (itemH + H.gap);
    });
    if (extraItems.length) h += H.extraPad + extraItems.length * (itemH + H.gap);
    if (overflow > 0) h += 13 + itemH; // botão «•••» + linha
    return h;
  }, [groups, extraItems.length, collapsed]);

  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const moreH = moreWrapRef.current ? moreWrapRef.current.offsetHeight + 4 : 0;
    const avail = area.clientHeight + moreH;
    const options = [];
    for (let o = 0; o < groups.length; o += 1) { options.push({ dense: false, overflow: o }); options.push({ dense: true, overflow: o }); }
    // Prefere: nada no «•••» e normal; depois apertado; depois ir passando grupos.
    const ordered = [{ dense: false, overflow: 0 }, { dense: true, overflow: 0 }, ...options.filter((x) => x.overflow > 0 && x.dense)];
    const pick = ordered.find((x) => required(x.dense, x.overflow) <= avail) || { dense: true, overflow: Math.max(0, groups.length - 1) };
    setFit((cur) => (cur.dense === pick.dense && cur.overflow === pick.overflow ? cur : pick));
  }, [groups.length, required]);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [measure]);
  useEffect(() => { measure(); }, [collapsed, measure]);

  // fechar popover ao clicar fora
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [moreOpen]);

  const dense = fit.dense;
  const mainGroups = fit.overflow > 0 ? groups.slice(0, groups.length - fit.overflow) : groups;
  const moreGroups = fit.overflow > 0 ? groups.slice(groups.length - fit.overflow) : [];
  const moreHasActive = moreGroups.some((g) => g.items.some((it) => it.key === activeKey));
  const moreBadge = moreGroups.reduce((s, g) => s + g.items.reduce((t, it) => t + (it.badge > 0 ? it.badge : 0), 0), 0);
  const itemH = dense ? H.itemDense : H.item;

  const renderItem = (item, i, opts = {}) => {
    const active = item.key === activeKey;
    const Icon = item.icon;
    const hasBadge = item.badge != null && item.badge > 0;
    const inPopover = opts.inPopover;
    return (
      <button
        key={item.key} type="button"
        onClick={() => { onNavigate(item.key); if (inPopover) setMoreOpen(false); }}
        title={collapsed && !inPopover ? item.label : undefined}
        aria-label={collapsed && !inPopover ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={inPopover ? undefined : "sx-navitem"}
        style={inPopover ? {
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          height: 38, padding: "0 12px", borderRadius: 10, border: "none",
          cursor: "pointer", fontFamily: "inherit",
          background: active ? "var(--p1-12)" : "transparent",
          color: active ? "var(--p2)" : COLORS.ink,
        } : {
          display: "flex", alignItems: "center", gap: 11, position: "relative", width: "100%",
          height: itemH, flexShrink: 0, padding: collapsed ? 0 : "0 10px", justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: dense ? 12 : 15, border: "none", cursor: "pointer", fontFamily: "inherit",
          background: active ? "#fff" : "transparent", color: active ? "var(--p2)" : "#fff",
          animationDelay: `${i * 22}ms`,
        }}
      >
        <span style={{ position: "relative", display: "flex" }}>
          <Icon size={inPopover ? 18 : 20} strokeWidth={active ? 2.3 : 1.9}
            color={inPopover ? (active ? "var(--p1)" : COLORS.ink2) : (active ? "var(--p1)" : "#fff")}
            style={{ opacity: active ? 1 : 0.85 }} />
          {hasBadge && collapsed && !inPopover && (
            <span style={{ position: "absolute", top: -3, right: -4, width: 9, height: 9, borderRadius: 9, background: "#F2C14E", boxShadow: "0 0 0 2px var(--p1)" }} />
          )}
        </span>
        {(!collapsed || inPopover) && (
          <>
            <span style={{ flex: 1, textAlign: "left", fontSize: inPopover ? 13.5 : 14, fontWeight: active ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
            {hasBadge && (
              <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: inPopover ? "var(--p1-12)" : "#F2C14E", color: inPopover ? "var(--p2)" : "#151816", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums" }}>{item.badge}</span>
            )}
          </>
        )}
      </button>
    );
  };

  let n = 0;

  // popover do «•••»: os grupos que não couberam, cada um com o seu título.
  const morePopover = moreOpen && moreGroups.length > 0 && (
    <div
      role="menu"
      style={{
        position: "absolute", bottom: 0, left: "calc(100% + 10px)",
        width: 220, maxHeight: "calc(100dvh - 48px)", overflowY: "auto", background: COLORS.card, borderRadius: 14,
        boxShadow: "0 12px 40px rgba(21,24,22,.22)", padding: 6,
        zIndex: 60, display: "flex", flexDirection: "column", gap: 2, animation: "sx-pop-in .18s var(--ease) both",
      }}
    >
      {moreGroups.map((g, gi) => (
        <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: gi ? `1px solid ${COLORS.lineSoft}` : "none", paddingTop: gi ? 4 : 0, marginTop: gi ? 4 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.ink3, padding: "6px 12px 4px" }}>{g.label}</div>
          {g.items.map((it) => renderItem(it, 0, { inPopover: true }))}
        </div>
      ))}
    </div>
  );

  return (
    <nav
      ref={navRef}
      aria-label="Menu"
      style={{
        width, flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 16, height: "calc(100dvh - 32px)", alignSelf: "flex-start", margin: 16, marginRight: 4,
        padding: collapsed ? "16px 12px" : "16px 14px", boxSizing: "border-box", borderRadius: collapsed ? 38 : 30,
        background: "var(--p1)", color: "#fff", transition: "width .28s var(--ease), padding .28s var(--ease), border-radius .28s var(--ease)",
        boxShadow: "0 18px 40px -24px var(--p1-shadow)",
        overflow: "visible", zIndex: 40,
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

      <div ref={areaRef} className="sx-navscroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", overflowX: "hidden" }}>
        {mainGroups.map((g, gi) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            {gi > 0 && <div style={{ height: 1, flexShrink: 0, background: "rgba(255,255,255,.16)", margin: dense ? "4px 8px" : collapsed ? "8px 8px" : "8px 4px 2px" }} />}
            {!collapsed && !dense && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.6, padding: "6px 10px 4px" }}>{g.label}</div>}
            {g.items.map((it) => renderItem(it, n++))}
          </div>
        ))}
        {extraItems.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.16)", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            {extraItems.map((it) => renderItem(it, n++))}
          </div>
        )}
      </div>

      {/* botão «•••» com os grupos que não couberam */}
      {moreGroups.length > 0 && (
        <div ref={moreWrapRef} style={{ position: "relative", flexShrink: 0, marginTop: 4 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,.16)", margin: collapsed ? "4px 8px" : "4px 4px" }} />
          <button
            type="button" onClick={() => setMoreOpen((v) => !v)}
            title={moreGroups.map((g) => g.label).join(" · ")}
            aria-label={moreGroups.map((g) => g.label).join(" · ")}
            aria-haspopup="menu" aria-expanded={moreOpen}
            style={{
              display: "flex", alignItems: "center", gap: 11, width: "100%", position: "relative",
              height: itemH, padding: collapsed ? 0 : "0 10px", justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: dense ? 12 : 15, border: "none", cursor: "pointer", fontFamily: "inherit",
              background: moreOpen || moreHasActive ? "rgba(255,255,255,.18)" : "transparent",
              color: "#fff",
            }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              <MoreHorizontal size={20} strokeWidth={1.9} style={{ opacity: 0.85 }} />
              {moreBadge > 0 && collapsed && <span style={{ position: "absolute", top: -3, right: -4, width: 9, height: 9, borderRadius: 9, background: "#F2C14E", boxShadow: "0 0 0 2px var(--p1)" }} />}
            </span>
            {!collapsed && <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{moreGroups.map((g) => g.label).join(" · ")}</span>}
            {!collapsed && moreBadge > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#F2C14E", color: "#151816", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{moreBadge}</span>}
          </button>
          {morePopover}
        </div>
      )}

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
