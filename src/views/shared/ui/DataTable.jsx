// Tabela de dados / DataTable (documento de design, 2.8).
//
// Introduzido na Etapa 2 (componentes); já ligado a todos os ecrãs de
// listagem redesenhados na Etapa 4 — comentário antigo (dizia "ainda não
// ligado a nenhum ecrã") corrigido aqui, varredura de QA pós-Etapa 4, sem
// mudança de comportamento.
//
// `columns`: [{ key, label, numeric, sortable, width, render(row) }]
//   - `render` é opcional; sem ele mostra `row[key]`.
//   - `numeric` alinha à direita e usa algarismos tabulares.
// `getRowId(row)` por defeito lê `row.id`.
// A caixa de seleção SÓ aparece quando `batchActions` é passado (o
// documento é explícito: "sem ação em lote, sem caixas de seleção").
// Simplificação conhecida: a "primeira coluna pegajosa" só é aplicada
// quando NÃO há seleção (senão a caixa de seleção ficaria por baixo da
// coluna pegajosa) — ajustar isto com dados reais é trabalho de Etapa 4,
// quando dermos para ver o comportamento de scroll horizontal de verdade.
import { useState } from "react";
import { ChevronUp, ChevronDown, Inbox } from "lucide-react";
import { COLORS } from "../../../styles/colors.js";
import { RADIUS, SHADOW } from "../../../styles/tokens.js";

function SkeletonRows({ columns, count, rowHeight }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} style={{ display: "flex", alignItems: "center", height: rowHeight, borderBottom: `1px solid ${COLORS.lineSoft}`, padding: "0 16px", gap: 16 }}>
      {columns.map((col) => (
        <div key={col.key} style={{ flex: col.width || 1, height: 12, borderRadius: 6, background: COLORS.lineSoft, opacity: 0.8 }} />
      ))}
    </div>
  ));
}

function DataTable({
  columns, rows, getRowId = (r) => r.id, onRowClick,
  dense, sortKey, sortDir = "asc", onSortChange,
  batchActions, batchLabel = (n) => `${n} selecionados`,
  selectedIds, onToggleSelect, onToggleSelectAll,
  emptyIcon: EmptyIcon = Inbox, emptyMessage = "Nada por aqui.", emptyAction,
  loading, skeletonRows = 5,
}) {
  const [hoverId, setHoverId] = useState(null);
  const rowHeight = dense ? 48 : 56;
  const selectable = !!batchActions;
  const selectedCount = selectedIds ? selectedIds.size : 0;

  return (
    <div style={{ position: "relative", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden", background: COLORS.card }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "100%", width: "max-content" }}>
          {/* Cabeçalho — pegajoso no topo. */}
          <div
            style={{
              display: "flex", alignItems: "center", height: 44, background: COLORS.headerTint,
              position: "sticky", top: 0, zIndex: 2, padding: "0 16px", gap: 16,
              borderBottom: `1px solid ${COLORS.line}`,
            }}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={rows.length > 0 && selectedCount === rows.length}
                onChange={onToggleSelectAll}
                style={{ flexShrink: 0 }}
              />
            )}
            {columns.map((col, i) => (
              <button
                key={col.key}
                type="button"
                onClick={col.sortable ? () => onSortChange?.(col.key) : undefined}
                style={{
                  flex: col.width || 1, minWidth: col.minWidth, display: "flex", alignItems: "center",
                  justifyContent: col.numeric ? "flex-end" : "flex-start", gap: 4,
                  fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: COLORS.ink2, background: "transparent", border: "none",
                  cursor: col.sortable ? "pointer" : "default", padding: 0, fontFamily: "inherit",
                  position: i === 0 && !selectable ? "sticky" : "static", left: i === 0 ? 0 : undefined,
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                )}
              </button>
            ))}
          </div>

          {/* Corpo */}
          {loading ? (
            <SkeletonRows columns={columns} count={skeletonRows} rowHeight={rowHeight} />
          ) : rows.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS.forest100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EmptyIcon size={26} strokeWidth={1.6} color={COLORS.forest600} />
              </div>
              <div style={{ fontSize: 13.5, color: COLORS.ink2 }}>{emptyMessage}</div>
              {emptyAction}
            </div>
          ) : (
            rows.map((row) => {
              const id = getRowId(row);
              const selected = selectedIds?.has(id);
              const hovered = hoverId === id;
              return (
                <div
                  key={id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => { if (onRowClick && (e.key === "Enter" || e.key === " ")) onRowClick(row); }}
                  onMouseEnter={() => setHoverId(id)}
                  onMouseLeave={() => setHoverId((h) => (h === id ? null : h))}
                  style={{
                    display: "flex", alignItems: "center", height: rowHeight, padding: "0 16px", gap: 16,
                    borderBottom: `1px solid ${COLORS.lineSoft}`,
                    background: selected ? COLORS.forest50 : hovered ? COLORS.forest50 : COLORS.card,
                    borderLeft: selected ? `3px solid ${COLORS.forest600}` : "3px solid transparent",
                    cursor: onRowClick ? "pointer" : "default", boxSizing: "border-box",
                  }}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect?.(id)}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  {columns.map((col, i) => (
                    <div
                      key={col.key}
                      style={{
                        flex: col.width || 1, minWidth: col.minWidth,
                        textAlign: col.numeric ? "right" : "left",
                        fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
                        fontSize: 13.5, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        position: i === 0 && !selectable ? "sticky" : "static", left: i === 0 ? 0 : undefined,
                        background: i === 0 && !selectable ? "inherit" : undefined,
                      }}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Barra flutuante de ação em lote. */}
      {selectable && selectedCount > 0 && (
        <div
          style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 14, background: COLORS.forest900, color: "#fff",
            padding: "10px 18px", borderRadius: RADIUS.pill, boxShadow: SHADOW.sh2, fontSize: 13, zIndex: 40,
          }}
        >
          <span>{batchLabel(selectedCount)}</span>
          {batchActions}
        </div>
      )}
    </div>
  );
}

export { DataTable };
