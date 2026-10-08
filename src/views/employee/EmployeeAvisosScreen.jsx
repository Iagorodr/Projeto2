import { useState } from "react";
import { Plus, MapPin, HelpCircle, PackageX } from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { clientById, staffById, isoDateStr, fmtNoteDate, getAssignedClientIds } from "../../models/utils.js";
import { T, missingItemSubjectLabel } from "../../models/i18n.js";
import { Field } from "../shared/Layout.jsx";
import {
  PageHeader, Button, Drawer, Pill, SupervisorTag, FilterChip, SearchSelect, PhotoDropzone, Card, Toast, MobileHeader,
} from "../shared/ui/index.js";
import { TYPE_META, TypeIconBlock } from "../shared/avisosTypeMeta.jsx";
import AbsenceSheet from "../shared/AbsenceSheet.jsx";

// Ícone por "Assunto" do Pedido (documento, 5.6: "só há 3 opções fixas:
// 'Falta de produto', 'Problema no local', 'Outro'"). As 3 opções
// pertencem ao universo de "Pedido" (clay-tint, igual TYPE_META.pedido no
// ecrã da gerência) — só o ícone muda por assunto, não a cor.
const SUBJECT_ICONS = { produto: PackageX, local: MapPin, outro: HelpCircle };

// Mesma derivação de estado do ecrã da gerência (Novo/Pendente/Resolvido a
// partir de `resolved`/`response`, sem campo novo) — repetida aqui (não
// extraída pra partilhado) porque é uma linha só e já está "fixada" nos
// dois sítios onde existe (AvisosScreen.jsx da gerência tem a mesma
// função local, com o mesmo comentário).
function pedidoStatus(m) {
  if (m.resolved) return "resolved";
  if (m.response) return "pending";
  return "new";
}

// Cartão grande selecionável do sheet "Novo aviso" (documento, 5.6:
// "cada um com ícone e altura 64") — layout horizontal, diferente do
// `TypeCard` vertical da gaveta da gerência (a secção 4.7 não define
// altura pra esse). Reaproveitado também no sheet "Reportar sobre um
// colega" pros 3 tipos (Reclamação/Elogio/Aviso).
function BigSelectCard({ icon: Icon, iconBg, iconColor, active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", height: 64, padding: "0 14px",
        borderRadius: RADIUS.control, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        border: active ? `2px solid ${COLORS.forest500}` : `1px solid ${COLORS.line}`,
        background: active ? COLORS.forest50 : COLORS.card, boxSizing: "border-box",
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: RADIUS.chip, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={18} color={iconColor} />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{label}</span>
    </button>
  );
}

// `FilterChip` (Etapa 2) não tem noção de "ponto de por ler" — em vez de
// mudar o componente partilhado (usado por vários outros ecrãs já
// fechados), este envolve-o e desenha o ponto clay por cima, só aqui onde
// o documento pede (5.6: "separadores em chips com contagem e ponto clay
// se houver por ler").
function ChipWithDot({ active, onClick, count, dot, children }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <FilterChip active={active} onClick={onClick} count={count}>{children}</FilterChip>
      {dot && (
        <span
          style={{
            position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: 999,
            background: COLORS.clay, border: `2px solid ${COLORS.bg}`,
          }}
        />
      )}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div style={{ fontSize: 13.5, color: COLORS.ink3, textAlign: "center", padding: "32px 16px", border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.card }}>{children}</div>;
}

// Cartão de um item "Recebido" (reclamação/elogio/aviso enviado pela
// gerência, ou por um supervisor — documento, 5.6: "Recebidos
// (Reclamações, Elogios, Avisos gerais)"). Sem pílula de estado (como no
// `SentItemCard` da gerência — estes são registos, não pedidos a tratar).
// Toca-se no cartão pra marcar como lido (substitui o antigo "Ler
// mais/Ler menos" por toque simples, já que o texto deixa de ser cortado).
function ReceivedCard({ item, lang, onOpen }) {
  const typeLabelT = T[lang].avisos;
  const title = item.type === "reclamacao" ? typeLabelT.typeComplaint : item.type === "elogio" ? typeLabelT.typePraise : typeLabelT.typeNotice;
  const fromSupervisor = item.sentBy === "supervisor";
  const unread = !item.read;
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      style={{
        display: "flex", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        padding: 14, borderRadius: RADIUS.card, border: `1px solid ${COLORS.line}`, background: COLORS.card, boxSizing: "border-box",
      }}
    >
      <TypeIconBlock type={item.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.clay, flexShrink: 0 }} />}
          <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{title}</span>
          {fromSupervisor && <SupervisorTag kind="origin">{T[lang].common.sentBySupervisor}</SupervisorTag>}
        </div>
        <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 4 }}>{fmtNoteDate(item.date)}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 6 }}>{item.text}</div>
      </div>
    </button>
  );
}

