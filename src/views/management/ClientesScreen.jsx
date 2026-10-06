import { useState } from "react";
import { Plus, Pencil, MapPin, Phone, Calendar, Euro, ChevronDown, Users, Megaphone } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW } from "../../styles/tokens.js";
import { TYPE_ICONS, AGENDA_DAYS, TODAY, LANG_NAMES, EMPTY_CLIENT } from "../../models/data.js";
import {
  startOfISOWeek, addDays, isoDateStr, clientAppliesThisWeek, weekLabelPT,
  parseDMY, fmtHoursScreen, fmtMinutes, getOpenPeriod, clientTotalHours, clientTeamStaffIds, agendaHoursSuggestion, staffById, activeClientsCount,
} from "../../models/utils.js";
import { T, DAY_LABELS_1_7_BY_LANG } from "../../models/i18n.js";
import { Field, ViewField } from "../shared/Layout.jsx";
import {
  PageHeader, SearchField, FilterChip, DataTable, Avatar, Pill, Drawer, Button, ConfirmDialog, ProgressBar, Card,
} from "../shared/ui/index.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

// Documento gera "41 clientes ativos" (4.2) a partir dos 41 clientes do seed
// em data.js. QA pós-auditoria (Lote 3, item 4 do briefing — "'Ativo' com
// uma definição só"): esta conta usa `activeClientsCount` (utils.js),
// partilhada com o KPI "Clientes" do Dashboard, pra nunca divergirem.
// Reconfirmado pelo Iago em 04/10: "ativo" = todo cliente cadastrado (41),
// contrato vencido ou não — vira pendência à parte, não some da contagem.
const EMPTY_CLIENT_FORM = { ...EMPTY_CLIENT, documents: [null, null, null, null] };

function splitClientName(name) {
  const idx = (name || "").indexOf(" - ");
  if (idx === -1) return [name, null];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

function contractStatus(client, contractAlertDays) {
  if (!client.contractEnd) return null;
  const end = parseDMY(client.contractEnd);
  const diffDays = Math.ceil((end - TODAY) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { kind: "expired", diffDays: Math.abs(diffDays) };
  if (diffDays <= contractAlertDays) return { kind: "ending", diffDays };
  return { kind: "ok", diffDays };
}

function SectionTitle({ children, first }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink2, textTransform: "uppercase", letterSpacing: "0.06em", margin: first ? "0 0 10px" : "22px 0 10px" }}>
      {children}
    </div>
  );
}

