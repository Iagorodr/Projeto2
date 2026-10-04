import { useState } from "react";
import { Plus } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { clientById, staffById, isoDateStr, fmtNoteDate, getOpenPeriod, isSolicitationStale } from "../../models/utils.js";
import { T, missingItemSubjectLabel } from "../../models/i18n.js";
import { Field } from "../shared/Layout.jsx";
import {
  PageHeader, Button, Drawer, Pill, SupervisorTag, Avatar, FilterChip, SearchSelect, PhotoDropzone, Card, Toast,
} from "../shared/ui/index.js";
import { TYPE_META, TypeIconBlock } from "../shared/avisosTypeMeta.jsx";

// Um dos 3 "cartões grandes selecionáveis" da gaveta "Novo aviso"
// (documento, 4.7: "tipo em 3 cartões grandes selecionáveis (Reclamação,
// Elogio, Aviso; com o ícone e a cor do tipo)").
function TypeCard({ type, active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px",
        borderRadius: RADIUS.control, cursor: "pointer", fontFamily: "inherit",
        border: active ? `2px solid ${COLORS.forest500}` : `1px solid ${COLORS.line}`,
        background: active ? COLORS.forest50 : COLORS.card,
      }}
    >
      <TypeIconBlock type={type} size={38} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{label}</span>
    </button>
  );
}

// Pedido (missingItems): "Novo" quando ainda não foi tocado, "Pendente"
// quando já tem resposta mas não foi marcado como resolvido, "Resolvido"
// quando marcado — 3 estados derivados dos 2 campos que já existem
// (`resolved`/`response`), sem precisar de nenhum campo novo. O documento
// pede literalmente "pílula de estado (Novo / Pendente / Resolvido)" pros
// itens do Pedidos; antes só havia 2 estados (Pendente/Resolvido).
function pedidoStatus(m) {
  if (m.resolved) return "resolved";
  if (m.response) return "pending";
  return "new";
}

// Cartão de um Pedido — bloco de ícone, avatar+nome, assunto+cliente+data,
// texto, pílula de estado, bloco "A sua resposta" e as 3 ações (Responder /
// Marcar como pendente / Marcar como resolvido), como o documento pede.
function PedidoCard({ m, staff, clients, lang, t, c0, stale, replying, replyDraft, setReplyDraft, onStartReply, onSendReply, onToggleResolved }) {
  const s = staffById(staff, m.staffId);
  const c = m.clientId ? clientById(clients, m.clientId) : null;
  const status = pedidoStatus(m);
  const subject = missingItemSubjectLabel(m, lang);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <TypeIconBlock type="pedido" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Avatar name={s ? s.name : "—"} size={24} />
              <span style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.ink }}>{s ? s.name : "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* QA (achado do Iago — "pedidos de um mês já fechado"): só
                  um aviso visual, nunca resolve/esconde o pedido sozinho —
                  quem decide se ainda precisa de ação continua sendo a
                  gerência (ver `isSolicitationStale`, utils.js). */}
              {stale && <Pill variant="neutral">{t.periodClosedTag}</Pill>}
              <Pill variant={status === "resolved" ? "paid" : status === "pending" ? "pending" : "neutral"}>
                {status === "resolved" ? c0.resolved : status === "pending" ? c0.pending : c0.newLabel}
              </Pill>
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 4 }}>
            {subject}{c ? ` · ${c.name}` : ""} · {fmtNoteDate(m.date)}
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 6 }}>{m.text}</div>

          {m.response && replying !== m.id && (
            <div style={{ marginTop: 10, background: COLORS.lineSoft, borderRadius: RADIUS.chip, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink2, marginBottom: 2 }}>{t.yourReply}</div>
              <div style={{ fontSize: 13, color: COLORS.ink }}>{m.response}</div>
            </div>
          )}

          {replying === m.id ? (
            <div style={{ marginTop: 10 }}>
              <textarea
                style={styles.textarea} rows={2} placeholder={t.replyPlaceholder}
                value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)}
              />
              <Button onClick={() => onSendReply(m.id)} style={{ marginTop: 8 }}>{t.sendReply}</Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => onStartReply(m.id, m.response)}>{t.reply}</Button>
              <Button variant="secondary" onClick={() => onToggleResolved(m.id)}>
                {m.resolved ? t.markPending : m.kind === "correcao" ? t.approveAndReopen : t.markResolved}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Cartão de um item enviado pela gerência (reclamação/elogio/aviso) — sem
