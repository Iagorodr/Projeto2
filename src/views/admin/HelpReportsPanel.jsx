// /admin → "Pedidos de ajuda": o que as equipas das empresas enviam pelo botão Ajuda do app
// (supabase/ajuda.sql). Mostra a empresa, quem enviou, a página, o aparelho e a mensagem, e deixa
// marcar como visto ou resolvido. Em breve também chega por e-mail.
import { useMemo, useState } from "react";
import { Mail, Check, Eye, RotateCcw } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT } from "../../styles/tokens.js";
import { Button } from "../shared/ui/index.js";

const KIND = {
  problem: { label: "Problema", bg: COLORS.alertTint, fg: COLORS.alert },
  support: { label: "Apoio", bg: COLORS.mint, fg: COLORS.vivoInk },
  idea: { label: "Ideia", bg: COLORS.clayTint, fg: COLORS.clayInk },
};
const ROLE = { manager: "Gerência", supervisor: "Supervisor", employee: "Funcionário" };
const FILTERS = [
  { key: "open", label: "Por tratar", test: (r) => r.status !== "done" },
  { key: "new", label: "Novos", test: (r) => r.status === "new" },
  { key: "done", label: "Resolvidos", test: (r) => r.status === "done" },
  { key: "all", label: "Todos", test: () => true },
];

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso || ""; }
}

export default function HelpReportsPanel({ reports, error, busy, onSetStatus }) {
  const [filter, setFilter] = useState("open");
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, reports.filter(f.test).length])), [reports]);
  const visible = useMemo(() => reports.filter(FILTERS.find((f) => f.key === filter).test), [reports, filter]);

  return (
    <div>
      {error && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
              style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? COLORS.vivo : COLORS.line}`, background: on ? COLORS.vivo : COLORS.card, color: on ? "#fff" : COLORS.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {f.label} <span style={{ opacity: 0.75 }}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.card, padding: 32, textAlign: "center", color: COLORS.ink3, fontSize: 14 }}>
          {reports.length === 0 ? "Ainda não chegou nenhum pedido de ajuda." : "Nenhum pedido neste filtro."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((r) => {
            const k = KIND[r.kind] || KIND.problem;
            const meta = [r.authorName, r.role && ROLE[r.role], r.screen && `página: ${r.screen}`, r.lang && r.lang.toUpperCase()].filter(Boolean).join(" · ");
            return (
              <article key={r.id} style={{ background: COLORS.card, border: `1px solid ${r.status === "new" ? COLORS.vivoLight : COLORS.line}`, borderRadius: RADIUS.card, padding: 16, opacity: r.status === "done" ? 0.8 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ background: k.bg, color: k.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{k.label}</span>
                  {r.status === "new" && <span style={{ background: COLORS.vivo, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>Novo</span>}
                  {r.status === "seen" && <span style={{ color: COLORS.ink3, fontSize: 12, fontWeight: 600 }}>Visto</span>}
                  {r.status === "done" && <span style={{ color: COLORS.vivoInk, fontSize: 12, fontWeight: 700 }}>Resolvido</span>}
                  <span style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 15 }}>{r.companyName} <span style={{ color: COLORS.ink3, fontWeight: 500, fontSize: 13 }}>({r.companyCode})</span></span>
                  <span style={{ marginLeft: "auto", color: COLORS.ink3, fontSize: 12.5 }}>{fmtDate(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14.5, color: COLORS.ink, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.message}</div>
                <div style={{ fontSize: 12.5, color: COLORS.ink3, marginTop: 8, overflowWrap: "anywhere" }}>
                  {meta}{r.authorEmail ? ` · ${r.authorEmail}` : ""}
                  {r.device ? <div style={{ marginTop: 2 }}>Aparelho: {r.device}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {r.authorEmail && (
                    <a href={`mailto:${r.authorEmail}?subject=${encodeURIComponent("Servix — resposta ao seu pedido de ajuda")}`} style={{ textDecoration: "none" }}>
                      <Button type="button" variant="secondary" icon={Mail}>Responder</Button>
                    </a>
                  )}
                  {r.status === "new" && <Button type="button" variant="secondary" icon={Eye} disabled={busy} onClick={() => onSetStatus(r.id, "seen")}>Marcar como visto</Button>}
                  {r.status !== "done" && <Button type="button" icon={Check} disabled={busy} onClick={() => onSetStatus(r.id, "done")}>Resolvido</Button>}
                  {r.status !== "new" && <Button type="button" variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => onSetStatus(r.id, "new")}>Voltar a novo</Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
