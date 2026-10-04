import { StickyNote } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { fmtNoteDate } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { useControlSize } from "../../hooks/useBreakpoint.js";

// Versão mini do bloco de Notas, pensada pra viver ao lado dos cartões de KPI
// no topo do dashboard — mostra só o lembrete mais próximo (o mais urgente),
// com um selo do total, num cartão escuro que chama mais atenção que os
// cartões claros ao lado. Clicar leva direto pra tela de Notas.
function NotesTeaser({ notes, todayIso, lang, onSeeAll }) {
  const t = T[lang].notas;
  const sorted = [...(notes || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = sorted[0];
  const due = next && next.date <= todayIso;
  return (
    <button
      onClick={onSeeAll}
      style={{
        flex: 1.15, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10,
        textAlign: "left", cursor: "pointer", border: "none", borderRadius: 14, padding: "14px 16px",
        color: "#F4F1EC", background: `linear-gradient(155deg, ${COLORS.primaryDark}, #0C2B23)`,
        boxShadow: "0 4px 14px rgba(20,63,53,0.18)", minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><StickyNote size={13} />{t.widgetTitle}</span>
        {sorted.length > 0 && (
          <span style={{ background: COLORS.accent, color: COLORS.primaryDark, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "1px 8px" }}>{sorted.length}</span>
        )}
      </div>
      {next ? (
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
          <span style={{ color: due ? COLORS.accent : "#F4F1EC", fontWeight: 800, marginRight: 6 }}>{fmtNoteDate(next.date)}</span>
          {next.text.length > 44 ? `${next.text.slice(0, 44)}…` : next.text}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, opacity: 0.75 }}>{t.noNotes}</div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent }}>{t.seeAll} →</div>
    </button>
  );
}

function NotesWidget({ notes, todayIso, lang, onSeeAll, limit = 4 }) {
  const t = T[lang].notas;
  const visible = notes.slice(0, limit);
  // Lote 4, 4.4 (achado da Marta, item "Ver todas →" 87×19): `forgotLink`
  // não tinha altura própria (vinha só da linha de texto, ~16-19px). O
  // desenho continua um link de texto simples; a área de toque cresce
  // para o mínimo do dispositivo via `useControlSize`, invisível (sem
  // fundo/contorno), igual ao variante `ghost` do `Button`.
  const { height: seeAllHeight } = useControlSize();
  return (
    <div style={styles.dashPendingCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: visible.length === 0 ? 0 : 8 }}>
        <div style={styles.sectionTitle}>{t.widgetTitle}</div>
        {onSeeAll && (
          <button
            style={{ ...styles.forgotLink, fontSize: 12, height: seeAllHeight, padding: "0 4px", display: "inline-flex", alignItems: "center" }}
            onClick={onSeeAll}
          >
            {t.seeAll}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div style={styles.noResults}>{t.noNotes}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((n) => {
            const due = n.date <= todayIso;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8,
                  background: due ? COLORS.extraTint : COLORS.bg,
                  border: `1px solid ${due ? COLORS.extra : COLORS.border}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: due ? COLORS.extra : COLORS.textSoft, minWidth: 34, flexShrink: 0 }}>
                  {fmtNoteDate(n.date)}
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.text, lineHeight: 1.4 }}>{n.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { NotesWidget, NotesTeaser };
