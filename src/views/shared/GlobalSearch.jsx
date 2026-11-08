// Pesquisa geral (redesign B1): lupa no cabeçalho de cada página, atalho Ctrl+K
// (⌘K no Mac). Procura clientes, funcionários e contratantes e salta para a ficha.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Search, Users, UserRound, Building2, X } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { normalizeName } from "../../models/utils.js";

const SearchCtx = createContext(null);
export function useGlobalSearch() { return useContext(SearchCtx); }

const norm = (s) => {
  try { return normalizeName(String(s || "")); } catch { return String(s || "").toLowerCase(); }
};

export function GlobalSearchProvider({ children, enabled, clients = [], staff = [], contractors = [], labels, onPick }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
  const value = useMemo(() => (enabled ? { open: () => setOpen(true), label: labels.search } : null), [enabled, labels.search]);
  return (
    <SearchCtx.Provider value={value}>
      {children}
      {enabled && open && (
        <SearchDialog clients={clients} staff={staff} contractors={contractors} labels={labels}
          onClose={() => setOpen(false)} onPick={(r) => { setOpen(false); onPick(r); }} />
      )}
    </SearchCtx.Provider>
  );
}

// Botão da lupa (para cabeçalhos). Sem pesquisa ativa, não aparece.
export function SearchButton({ size = 40, style }) {
  const ctx = useGlobalSearch();
  if (!ctx) return null;
  return (
    <button
      type="button" onClick={ctx.open} aria-label={ctx.label} title={`${ctx.label} (Ctrl+K)`}
      style={{ width: size, height: size, borderRadius: 12, border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink, flexShrink: 0, ...style }}
    >
      <Search size={18} strokeWidth={2} />
    </button>
  );
}

function SearchDialog({ clients, staff, contractors, labels, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const nq = norm(q).trim();
    if (nq.length < 2) return [];
    const hit = (...fields) => fields.some((f) => norm(f).includes(nq));
    const out = [];
    clients.filter((c) => hit(c.name, c.city, c.address)).slice(0, 8)
      .forEach((c) => out.push({ kind: "client", id: c.id, title: c.name, sub: [c.city, c.address].filter(Boolean).join(" · "), icon: Users, group: labels.searchClients }));
    staff.filter((s) => hit(s.name, s.email, s.contact)).slice(0, 6)
      .forEach((s) => out.push({ kind: "staff", id: s.id, title: s.name, sub: s.email || s.contact || "", icon: UserRound, group: labels.searchStaff }));
    contractors.filter((k) => hit(k.name, k.contactName, k.email)).slice(0, 5)
      .forEach((k) => out.push({ kind: "contractor", id: k.id, title: k.name, sub: k.contactName || k.email || "", icon: Building2, group: labels.searchContractors, color: k.color }));
    return out;
  }, [q, clients, staff, contractors, labels]);

  useEffect(() => { setSel(0); }, [q]);

  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((v) => Math.min(results.length - 1, v + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); onPick(results[sel]); }
  };

  let lastGroup = null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(21,24,22,.42)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "10vh 16px 16px" }}>
      <div role="dialog" aria-modal="true" aria-label={labels.search} onClick={(e) => e.stopPropagation()} className="sx-pop"
        style={{ width: "100%", maxWidth: 560, background: COLORS.card, borderRadius: 20, boxShadow: "0 30px 80px rgba(21,24,22,.35)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderBottom: `1px solid ${COLORS.line}` }}>
          <Search size={20} color={COLORS.ink2} />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder={labels.searchPlaceholder} aria-label={labels.search}
            style={{ flex: 1, height: 56, border: "none", outline: "none", fontSize: 16, fontFamily: "inherit", color: COLORS.ink, background: "transparent", minWidth: 0 }}
          />
          <button type="button" onClick={onClose} aria-label="Esc" style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: COLORS.lineSoft, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ maxHeight: "55vh", overflowY: "auto", padding: 8 }}>
          {norm(q).trim().length < 2 && <div style={{ padding: "18px 12px", fontSize: 13.5, color: COLORS.ink2 }}>{labels.searchHint}</div>}
          {norm(q).trim().length >= 2 && results.length === 0 && <div style={{ padding: "18px 12px", fontSize: 13.5, color: COLORS.ink2 }}>{labels.searchEmpty}</div>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            const Icon = r.icon;
            const on = i === sel;
            return (
              <div key={`${r.kind}-${r.id}`}>
                {head && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.ink3, padding: "10px 10px 4px" }}>{head}</div>}
                <button
                  type="button" onMouseEnter={() => setSel(i)} onClick={() => onPick(r)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: on ? "var(--p1-12)" : "transparent" }}
                >
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: r.color || "var(--p1-12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color={r.color ? "#fff" : "var(--p2)"} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                    {r.sub && <span style={{ display: "block", fontSize: 12.5, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${COLORS.lineSoft}`, fontSize: 11.5, color: COLORS.ink3 }}>{labels.searchKeys}</div>
      </div>
    </div>
  );
}
