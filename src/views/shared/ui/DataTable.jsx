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
import { useControlSize, useBreakpoint } from "../../../hooks/useBreakpoint.js";

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
  // `fit`: a tabela ocupa só a largura disponível — sem rolagem lateral, sem
  // primeira coluna pegajosa e com os títulos a quebrar linha. Opt-in por ecrã
  // (Monitoramento); as outras tabelas continuam exatamente como estavam.
  fit,
  // `noCards`: força a tabela também no telemóvel (por omissão, <640px vira lista de cartões).
  noCards,
  sortLabel = "Ordenar",
}) {
  const [hoverId, setHoverId] = useState(null);
  const rowHeight = dense ? 48 : 56;
  const selectable = !!batchActions;
  const selectedCount = selectedIds ? selectedIds.size : 0;
  // Lote 4, 4.4 (achado da Marta: "ordenação das tabelas, 15 de altura" e
  // "caixas de seleção, 13×13"): nenhum dos dois tinha uma área de clique
  // real — o botão de ordenação só tinha o tamanho do texto+ícone (~15px)
  // e as caixas de seleção eram o tamanho nativo do navegador. O desenho
  // continua pequeno (documento: "a área clicável pode ser invisível"); o
  // que muda é a área que responde ao toque. `minTap` por `useControlSize`
  // (40 no desktop, 48 em tablet/celular ou ponteiro grosso); o cabeçalho
  // (antes 44 fixo) sobe para caber esse alvo quando ele exceder 44.
  const { minTap } = useControlSize();
  const headerHeight = Math.max(44, minTap);
  const tier = useBreakpoint();
  if (tier === "mobile" && !noCards) {
    return (
      <MobileCards
        columns={columns} rows={rows} getRowId={getRowId} onRowClick={onRowClick}
        sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} sortLabel={sortLabel}
        selectable={selectable} selectedIds={selectedIds} selectedCount={selectedCount}
        onToggleSelect={onToggleSelect} onToggleSelectAll={onToggleSelectAll}
        batchActions={batchActions} batchLabel={batchLabel}
        EmptyIcon={EmptyIcon} emptyMessage={emptyMessage} emptyAction={emptyAction}
        loading={loading} skeletonRows={skeletonRows}
      />
    );
  }

  return (
    <div style={{ position: "relative", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden", background: COLORS.card }}>
      <div style={{ overflowX: "auto" }}>
        <div style={fit ? { width: "100%" } : { minWidth: "100%", width: "max-content" }}>
          {/* Cabeçalho — pegajoso no topo. */}
          <div
            style={{
              display: "flex", alignItems: "center", height: headerHeight, background: COLORS.headerTint,
              position: "sticky", top: 0, zIndex: 2, padding: "0 16px", gap: 16,
              borderBottom: `1px solid ${COLORS.line}`,
            }}
          >
            {selectable && (
              <label
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: minTap, height: minTap, flexShrink: 0, cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedCount === rows.length}
                  onChange={onToggleSelectAll}
                  style={{ cursor: "pointer", accentColor: COLORS.vivo, width: 18, height: 18 }}
                />
              </label>
            )}
            {columns.map((col, i) => (
              <button
                key={col.key}
                type="button"
                onClick={col.sortable ? () => onSortChange?.(col.key) : undefined}
                style={{
                  flex: col.width || 1, minWidth: col.minWidth, display: "flex", alignItems: "center",
                  justifyContent: col.numeric ? "flex-end" : "flex-start", gap: 4, height: "100%",
                  fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: COLORS.ink2, background: "transparent", border: "none",
                  cursor: col.sortable ? "pointer" : "default", padding: 0, fontFamily: "inherit",
                  ...(fit ? { textAlign: "left", lineHeight: 1.2, overflow: "hidden" } : {}),
                  position: i === 0 && !selectable && !fit ? "sticky" : "static", left: i === 0 ? 0 : undefined,
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
                    <label
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: minTap, height: minTap, flexShrink: 0, cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => onToggleSelect?.(id)}
                        style={{ cursor: "pointer", accentColor: COLORS.vivo, width: 18, height: 18 }}
                      />
                    </label>
                  )}
                  {columns.map((col, i) => (
                    <div
                      key={col.key}
                      style={{
                        flex: col.width || 1, minWidth: col.minWidth,
                        textAlign: col.numeric ? "right" : "left",
                        fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
                        fontSize: 13.5, color: COLORS.ink,
                        // Lote 4, 4.6 (achado da Marta): a coluna "Quem" da
                        // Agendas ("Por dia") agora abre um popover a partir
                        // desta célula — `overflow:hidden` cortava-o. Opt-in
                        // por coluna (`allowOverflow`), nunca muda nenhuma
                        // outra coluna/ecrã que já usa esta tabela.
                        overflow: col.allowOverflow ? "visible" : "hidden",
                        textOverflow: col.allowOverflow ? undefined : "ellipsis",
                        whiteSpace: col.allowOverflow ? undefined : "nowrap",
                        position: i === 0 && !selectable && !fit ? "sticky" : "static", left: i === 0 ? 0 : undefined,
                        background: i === 0 && !selectable && !fit ? "inherit" : undefined,
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

// Telemóvel (<640): a mesma informação em cartões — a 1ª coluna é o título do
// cartão, as outras ficam em pares "RÓTULO valor" numa grelha de 2 colunas;
// colunas sem rótulo (ações) ficam numa linha própria no fim. Ordenação passa
// a um seletor; seleção em lote continua (caixa em cada cartão + "todos").
function MobileCards({
  columns, rows, getRowId, onRowClick, sortKey, sortDir, onSortChange, sortLabel,
  selectable, selectedIds, selectedCount, onToggleSelect, onToggleSelectAll, batchActions, batchLabel,
  EmptyIcon, emptyMessage, emptyAction, loading, skeletonRows,
}) {
  const [first, ...rest] = columns.filter((c) => !c.mobileHidden);
  const infoCols = rest.filter((c) => c.label);
  const actionCols = rest.filter((c) => !c.label);
  const sortable = columns.filter((c) => c.sortable);
  const chk = { cursor: "pointer", accentColor: COLORS.vivo, width: 20, height: 20, margin: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(selectable || (sortable.length > 0 && onSortChange)) && rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, color: COLORS.ink2 }}>
          {selectable ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, cursor: "pointer" }}>
              <input type="checkbox" checked={rows.length > 0 && selectedCount === rows.length} onChange={onToggleSelectAll} style={chk} />
              {selectedCount > 0 ? batchLabel(selectedCount) : "Todos"}
            </label>
          ) : <span />}
          {sortable.length > 0 && onSortChange && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {sortLabel}
              <select
                value={sortKey || ""}
                onChange={(e) => onSortChange(e.target.value)}
                style={{ height: 36, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: COLORS.card, fontSize: 13, fontFamily: "inherit", color: COLORS.ink, padding: "0 8px" }}
              >
                {!sortKey && <option value="">—</option>}
                {sortable.map((c) => <option key={c.key} value={c.key}>{typeof c.label === "string" ? c.label : c.key}</option>)}
              </select>
              {sortKey && (
                <button type="button" onClick={() => onSortChange(sortKey)} aria-label={sortDir === "asc" ? "↑" : "↓"}
                  style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: COLORS.card, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {sortDir === "asc" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              )}
            </label>
          )}
        </div>
      )}
      {loading ? (
        Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} style={{ height: 72, borderRadius: RADIUS.card, background: COLORS.lineSoft }} />
        ))
      ) : rows.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 16px", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, background: COLORS.card }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: COLORS.forest100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EmptyIcon size={24} strokeWidth={1.6} color={COLORS.forest600} />
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.ink2, textAlign: "center" }}>{emptyMessage}</div>
          {emptyAction}
        </div>
      ) : (
        rows.map((row) => {
          const id = getRowId(row);
          const selected = selectedIds?.has(id);
          return (
            <div
              key={id} data-testid="dt-card"
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => { if (onRowClick && (e.key === "Enter" || e.key === " ")) onRowClick(row); }}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px",
                border: `1px solid ${selected ? COLORS.forest600 : COLORS.line}`, borderRadius: RADIUS.card,
                background: selected ? COLORS.forest50 : COLORS.card, cursor: onRowClick ? "pointer" : "default",
              }}
            >
              {selectable && (
                <label onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", paddingTop: 2, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect?.(id)} style={chk} />
                </label>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {first && (
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, minWidth: 0, overflow: "hidden" }}>
                    {first.render ? first.render(row) : row[first.key]}
                  </div>
                )}
                {infoCols.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 12px", marginTop: 8 }}>
                    {infoCols.map((col) => (
                      <div key={col.key} style={{ minWidth: 0, gridColumn: col.mobileFull ? "1 / -1" : undefined }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: COLORS.ink3, marginBottom: 1 }}>{col.label}</div>
                        <div style={{ fontSize: 13.5, color: COLORS.ink, fontVariantNumeric: col.numeric ? "tabular-nums" : undefined, overflow: col.allowOverflow ? "visible" : "hidden", textOverflow: "ellipsis" }}>
                          {col.render ? col.render(row) : row[col.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {actionCols.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                    {actionCols.map((col) => <div key={col.key}>{col.render ? col.render(row) : row[col.key]}</div>)}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      {selectable && selectedCount > 0 && (
        <div
          style={{
            position: "fixed", bottom: 116, left: 12, right: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: COLORS.forest900, color: "#fff",
            padding: "10px 14px", borderRadius: RADIUS.card, boxShadow: SHADOW.sh2, fontSize: 13, zIndex: 40,
          }}
        >
          <span>{batchLabel(selectedCount)}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{batchActions}</div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