// Cartão de um item "Enviado por mim" — ou um Pedido (com pílula de
// estado Novo/Pendente/Resolvido e a resposta da gerência, se houver), ou
// (só supervisor) um relatório "sobre um colega" (sem estado, igual ao
// `SentItemCard` da gerência: é um registo, não um pedido a tratar).
function SentFeedCard({ entry, staff, clients, lang, t, c0 }) {
  if (entry.kind === "pedido") {
    const m = entry.data;
    const c = m.clientId ? clientById(clients, m.clientId) : null;
    const status = pedidoStatus(m);
    const subject = missingItemSubjectLabel(m, lang);
    return (
      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <TypeIconBlock type="pedido" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{subject}</span>
              <Pill variant={status === "resolved" ? "paid" : status === "pending" ? "pending" : "neutral"}>
                {status === "resolved" ? c0.resolved : status === "pending" ? c0.pending : c0.newLabel}
              </Pill>
            </div>
            <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 4 }}>{c ? `${c.name} · ` : ""}{fmtNoteDate(m.date)}</div>
            <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 6 }}>{m.text}</div>
            {m.response && (
              <div style={{ marginTop: 10, background: COLORS.lineSoft, borderRadius: RADIUS.chip, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink2, marginBottom: 2 }}>{t.yourReplyFromManagement}</div>
                <div style={{ fontSize: 13, color: COLORS.ink }}>{m.response}</div>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }
  const item = entry.data;
  const s = staffById(staff, item.staffId);
  const c = clientById(clients, item.clientId);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <TypeIconBlock type={item.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{s ? s.name : "—"}</span>
            {c && <Pill variant="neutral">{c.name}</Pill>}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 6 }}>{fmtNoteDate(item.date)}{item.hasPhoto && " · 📎"}</div>
          <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 4 }}>{item.text}</div>
        </div>
      </div>
    </Card>
  );
}