// Pilha de avatares da equipa (documento, 4.2: coluna "Equipa") — até 3
// avatares sobrepostos + "+n" quando há mais. `ids` vem de
// `clientTeamStaffIds` (utils.js): staff distintos em QUALQUER célula da
// semana-tipo de Agendas para este cliente, sem distinguir dia.
function TeamAvatars({ ids, staff, moreLabel }) {
  if (ids.length === 0) return <span style={{ fontSize: 12, color: COLORS.ink3 }}>—</span>;
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((id, i) => {
        const s = staffById(staff, id);
        return (
          <div key={id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: `2px solid ${COLORS.card}` }}>
            <Avatar name={s ? s.name : "?"} size={28} />
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{ marginLeft: -8, width: 28, height: 28, borderRadius: "50%", background: COLORS.lineSoft, color: COLORS.ink2, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.card}` }}>
          {moreLabel(extra)}
        </div>
      )}
    </div>
  );
}

// Clientes (documento de design, secção 4.2) — gerência. `staff`,
// `assignments`, `horasData`, `cutoffDay`, `closedPeriods` e
// `contractAlertDays` são novos nesta leva (Etapa 4f): o ecrã antigo não
// precisava deles porque não tinha colunas de Equipa/Horas no
// período/Contrato a acabar. `onNavigate` é opcional — quando presente,
// liga o "Ver na agenda" da gaveta à tela de Agendas (mesmo padrão já usado
// pela Dashboard, DashboardScreen.jsx).
function ClientesScreen({
  lang, setLang, clients, setClients, onDeleteClient,
  staff = [], assignments = {}, horasData = {}, cutoffDay = 25, closedPeriods = [], contractAlertDays = 30,
  onNavigate,
}) {
  const t = T[lang].clientes;
  const c0 = T[lang].common;
  const dayLabels = DAY_LABELS_1_7_BY_LANG[lang];
  const CLIENT_TYPES = { store: t.typeStore, office: t.typeOffice, house: t.typeHouse, factory: t.typeFactory };
  const FREQS = { weekly: t.freqWeekly, biweekly: t.freqBiweekly, monthly: t.freqMonthly };
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [contractFilterOn, setContractFilterOn] = useState(false);
  // QA (achado do Iago): só existia filtro pra "contrato a acabar"
  // (`st.kind === "ending"`) — faltava o espelho pra quem já venceu
  // (`st.kind === "expired"`), que a própria `contractStatus` já
  // distingue (ver função acima) mas não tinha chip nenhum pra filtrar.
  const [expiredFilterOn, setExpiredFilterOn] = useState(false);

  const [openClientId, setOpenClientId] = useState(null); // id | "new" | null
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [draft, setDraft] = useState(EMPTY_CLIENT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const period = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const activeCount = activeClientsCount(clients, TODAY);
  const cities = Array.from(new Set(clients.map((c) => c.city).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const filtered = clients.filter((c) => {
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (cityFilter && c.city !== cityFilter) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    if (contractFilterOn) {
      const st = contractStatus(c, contractAlertDays);
      if (!st || st.kind !== "ending") return false;
    }
    if (expiredFilterOn) {
      const st = contractStatus(c, contractAlertDays);
      if (!st || st.kind !== "expired") return false;
    }
    return true;
  });

  const openClient = openClientId && openClientId !== "new" ? clients.find((c) => c.id === openClientId) : null;
  const isNew = openClientId === "new";
  const drawerOpen = openClientId !== null;

  function openView(c) { setOpenClientId(c.id); setMode("view"); }
  function openNew() { setDraft(EMPTY_CLIENT_FORM); setFormErrors({}); setOpenClientId("new"); setMode("edit"); }
  function startEdit() { setDraft({ ...openClient, documents: openClient.documents || [null, null, null, null] }); setFormErrors({}); setMode("edit"); }
  function cancelEdit() { if (isNew) { setOpenClientId(null); } else { setMode("view"); } }
  function closeDrawer() { setOpenClientId(null); }
  function updateDraft(field, value) { setDraft((d) => ({ ...d, [field]: value })); }

  function validateDraft() {
    const errs = {};
    if (!draft.name.trim()) errs.name = true;
    if (!draft.address.trim()) errs.address = true;
    if (!draft.contact.trim()) errs.contact = true;
    if (!String(draft.valueHour).trim()) errs.valueHour = true;
    if (!draft.contractStart.trim()) errs.contractStart = true;
    return errs;
  }
  function saveDraft() {
    const errs = validateDraft();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (isNew) {
      const created = { ...draft, id: Date.now(), days: draft.days.length ? draft.days : [1] };
      setClients((prev) => [...prev, created]);
      setOpenClientId(created.id);
      setMode("view");
    } else {
      const updated = { ...draft, id: openClient.id };
      setClients((prev) => prev.map((c) => (c.id === openClient.id ? updated : c)));
      setMode("view");
    }
  }
  function confirmDelete() {
    onDeleteClient(openClient.id);
    setDeleteConfirmOpen(false);
    closeDrawer();
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }
  function confirmBulkDelete() {
    selectedIds.forEach((id) => onDeleteClient(id));
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
  }

  // Só é chamada a partir da secção "Documentos" do modo "view" (a aba de
  // edição não tem upload de documentos) — por isso só mexe em `clients`;
  // `openClient` já é lido direto de `clients` a cada render, então o
  // anexo aparece de imediato sem precisar de tocar em `draft` também.
  function attachDocument(clientId, slotIndex, fileName) {
    setClients((prev) => prev.map((c) => {
      if (c.id !== clientId) return c;
      const docs = [...(c.documents || [null, null, null, null])];
      docs[slotIndex] = fileName;
      return { ...c, documents: docs };
    }));
  }

  const columns = [
    {
      key: "client", label: t.colClient, width: 2,
      render: (c) => {
        const [line1, line2] = splitClientName(c.name);
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line1}</div>
            {line2 && <div style={{ fontSize: 11.5, color: COLORS.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line2}</div>}
          </div>
        );
      },
    },
    { key: "city", label: t.colCity, render: (c) => c.city || "—" },
    { key: "contact", label: t.colContact, render: (c) => c.contact || "—" },
    {
      key: "team", label: t.colTeam, width: 1.3,
      render: (c) => <TeamAvatars ids={clientTeamStaffIds(assignments, c.id)} staff={staff} moreLabel={t.teamMore} />,
    },
    {
      // QA (achado do Iago): o texto do rótulo ("0h de 32h30") estava
      // sendo cortado sem reticências — a célula só tinha `width: 1.6`
      // (proporção de flex), sem nenhum `minWidth` próprio, então em
      // janelas mais estreitas ela encolhia abaixo do que o rótulo
      // precisa e o conteúdo simplesmente estourava escondido pelo
      // `overflow: hidden` da célula (herdado de DataTable.jsx). O
      // `minWidth: 150` que já existia era só no `style` do ProgressBar
      // (um filho), não na coluna em si — não segurava a célula.
      key: "hours", label: t.colHoursPeriod, width: 1.6, minWidth: 190,
      render: (c) => {
        if (!c.hoursMonth) return <span style={{ fontSize: 12, color: COLORS.ink3 }}>—</span>;
        const logged = clientTotalHours(horasData, c.id, period);
        return (
          <ProgressBar
            value={logged} max={c.hoursMonth}
            label={t.hoursOfLabel(fmtHoursScreen(logged), fmtHoursScreen(c.hoursMonth))}
            style={{ minWidth: 150 }}
          />
        );
      },
    },
    {
      key: "contract", label: t.colContract, width: 1.3,
      render: (c) => {
        const st = contractStatus(c, contractAlertDays);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, color: COLORS.ink2 }}>{c.contractEnd || "—"}</span>
            {st && st.kind === "expired" && <Pill variant="missing">{t.contractExpired}</Pill>}
            {st && st.kind === "ending" && <Pill variant="pending">{t.contractEndsIn(st.diffDays)}</Pill>}
          </div>
        );
      },
    },
  ];

  const anyFilterActive = !!(search.trim() || cityFilter || typeFilter || contractFilterOn || expiredFilterOn);

  const drawerClient = isNew ? draft : openClient;
  const drawerStatus = drawerClient && mode === "view" ? contractStatus(drawerClient, contractAlertDays) : null;
  const TypeIcon = drawerClient ? (TYPE_ICONS[drawerClient.type] || Users) : Users;
  const [drawerLine1, drawerLine2] = drawerClient ? splitClientName(drawerClient.name) : ["", null];

  const suggestion = mode === "edit" ? agendaHoursSuggestion(draft) : 0;
  const suggestionLabel = fmtHoursScreen(suggestion);
  const durationLabel = fmtMinutes(Number(draft.duration) || 0);
  const daysCount = (draft.days || []).length;
  const typedHours = parseFloat(String(draft.hoursMonth).replace(",", ".")) || 0;
  const suggestionDiffsALot = suggestion > 0 && Math.abs(typedHours - suggestion) / suggestion > 0.15;

  return (
    <div style={styles.content}>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(activeCount)}
        lang={lang} setLang={setLang} langNames={LANG_NAMES}
        actions={<Button icon={Plus} onClick={openNew}>{t.newClient}</Button>}
      />

      <div style={{ marginBottom: 14, maxWidth: 420 }}>
        <SearchField value={search} onChange={setSearch} placeholder={t.searchPlaceholder} clearLabel={c0.close} mobile={isMobile} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <FilterChip active={!cityFilter} onClick={() => setCityFilter(null)}>{t.allCities}</FilterChip>
        {cities.map((city) => (
          <FilterChip key={city} active={cityFilter === city} onClick={() => setCityFilter((cur) => (cur === city ? null : city))}>
            {city}
          </FilterChip>
        ))}
        <FilterChip active={contractFilterOn} onClick={() => setContractFilterOn((v) => !v)}>
          {t.contractAlertChip}
        </FilterChip>
        <FilterChip active={expiredFilterOn} onClick={() => setExpiredFilterOn((v) => !v)}>
          {t.contractExpired}
        </FilterChip>
        <div style={{ position: "relative" }}>
          <FilterChip active={!!typeFilter} onClick={() => setTypeMenuOpen((o) => !o)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {typeFilter ? CLIENT_TYPES[typeFilter] : t.typeFilterLabel}
              <ChevronDown size={13} />
            </span>
          </FilterChip>
          {typeMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 19 }} onClick={() => setTypeMenuOpen(false)} />
              <div style={{ position: "absolute", top: 42, left: 0, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.control, boxShadow: SHADOW.sh2, zIndex: 20, minWidth: 170, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => { setTypeFilter(null); setTypeMenuOpen(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "transparent", fontSize: 13, fontWeight: !typeFilter ? 700 : 400, color: COLORS.ink, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {t.typeFilterAll}
                </button>
                {Object.keys(CLIENT_TYPES).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setTypeFilter(k); setTypeMenuOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "transparent", fontSize: 13, fontWeight: typeFilter === k ? 700 : 400, color: COLORS.ink, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {CLIENT_TYPES[k]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={openView}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        batchActions={<Button variant="dangerSolid" onClick={() => setBulkDeleteConfirmOpen(true)}>{t.deleteSelected}</Button>}
        batchLabel={(n) => t.selectedCount(n)}
        emptyMessage={anyFilterActive ? t.noResults : t.emptyNoClients}
        emptyIcon={Users}
      />

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        closeLabel={c0.close}
        icon={mode === "view" ? TypeIcon : undefined}
        title={
          mode === "view" ? (
            <div style={{ display: "flex", flexDirection: "column", whiteSpace: "normal", lineHeight: 1.25 }}>
              <span>{drawerLine1}</span>
              {drawerLine2 && <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.ink2 }}>{drawerLine2}</span>}
            </div>
          ) : (isNew ? t.modalNewTitle : t.modalEditTitle)
        }
        pill={drawerStatus && drawerStatus.kind !== "ok" && (
          <Pill variant={drawerStatus.kind === "expired" ? "missing" : "pending"}>
            {drawerStatus.kind === "expired" ? t.contractExpired : t.contractEndsIn(drawerStatus.diffDays)}
          </Pill>
        )}
        footer={
          mode === "view" && openClient ? (
            <>
              <Button variant="secondary" icon={Pencil} onClick={startEdit}>{c0.edit}</Button>
              <Button variant="dangerSoft" onClick={() => setDeleteConfirmOpen(true)}>{c0.delete}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={cancelEdit}>{c0.cancel}</Button>
              <Button variant="primary" onClick={saveDraft}>{c0.save}</Button>
            </>
          )
        }
      >
        {mode === "view" && openClient && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <Pill variant="neutral">{CLIENT_TYPES[openClient.type]}</Pill>
              <Pill variant="neutral">{openClient.clientType === "replacement" ? t.clientTypeReplacement : t.clientTypeFixed}</Pill>
              {openClient.origin && <Pill variant="neutral">{openClient.origin}</Pill>}
            </div>

            <SectionTitle first>{t.sectionLocation}</SectionTitle>
            <div style={styles.viewGrid}>
              <ViewField icon={MapPin} label={t.fCity}>{openClient.city || "—"}</ViewField>
              <ViewField icon={Phone} label={t.fContact}>
                {openClient.contact ? <a href={`tel:${openClient.contact}`} style={{ color: COLORS.primary, textDecoration: "underline" }}>{openClient.contact}</a> : "—"}
              </ViewField>
              <ViewField icon={MapPin} label={t.fAddress} full>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span>{openClient.address || "—"}</span>
                  {openClient.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(openClient.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, textDecoration: "underline", fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {t.openMap}
                    </a>
                  )}
                </div>
              </ViewField>
            </div>

            <SectionTitle>{t.sectionContract}</SectionTitle>
            <div style={styles.viewGrid}>
              <ViewField icon={Calendar} label={t.fContract}>{openClient.contractStart || "—"} – {openClient.contractEnd || "—"}</ViewField>
              <ViewField icon={Calendar} label={t.fRemaining}>
                {(() => {
                  const st = contractStatus(openClient, contractAlertDays);
                  if (!st) return "—";
                  return st.kind === "expired" ? t.contractEndedDaysAgo(st.diffDays) : t.contractRemainingDays(st.diffDays);
                })()}
              </ViewField>
              <ViewField icon={Euro} label={t.fValueHour}>{openClient.valueHour ? `€ ${openClient.valueHour}` : "—"}</ViewField>
              <ViewField label={t.fHoursMonth}>{openClient.hoursMonth ? fmtHoursScreen(openClient.hoursMonth) : "—"}</ViewField>
              {openClient.clientType === "replacement" && (
                <ViewField icon={Calendar} label={t.fValidUntil}>{openClient.clientValidUntil || "—"}</ViewField>
              )}
            </div>

            <SectionTitle>{t.sectionService}</SectionTitle>
            <div style={styles.viewGrid}>
              <ViewField label={t.fFrequency}>{FREQS[openClient.frequency] || "—"}</ViewField>
              {(openClient.frequency === "biweekly" || openClient.frequency === "monthly") && (() => {
                const next = [0, 1, 2, 3].map((i) => addDays(startOfISOWeek(TODAY), 7 * i)).find((ws) => clientAppliesThisWeek(openClient, ws));
                return next ? <ViewField label={t.fNextVisitWeek}>{weekLabelPT(next, lang)}</ViewField> : null;
              })()}
              <ViewField label={t.fHoursPerDay}>{openClient.duration ? fmtMinutes(openClient.duration) : "—"}</ViewField>
              <ViewField label={t.fDaysPerWeek} full>
                {openClient.days && openClient.days.length > 0
                  ? `${openClient.days.map((d) => dayLabels[d]).join(" ")} (${openClient.days.length})`
                  : "—"}
              </ViewField>
              <ViewField label={t.fAvailability} full>{openClient.availability || "—"}</ViewField>
            </div>

            <SectionTitle>{t.sectionTeam}</SectionTitle>
            {(() => {
              const teamIds = clientTeamStaffIds(assignments, openClient.id);
              if (teamIds.length === 0) return <div style={{ fontSize: 13, color: COLORS.ink3 }}>{t.noTeamAssigned}</div>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 6 }}>
                  {teamIds.map((id) => {
                    const s = staffById(staff, id);
                    if (!s) return null;
                    return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={s.name} size={28} />
                        <span style={{ fontSize: 13.5, color: COLORS.ink }}>{s.name}</span>
                      </div>
                    );
                  })}
                  {onNavigate && (
                    <Button variant="ghost" onClick={() => onNavigate("agendas")}>{t.viewAgenda}</Button>
                  )}
                </div>
              );
            })()}

            <SectionTitle>{t.sectionNotes}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ViewField label={t.fDescription}>{openClient.description || "—"}</ViewField>
              {openClient.priorities && (
                <Card variant="warm" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <Megaphone size={15} color={COLORS.clayInk} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.clayInk, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{t.fPriorities}</div>
                      <div style={{ fontSize: 13, color: COLORS.ink }}>{openClient.priorities}</div>
                    </div>
                  </div>
                </Card>
              )}
              <ViewField label={t.fNote}>{openClient.note || "—"}</ViewField>
            </div>

            {/* Upload de documentos — funcionalidade já existente no ecrã
                antigo, fora do que o documento de design 4.2/5.4 descreve.
                Mantida por não haver pedido pra removê-la (ver LEIA-ME). */}
            <SectionTitle>{t.documentsTitle}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {t.docSlots.map((label, idx) => {
                const fileName = (openClient.documents || [])[idx];
                const inputId = `doc-client-${openClient.id}-${idx}`;
                return (
                  <div key={idx} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink2, marginBottom: 6 }}>{label}</div>
                    {fileName ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: COLORS.primaryDark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.attached(fileName)}</span>
                        <button
                          type="button"
                          aria-label={t.removeDoc}
                          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: COLORS.extraTint, color: COLORS.extra, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}
                          onClick={() => attachDocument(openClient.id, idx, null)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <input type="file" id={inputId} style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) attachDocument(openClient.id, idx, e.target.files[0].name); }} />
                        <label htmlFor={inputId} style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 8, border: `1px dashed ${COLORS.line}`, fontSize: 12, fontWeight: 600, color: COLORS.ink2, cursor: "pointer" }}>
                          {t.attach}
                        </label>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 8 }}>{t.docsNote}</div>
          </>
        )}

        {mode === "edit" && (
          <div style={isMobile ? { ...styles.formGrid, gridTemplateColumns: "1fr" } : styles.formGrid}>
            <Field label={t.formName} full required error={formErrors.name ? c0.requiredField : undefined}>
              <input style={styles.input} value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} />
            </Field>
            <Field label={t.formType}>
              <select style={styles.input} value={draft.type} onChange={(e) => updateDraft("type", e.target.value)}>
                {Object.keys(CLIENT_TYPES).map((k) => <option key={k} value={k}>{CLIENT_TYPES[k]}</option>)}
              </select>
            </Field>
            <Field label={t.formCity}><input style={styles.input} value={draft.city} onChange={(e) => updateDraft("city", e.target.value)} /></Field>
            <Field label={t.formAddress} full required error={formErrors.address ? c0.requiredField : undefined}>
              <input style={styles.input} value={draft.address} onChange={(e) => updateDraft("address", e.target.value)} />
            </Field>
            <Field label={t.formContact} required error={formErrors.contact ? c0.requiredField : undefined}>
              <input style={styles.input} value={draft.contact} onChange={(e) => updateDraft("contact", e.target.value)} />
            </Field>
            <Field label={t.formFrequency}>
              <select style={styles.input} value={draft.frequency} onChange={(e) => updateDraft("frequency", e.target.value)}>
                {Object.keys(FREQS).map((k) => <option key={k} value={k}>{FREQS[k]}</option>)}
              </select>
            </Field>
            {(draft.frequency === "biweekly" || draft.frequency === "monthly") && (
              <Field label={t.formVisitWeek}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Array.from({ length: draft.frequency === "monthly" ? 4 : 2 }, (_, i) => {
                    const ws = addDays(startOfISOWeek(TODAY), 7 * i);
                    const selected = clientAppliesThisWeek(draft, ws);
                    const prefix = i === 0 ? `${t.weekThis} · ` : i === 1 ? `${t.weekNext} · ` : "";
                    return (
                      <button
                        key={i} type="button" onClick={() => updateDraft("frequencyAnchor", isoDateStr(ws))}
                        style={{
                          padding: "10px 14px", borderRadius: RADIUS.control, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
                          border: `1.5px solid ${selected ? COLORS.primaryDark : COLORS.line}`,
                          background: selected ? COLORS.primaryDark : COLORS.card, color: selected ? "#fff" : COLORS.ink,
                        }}
                      >
                        {prefix}{weekLabelPT(ws, lang)}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.ink3, marginTop: 4 }}>{t.visitWeekHint}</div>
              </Field>
            )}
            <Field label={t.formContractStart} required error={formErrors.contractStart ? c0.requiredField : undefined}>
              <input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractStart} onChange={(e) => updateDraft("contractStart", e.target.value)} />
            </Field>
            <Field label={t.formContractEnd}>
              <input style={styles.input} placeholder="dd/mm/aaaa" value={draft.contractEnd} onChange={(e) => updateDraft("contractEnd", e.target.value)} />
            </Field>
            <Field label={t.fClientType}>
              <select style={styles.input} value={draft.clientType} onChange={(e) => updateDraft("clientType", e.target.value)}>
                <option value="fixo">{t.clientTypeFixed}</option>
                <option value="replacement">{t.clientTypeReplacement}</option>
              </select>
            </Field>
            {draft.clientType === "replacement" && (
              <Field label={t.fValidUntil}><input type="date" style={styles.input} value={draft.clientValidUntil} onChange={(e) => updateDraft("clientValidUntil", e.target.value)} /></Field>
            )}
            <Field label={t.formOrigin}><input style={styles.input} value={draft.origin} onChange={(e) => updateDraft("origin", e.target.value)} /></Field>
            <Field label={t.formHoursMonth} full>
              <input
                type="number" style={{ ...styles.input, ...(suggestionDiffsALot ? { borderColor: COLORS.amberInk, background: COLORS.amberBg } : {}) }}
                value={draft.hoursMonth} onChange={(e) => updateDraft("hoursMonth", e.target.value)}
              />
              {suggestion > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: suggestionDiffsALot ? COLORS.amberInk : COLORS.ink3 }}>
                    {t.agendaSuggestion(suggestionLabel, durationLabel, daysCount)}
                  </span>
                  <Button variant="ghost" onClick={() => updateDraft("hoursMonth", suggestion.toFixed(1))}>{t.useSuggestion}</Button>
                </div>
              )}
            </Field>
            <Field label={t.formValueHour} required error={formErrors.valueHour ? c0.requiredField : undefined}>
              <input type="number" style={styles.input} value={draft.valueHour} onChange={(e) => updateDraft("valueHour", e.target.value)} />
            </Field>
            <Field label={t.formAvailability}><input style={styles.input} value={draft.availability} onChange={(e) => updateDraft("availability", e.target.value)} /></Field>
            <Field label={t.formDuration}><input type="number" style={styles.input} value={draft.duration} onChange={(e) => updateDraft("duration", e.target.value)} /></Field>
            <Field label={t.formDays} full>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {AGENDA_DAYS.map((d) => {
                  const active = (draft.days || []).includes(d);
                  return (
                    <button
                      key={d} type="button"
                      style={{
                        padding: "7px 12px", borderRadius: 8,
                        border: `1px solid ${active ? COLORS.primary : COLORS.line}`,
                        background: active ? COLORS.primaryTint : COLORS.card,
                        color: active ? COLORS.primaryDark : COLORS.ink2,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                      onClick={() => updateDraft("days", active ? (draft.days || []).filter((x) => x !== d) : [...(draft.days || []), d])}
                    >
                      {dayLabels[d]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t.formDescription} full><textarea style={styles.textarea} rows={2} value={draft.description} onChange={(e) => updateDraft("description", e.target.value)} /></Field>
            <Field label={t.formPriorities} full><textarea style={styles.textarea} rows={2} value={draft.priorities} onChange={(e) => updateDraft("priorities", e.target.value)} /></Field>
            <Field label={t.formNote} full><textarea style={styles.textarea} rows={2} value={draft.note} onChange={(e) => updateDraft("note", e.target.value)} /></Field>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen && !!openClient}
        title={c0.deleteConfirmTitle}
        body={openClient ? t.confirmDeleteBody(openClient.name) : ""}
        cancelLabel={c0.cancel}
        confirmLabel={c0.confirmDelete}
        destructive
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        title={c0.deleteConfirmTitle}
        body={t.confirmDeleteBulkBody(selectedIds.size)}
        cancelLabel={c0.cancel}
        confirmLabel={c0.confirmDelete}
        destructive
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}

export default ClientesScreen;
