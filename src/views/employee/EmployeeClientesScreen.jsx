import { useState } from "react";
import { ChevronDown, Search, Home as HouseIcon, Store, MapPin, Clock, Megaphone } from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { TYPE_ICONS, LANG_NAMES } from "../../models/data.js";
import { fmtMinutes, getAssignedClientIds } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";
import { PageHeader, SearchField, Card } from "../shared/ui/index.js";

// Mesma divisão de nome usada em ClientesScreen.jsx (gerência, Etapa 4f) —
// duplicada aqui de propósito (não há módulo de utilidades "só de ecrã"
// partilhado entre gerência e funcionário; ver o mesmo padrão em
// DAY_LABELS_1_7 vs DAY_LABELS_1_7_BY_LANG). "Cliente 28 - Filial Centro"
// -> ["Cliente 28", "Filial Centro"].
function splitClientName(name) {
  const idx = (name || "").indexOf(" - ");
  if (idx === -1) return [name, null];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

// Corpo dos detalhes (documento, 5.4): Endereço + botão "Abrir no mapa",
// Descrição, Prioridades (cartão clay) e Observação — sem contacto, sem €
// (só a gerência vê isso, 4.2). Partilhado entre o acordeão (telemóvel) e o
// painel de detalhe (PC/tablet).
function ClientDetail({ client, t }) {
  const hasExtra = client.description || client.priorities || client.note;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{t.address}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink, marginBottom: 10 }}>{client.address || "—"}</div>
        {client.address && (
          <button
            type="button"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`, "_blank", "noopener,noreferrer")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 18px",
              borderRadius: RADIUS.control, border: "1.5px solid #9FB8AE", background: COLORS.card,
              color: COLORS.forest700, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <MapPin size={15} strokeWidth={1.8} />
            {t.openMap}
          </button>
        )}
      </div>
      {client.description && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{t.description}</div>
          <div style={{ fontSize: 13.5, color: COLORS.ink }}>{client.description}</div>
        </div>
      )}
      {client.priorities && (
        <Card variant="warm" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Megaphone size={15} color={COLORS.clayInk} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.clayInk, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{t.priorities}</div>
              <div style={{ fontSize: 13, color: COLORS.ink }}>{client.priorities}</div>
            </div>
          </div>
        </Card>
      )}
      {client.note && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{t.note}</div>
          <div style={{ fontSize: 13.5, color: COLORS.ink }}>{client.note}</div>
        </div>
      )}
      {!hasExtra && <div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noDetails}</div>}
    </div>
  );
}

// Selo com ícone de relógio para o horário/janela de atendimento (documento,
// 5.4: "chip com ícone de relógio, ex.: 12h–14h"). `c.availability` também
// pode ser texto livre ("Sempre aberto") — mostramos como está, o ícone já
// dá o contexto de horário sem precisar validar o formato.
function AvailabilityChip({ text }) {
  if (!text) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 22, padding: "0 9px", borderRadius: 999, background: COLORS.steelBg, color: COLORS.steelInk, fontSize: 11.5, fontWeight: 600 }}>
      <Clock size={11} strokeWidth={2} />
      {text}
    </span>
  );
}

// Clientes (documento de design, secção 5.4) — vista só-leitura partilhada
// por funcionário e supervisor (a "regra de ouro" do documento, secção 5:
// os dois papéis usam os MESMOS ecrãs). `desktop` vem de `useBreakpoint()`
// em App.jsx (`empTier !== "mobile"`), mesmo padrão já usado por
// NotasScreen.jsx — PC/tablet ganham lista+detalhe lado a lado (5/7
// colunas, documento), telemóvel mantém o acordeão dentro da moldura de
// telemóvel.
function EmployeeClientesScreen({ lang, setLang, onHome, staffId, clients, assignments, canViewAll, desktop }) {
  const t = T[lang].employeeClientes;
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const myClientIds = getAssignedClientIds(assignments, staffId);
  const myClients = canViewAll ? clients : clients.filter((c) => myClientIds.includes(c.id));
  const filtered = myClients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  function rowSubtitle(c) {
    const [, subLocation] = splitClientName(c.name);
    const parts = [subLocation, fmtMinutes(c.duration), t.timesPerWeek((c.days || []).length)].filter(Boolean);
    return parts.join(" · ");
  }

  if (desktop) {
    const selected = filtered.find((c) => c.id === selectedId) || null;
    return (
      <div style={styles.content}>
        <PageHeader title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
        <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 22, alignItems: "start" }}>
          <div>
            <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} clearLabel={T[lang].common.close} />
            <div style={{ marginTop: 12, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, overflow: "hidden", background: COLORS.card }}>
              {filtered.length === 0 ? (
                <div style={{ ...styles.noResults }}>{t.noResults}</div>
              ) : (
                filtered.map((c) => {
                  const Icon = TYPE_ICONS[c.type] || Store;
                  const [line1] = splitClientName(c.name);
                  const active = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                        padding: "12px 14px", border: "none", borderBottom: `1px solid ${COLORS.lineSoft}`,
                        background: active ? COLORS.forest50 : "transparent", cursor: "pointer", fontFamily: "inherit",
                        borderLeft: active ? `3px solid ${COLORS.forest600}` : "3px solid transparent",
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: COLORS.forest100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={16} color={COLORS.primaryDark} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line1}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowSubtitle(c)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div>
            {!selected ? (
              <div style={{ fontSize: 13.5, color: COLORS.ink3, textAlign: "center", padding: "48px 20px", border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.card }}>
                {t.selectPrompt}
              </div>
            ) : (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {(() => { const Icon = TYPE_ICONS[selected.type] || Store; return (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.forest100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={17} color={COLORS.primaryDark} />
                    </div>
                  ); })()}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{splitClientName(selected.name)[0]}</div>
                    {splitClientName(selected.name)[1] && <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{splitClientName(selected.name)[1]}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 16px" }}>
                  <AvailabilityChip text={selected.availability} />
                </div>
                <ClientDetail client={selected} t={t} />
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={mobStyles.phone}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <div style={mobStyles.searchWrap}>
        <Search size={16} color={COLORS.textSoft} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} style={mobStyles.searchInput} />
      </div>
      {filtered.length === 0 ? (
        <div style={mobStyles.emptyState}>{t.noResults}</div>
      ) : (
        <div style={mobStyles.clientList}>
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;
            const Icon = TYPE_ICONS[c.type] || Store;
            const [line1] = splitClientName(c.name);
            return (
              <div key={c.id} style={mobStyles.clientCard}>
                <button
                  style={{ ...mobStyles.clientHeader, minHeight: 72, borderBottom: isExpanded ? `1px solid ${COLORS.border}` : "none" }}
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div style={mobStyles.clientHeaderLeft}>
                    <div style={mobStyles.iconCircle}><Icon size={18} color={COLORS.primaryDark} /></div>
                    <div style={{ textAlign: "left", minWidth: 0 }}>
                      <div style={mobStyles.clientName}>{line1}</div>
                      <div style={mobStyles.clientSub}>{rowSubtitle(c)}</div>
                      {c.availability && <div style={{ marginTop: 4 }}><AvailabilityChip text={c.availability} /></div>}
                    </div>
                  </div>
                  <ChevronDown size={16} color={COLORS.textSoft} style={{ transform: isExpanded ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                </button>
                {isExpanded && (
                  <div style={mobStyles.clientBody}>
                    <ClientDetail client={c} t={t} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EmployeeClientesScreen;