// Avisos (funcionário + supervisor, documento 5.6) — "regra de ouro"
// (secção 5): mesmo ecrã nos dois papéis e em qualquer tamanho (`desktop`
// vem de `useBreakpoint()` em App.jsx, mesmo padrão de
// EmployeeHistoricoScreen.jsx/EmployeeClientesScreen.jsx). Abre em
// Recebidos (a caixa de entrada), não num formulário vazio — o antigo
// formulário fixo no topo e os 5 acordeões (Pedidos enviados,
// Reclamações, Elogios, Avisos, e a secção do supervisor) tornam-se: botão
// "+ Novo aviso" (abre sheet/gaveta) + 2 separadores ("Recebidos" funde
// Reclamações/Elogios/Avisos; "Enviados por mim" funde Pedidos + relatórios
// do supervisor).
function EmployeeAvisosScreen({ lang, setLang, onHome, staffId, clients, staff, assignments, missingItems, setMissingItems, sentItems, setSentItems, absences, setAbsences, isSupervisor, desktop }) {
  const t = T[lang].employeeAvisos;
  const tAbs = T[lang].absences;
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const tr = T[lang].reportar;
  const avT = T[lang].avisos;
  const c0 = T[lang].common;
  const myClients = clients.filter((c) => getAssignedClientIds(assignments, staffId).includes(c.id));

  const [tab, setTab] = useState("recebidos");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [subjectKey, setSubjectKey] = useState(null);
  const [draftClientId, setDraftClientId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportType, setReportType] = useState("reclamacao");
  const [reportStaffId, setReportStaffId] = useState("");
  const [reportClientId, setReportClientId] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportPhoto, setReportPhoto] = useState(null);
  const [reportToastMsg, setReportToastMsg] = useState(null);

  const myReceived = sentItems.filter((i) => i.staffId === staffId);
  const receivedSorted = [...myReceived].sort((a, b) => b.date.localeCompare(a.date));
  const unreadReceived = myReceived.filter((i) => !i.read).length;

  const mySent = missingItems.filter((m) => m.staffId === staffId);
  const reportTargets = staff.filter((s) => s.id !== staffId);
  const mySentReports = isSupervisor ? sentItems.filter((i) => i.sentByStaffId === staffId) : [];
  const sentFeed = [
    ...mySent.map((m) => ({ kind: "pedido", date: m.date, data: m })),
    ...mySentReports.map((r) => ({ kind: "report", date: r.date, data: r })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const reportStaffOptions = reportTargets.map((s) => ({ id: s.id, label: s.name }));
  const reportClientOptions = clients.map((c) => ({ id: c.id, label: c.name }));

  function openSheet() { setSubjectKey(null); setDraftClientId(""); setDraftText(""); setSheetOpen(true); }
  function handleSend() {
    if (!subjectKey || !draftClientId || !draftText.trim()) return;
    setMissingItems((prev) => [
      { id: Date.now(), staffId, clientId: Number(draftClientId), kind: subjectKey, text: draftText.trim(), date: isoDateStr(TODAY), resolved: false, response: "" },
      ...prev,
    ]);
    setSheetOpen(false);
    setToastMsg(t.sent);
    setTimeout(() => setToastMsg(null), 5000);
  }

  function openReportSheet() {
    setReportType("reclamacao"); setReportStaffId(""); setReportClientId(""); setReportText(""); setReportPhoto(null);
    setReportSheetOpen(true);
  }
  function handleSendReport() {
    if (!reportStaffId || !reportClientId || !reportText.trim()) return;
    // QA (achado do Iago, Avisos da gerência — "só deve aparecer o
    // número de coisas novas"): sem `seenByManagement` aqui (ao contrário
    // do que a própria gerência cria em AvisosScreen.jsx, que já nasce
    // visto) — isto é exatamente o tipo de item que deve contar como
    // "novo" pra gerência até ela abrir aquela aba.
    setSentItems((prev) => [
      { id: Date.now(), type: reportType, staffId: Number(reportStaffId), clientId: Number(reportClientId), text: reportText.trim(), date: isoDateStr(TODAY), hasPhoto: !!reportPhoto, sentBy: "supervisor", sentByStaffId: staffId },
      ...prev,
    ]);
    setReportSheetOpen(false);
    setReportToastMsg(tr.sentToast);
    setTimeout(() => setReportToastMsg(null), 5000);
  }

  function markRead(id) {
    setSentItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  }

  const tabsRow = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      <ChipWithDot active={tab === "recebidos"} onClick={() => setTab("recebidos")} count={myReceived.length} dot={unreadReceived > 0}>{t.tabReceived}</ChipWithDot>
      <FilterChip active={tab === "enviados"} onClick={() => setTab("enviados")} count={sentFeed.length}>{t.sentSection}</FilterChip>
    </div>
  );

  const listBody = tab === "recebidos" ? (
    receivedSorted.length === 0 ? (
      <EmptyNote>{t.nothingReceived}</EmptyNote>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {receivedSorted.map((item) => <ReceivedCard key={item.id} item={item} lang={lang} onOpen={markRead} />)}
      </div>
    )
  ) : (
    sentFeed.length === 0 ? (
      <EmptyNote>{t.noSent}</EmptyNote>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sentFeed.map((entry) => <SentFeedCard key={`${entry.kind}-${entry.data.id}`} entry={entry} staff={staff} clients={clients} lang={lang} t={t} c0={c0} />)}
      </div>
    )
  );

  const newAvisoSheet = (
    <Drawer
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={t.newAviso}
      closeLabel={c0.close}
      footer={
        <Button
          size="mobile" style={{ width: "100%" }} onClick={handleSend}
          disabled={!subjectKey || !draftClientId || !draftText.trim()}
          disabledReason={!subjectKey ? t.chooseSubjectReason : (!draftClientId || !draftText.trim()) ? c0.requiredField : undefined} disabledReasonBelow
        >
          {t.send}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {t.subjects.map((s) => (
          <BigSelectCard
            key={s.key} icon={SUBJECT_ICONS[s.key]} iconBg={COLORS.clayTint} iconColor={COLORS.clayInk}
            active={subjectKey === s.key} onClick={() => setSubjectKey(s.key)} label={s.label}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={t.client}>
          <select value={draftClientId} onChange={(e) => setDraftClientId(e.target.value)} style={styles.input}>
            <option value="">{t.clientPlaceholder}</option>
            {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <textarea style={styles.textarea} rows={4} placeholder={t.body} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
      </div>
    </Drawer>
  );

  // Sheet "Reportar sobre um colega" (só supervisor, documento 5.6:
  // "ação própria, secundária... Não usa a lista de assuntos" — reaproveita
  // os 3 cartões de TIPO (Reclamação/Elogio/Aviso, iguais aos da gaveta da
  // gerência) em vez dos 3 de assunto do sheet acima.
  const reportSheet = isSupervisor && (
    <Drawer
      open={reportSheetOpen}
      onClose={() => setReportSheetOpen(false)}
      title={t.reportColleagueSection}
      closeLabel={c0.close}
      footer={
        <Button
          size="mobile" style={{ width: "100%" }} onClick={handleSendReport}
          disabled={!reportStaffId || !reportClientId || !reportText.trim()}
          disabledReason={!reportStaffId ? avT.chooseStaffReason : (!reportClientId || !reportText.trim()) ? c0.requiredField : undefined} disabledReasonBelow
        >
          {tr.send}
        </Button>
      }
    >
      <div style={{ fontSize: 13, color: COLORS.ink2, marginBottom: 14 }}>{tr.subtitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <BigSelectCard icon={TYPE_META.reclamacao.icon} iconBg={TYPE_META.reclamacao.bg} iconColor={TYPE_META.reclamacao.iconColor} active={reportType === "reclamacao"} onClick={() => setReportType("reclamacao")} label={tr.typeComplaint} />
        <BigSelectCard icon={TYPE_META.elogio.icon} iconBg={TYPE_META.elogio.bg} iconColor={TYPE_META.elogio.iconColor} active={reportType === "elogio"} onClick={() => setReportType("elogio")} label={tr.typePraise} />
        <BigSelectCard icon={TYPE_META.aviso.icon} iconBg={TYPE_META.aviso.bg} iconColor={TYPE_META.aviso.iconColor} active={reportType === "aviso"} onClick={() => setReportType("aviso")} label={tr.typeNotice} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={tr.formStaff}>
          <SearchSelect value={reportStaffId} onChange={setReportStaffId} options={reportStaffOptions} placeholder={tr.formStaffPlaceholder} searchPlaceholder={T[lang].funcionarios.searchPlaceholder} noResultsLabel={c0.noResults} />
        </Field>
        <Field label={tr.formClient}>
          <SearchSelect value={reportClientId} onChange={setReportClientId} options={reportClientOptions} placeholder={tr.formClientPlaceholder} searchPlaceholder={T[lang].clientes.searchPlaceholder} noResultsLabel={c0.noResults} />
        </Field>
        <Field label={tr.formText}>
          <textarea style={styles.textarea} rows={4} placeholder={tr.formTextPlaceholder} value={reportText} onChange={(e) => setReportText(e.target.value)} />
        </Field>
        <PhotoDropzone file={reportPhoto} onChange={setReportPhoto} label={tr.attachPhoto} removeLabel={avT.removePhoto} />
      </div>
    </Drawer>
  );

  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader
          title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES}
          actions={
            <>
              <Button variant="secondary" onClick={() => setAbsenceOpen(true)}>{tAbs.btn}</Button>
              {isSupervisor && <Button variant="secondary" onClick={openReportSheet}>{t.reportColleagueSection}</Button>}
              <Button icon={Plus} onClick={openSheet}>{t.newAviso}</Button>
            </>
          }
        />
        {tabsRow}
        {listBody}
        {newAvisoSheet}
        {reportSheet}
        <AbsenceSheet lang={lang} open={absenceOpen} onClose={() => setAbsenceOpen(false)} staffId={staffId} absences={absences} setAbsences={setAbsences} />
        {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} closeLabel={c0.close} />}
        {reportToastMsg && <Toast message={reportToastMsg} onDismiss={() => setReportToastMsg(null)} closeLabel={c0.close} />}
      </div>
    );
  }

  return (
    <div style={mobStyles.phone}>
      <MobileHeader onBack={onHome} backLabel={t.backLabel} title={t.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

      <Button size="mobile" icon={Plus} onClick={openSheet} style={{ width: "100%", marginBottom: isSupervisor ? 8 : 16 }}>{t.newAviso}</Button>
      <Button variant="secondary" onClick={() => setAbsenceOpen(true)} style={{ width: "100%", marginBottom: isSupervisor ? 8 : 16 }}>{tAbs.btn}</Button>
      {isSupervisor && (
        <Button variant="secondary" onClick={openReportSheet} style={{ width: "100%", marginBottom: 16 }}>{t.reportColleagueSection}</Button>
      )}

      {tabsRow}
      {listBody}

      {newAvisoSheet}
      {reportSheet}
      <AbsenceSheet lang={lang} open={absenceOpen} onClose={() => setAbsenceOpen(false)} staffId={staffId} absences={absences} setAbsences={setAbsences} />
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} closeLabel={c0.close} />}
      {reportToastMsg && <Toast message={reportToastMsg} onDismiss={() => setReportToastMsg(null)} closeLabel={c0.close} />}
    </div>
  );
}

export default EmployeeAvisosScreen;