// estado de resolução (isto é um registo do que foi enviado, não um pedido
// a tratar), por isso sem pílula de estado, exatamente como o próprio
// documento só pede "pílula de estado" para os itens que de facto têm um
// estado (Pedidos).
function SentItemCard({ item, type, staff, clients, c0 }) {
  const s = staffById(staff, item.staffId);
  const c = clientById(clients, item.clientId);
  const fromSupervisor = item.sentBy === "supervisor";
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <TypeIconBlock type={type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Avatar name={s ? s.name : "—"} size={24} />
            <span style={{ fontWeight: 600, fontSize: 13.5, color: COLORS.ink }}>{s ? s.name : "—"}</span>
            {c && <Pill variant="neutral">{c.name}</Pill>}
            {fromSupervisor && <SupervisorTag kind="origin">{c0.sentBySupervisor}</SupervisorTag>}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 6 }}>
            {fmtNoteDate(item.date)}{item.hasPhoto && ` · 📎`}
          </div>
          <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 4 }}>{item.text}</div>
        </div>
      </div>
    </Card>
  );
}

function EmptyNote({ children }) {
  return <div style={{ fontSize: 13.5, color: COLORS.ink3, textAlign: "center", padding: "32px 16px", border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.card }}>{children}</div>;
}

// Avisos (gerência, documento 4.7) — "tratar pedidos dos funcionários e
// enviar reclamações, elogios e avisos". Muda, pelo documento: formulário
// deixa de ocupar o topo (agora é uma gaveta, "+ Novo aviso"), a caixa de
// entrada passa a ser o primeiro que se vê (abre em Pedidos), e os
// acordeões viram separadores (chips).
function AvisosScreen({ lang, setLang, staff, clients, missingItems, setMissingItems, sentItems, setSentItems, setHorasData, closedPeriods, cutoffDay }) {
  const t = T[lang].avisos;
  const c0 = T[lang].common;
  const [tab, setTab] = useState("pedidos");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftType, setDraftType] = useState("reclamacao");
  const [draftStaffId, setDraftStaffId] = useState("");
  const [draftClientId, setDraftClientId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftPhoto, setDraftPhoto] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [replyingId, setReplyingId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  // QA (achado do Iago — "sair das pendências" pedidos de período já
  // fechado): começa escondido (igual ao que o Iago pediu, "esconder dos
  // antigos da visão padrão"); o botão abaixo revela, nunca apaga nada.
  const [showStale, setShowStale] = useState(false);

  const complaints = sentItems.filter((i) => i.type === "reclamacao");
  const praises = sentItems.filter((i) => i.type === "elogio");
  const notices = sentItems.filter((i) => i.type === "aviso");
  const openPeriod = getOpenPeriod(closedPeriods, cutoffDay, TODAY);
  const staleMissingItems = missingItems.filter((m) => isSolicitationStale(m, openPeriod));
  const visibleMissingItems = showStale ? missingItems : missingItems.filter((m) => !isSolicitationStale(m, openPeriod));
  const pendingSolicitations = visibleMissingItems.filter((m) => !m.resolved).length;

  // Documento, 4.7, literal: "Funcionário (seletor com pesquisa; em
  // 'Aviso' pode ser 'Todos')" — a opção "Todos" só faz sentido pro tipo
  // Aviso (um aviso geral costuma ser pra equipa toda; reclamação/elogio
  // são sempre sobre uma pessoa). Em vez de inventar um valor "broadcast"
  // no modelo de dados (que obrigaria a mudar todo o código que já lê
  // `sentItems[].staffId]`, incluindo o ecrã do funcionário), "Todos" cria
  // um item igual por cada funcionário — cada um fica indistinguível de um
  // aviso enviado individualmente, sem precisar de nenhuma outra mudança.
  const staffOptions = draftType === "aviso"
    ? [{ id: "all", label: t.allStaff }, ...staff.map((s) => ({ id: s.id, label: s.name }))]
    : staff.map((s) => ({ id: s.id, label: s.name }));
  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));

  function openDrawer() {
    setDraftType("reclamacao"); setDraftStaffId(""); setDraftClientId(""); setDraftText(""); setDraftPhoto(null);
    setDrawerOpen(true);
  }
  // Muda o tipo e limpa o funcionário escolhido: "Todos" só existe pro
  // tipo Aviso, por isso uma seleção de "Todos" não pode sobreviver a uma
  // troca pra Reclamação/Elogio (ficaria um valor inválido escondido).
  function changeDraftType(type) { setDraftType(type); setDraftStaffId(""); }
  function handleSend() {
    if (!draftStaffId || !draftClientId || !draftText.trim()) return;
    // `seenByManagement: true` aqui — a própria gerência acabou de criar o
    // item, não há nada "novo" pra ela ver (ver `selectTab`/badges abaixo,
    // e o contraponto em EmployeeAvisosScreen.jsx: lá o supervisor cria
    // SEM esse campo, `undefined` conta como não visto).
    if (draftStaffId === "all") {
      const now = Date.now();
      setSentItems((prev) => [
        ...staff.map((s, i) => ({ id: now + i, type: draftType, staffId: s.id, clientId: Number(draftClientId), text: draftText.trim(), date: isoDateStr(TODAY), hasPhoto: !!draftPhoto, seenByManagement: true })),
        ...prev,
      ]);
    } else {
      setSentItems((prev) => [
        { id: Date.now(), type: draftType, staffId: Number(draftStaffId), clientId: Number(draftClientId), text: draftText.trim(), date: isoDateStr(TODAY), hasPhoto: !!draftPhoto, seenByManagement: true },
        ...prev,
      ]);
    }
    setDrawerOpen(false);
    setToastMsg(t.sent);
    setTimeout(() => setToastMsg(null), 5000);
  }
  function toggleResolved(id) {
    const item = missingItems.find((m) => m.id === id);
    setMissingItems((prev) => prev.map((m) => (m.id === id ? { ...m, resolved: !m.resolved } : m)));
    if (item && item.kind === "correcao" && !item.resolved) {
      setHorasData((prev) => ({
        ...prev,
        [item.staffId]: { ...(prev[item.staffId] || { entries: [], paid: false }), status: "pendente", lockedWeeks: {}, reopened: true },
      }));
    }
  }
  function startReply(id, current) { setReplyingId(id); setReplyDraft(current || ""); }
  function sendReply(id) { setMissingItems((prev) => prev.map((m) => (m.id === id ? { ...m, response: replyDraft.trim() } : m))); setReplyingId(null); }

  const tabContent = {
    reclamacoes: { items: complaints, type: "reclamacao" },
    elogios: { items: praises, type: "elogio" },
    avisos: { items: notices, type: "aviso" },
  }[tab];

  // QA (achado do Iago — "só deve aparecer o número das coisas novas e
  // não vistas"): os 3 selos de Reclamações/Elogios/Avisos gerais eram a
  // contagem TOTAL de tudo que já foi enviado daquele tipo (nunca
  // encolhiam). Ao entrar numa dessas abas, marca tudo daquele tipo como
  // visto (`seenByManagement: true`) — o Pedidos fica de fora de
  // propósito (ele já tem o próprio estado Novo/Pendente/Resolvido, não
  // precisa de um segundo conceito de "visto").
  function selectTab(key) {
    setTab(key);
    const typeByTab = { reclamacoes: "reclamacao", elogios: "elogio", avisos: "aviso" };
    const type = typeByTab[key];
    if (!type) return;
    setSentItems((prev) => prev.map((i) => (i.type === type && !i.seenByManagement ? { ...i, seenByManagement: true } : i)));
  }

  return (
    <div style={styles.content}>
      <PageHeader title={t.title} actions={<Button icon={Plus} onClick={openDrawer}>{t.newAviso}</Button>} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <FilterChip active={tab === "pedidos"} onClick={() => selectTab("pedidos")} count={pendingSolicitations}>{t.sectionSolicitations}</FilterChip>
        <FilterChip active={tab === "reclamacoes"} onClick={() => selectTab("reclamacoes")} count={complaints.filter((i) => !i.seenByManagement).length}>{t.tabComplaints}</FilterChip>
        <FilterChip active={tab === "elogios"} onClick={() => selectTab("elogios")} count={praises.filter((i) => !i.seenByManagement).length}>{t.sectionPraise}</FilterChip>
        <FilterChip active={tab === "avisos"} onClick={() => selectTab("avisos")} count={notices.filter((i) => !i.seenByManagement).length}>{t.sectionNotices}</FilterChip>
      </div>

      {tab === "pedidos" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleMissingItems.length === 0 ? <EmptyNote>{t.nothingHere}</EmptyNote> : visibleMissingItems.map((m) => (
            <PedidoCard
              key={m.id} m={m} staff={staff} clients={clients} lang={lang} t={t} c0={c0}
              stale={isSolicitationStale(m, openPeriod)}
              replying={replyingId} replyDraft={replyDraft} setReplyDraft={setReplyDraft}
              onStartReply={startReply} onSendReply={sendReply} onToggleResolved={toggleResolved}
            />
          ))}
          {staleMissingItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStale((v) => !v)}
              style={{
                alignSelf: "flex-start", background: "transparent", border: "none", cursor: "pointer",
                color: COLORS.ink2, fontSize: 12.5, fontWeight: 600, padding: "6px 2px", fontFamily: "inherit",
                textDecoration: "underline",
              }}
            >
              {showStale ? t.hideClosedPeriodItems : t.showClosedPeriodItems(staleMissingItems.length)}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tabContent.items.length === 0 ? <EmptyNote>{t.nothingHere}</EmptyNote> : tabContent.items.map((item) => (
            <SentItemCard key={item.id} item={item} type={tabContent.type} staff={staff} clients={clients} c0={c0} />
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        title={t.drawerNewTitle}
        closeLabel={c0.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>{c0.cancel}</Button>
            <Button
              onClick={handleSend}
              disabled={!draftStaffId || !draftClientId || !draftText.trim()}
              disabledReason={!draftStaffId ? t.chooseStaffReason : (!draftClientId || !draftText.trim()) ? c0.requiredField : undefined}
            >
              {t.send}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <TypeCard type="reclamacao" active={draftType === "reclamacao"} onClick={() => changeDraftType("reclamacao")} label={t.typeComplaint} />
          <TypeCard type="elogio" active={draftType === "elogio"} onClick={() => changeDraftType("elogio")} label={t.typePraise} />
          <TypeCard type="aviso" active={draftType === "aviso"} onClick={() => changeDraftType("aviso")} label={t.typeNotice} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label={t.formStaff}>
            <SearchSelect
              value={draftStaffId} onChange={setDraftStaffId} options={staffOptions}
              placeholder={t.formStaffPlaceholder} searchPlaceholder={T[lang].funcionarios.searchPlaceholder} noResultsLabel={c0.noResults}
            />
          </Field>
          <Field label={t.formClient}>
            <SearchSelect
              value={draftClientId} onChange={setDraftClientId} options={clientOptions}
              placeholder={t.formClientPlaceholder} searchPlaceholder={T[lang].clientes.searchPlaceholder} noResultsLabel={c0.noResults}
            />
          </Field>
          <Field label={t.formText}>
            <textarea style={styles.textarea} rows={4} placeholder={t.formTextPlaceholder} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
          </Field>
          <PhotoDropzone file={draftPhoto} onChange={setDraftPhoto} label={t.attachPhoto} removeLabel={t.removePhoto} />
        </div>
      </Drawer>

      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} closeLabel={c0.close} />}
    </div>
  );
}

export default AvisosScreen;
