import { useState } from "react";
import { Plus, Trash2, Home as HouseIcon, StickyNote } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { mobStyles } from "../../styles/mobStyles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS } from "../../styles/tokens.js";
import { LANG_NAMES, TODAY } from "../../models/data.js";
import { isoDateStr, addDays, startOfISOWeek, notesForOwner, monthAbbr } from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { LangSwitcher, Field } from "./Layout.jsx";
import { PageHeader, Button, IconButton, Drawer, Pill, Card, Toast } from "./ui/index.js";
import { usePushNotifications } from "../../hooks/usePushNotifications.js";

// "YYYY-MM-DD" -> Date local (meia-noite local, não UTC) — mesmo padrão já
// usado no resto do projeto pra interpretar datas ISO (ver `parseDMY`,
// `startOfISOWeek`, etc. em utils.js), pra não misturar com o
// `Date.parse` nativo (que lê a string como UTC e pode desalinhar um dia
// consoante o fuso horário).
function isoToLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysAgoCount(pastIso, todayIso) {
  return Math.round((isoToLocalDate(todayIso) - isoToLocalDate(pastIso)) / 86400000);
}

const STATE_BY_GROUP = { hoje: "hoje", atraso: "atraso", semana: "normal", depois: "normal" };

// Bloco de data 46×46 (documento, 4.8/5.7: "bloco de data 46 px, dia +
// mês"), colorido pelo estado da nota: hoje = clay-tint (destaque),
// atrasada = alert-tint, resto = neutro.
function DateBlock({ dateIso, lang, state }) {
  const [, m, d] = dateIso.split("-");
  const monthLabel = monthAbbr(lang, Number(m) - 1);
  const bg = state === "hoje" ? COLORS.clayTint : state === "atraso" ? COLORS.alertTint : COLORS.lineSoft;
  const ink = state === "hoje" ? COLORS.clayInk : state === "atraso" ? COLORS.alert : COLORS.ink2;
  return (
    <div
      style={{
        width: 46, height: 46, borderRadius: RADIUS.chip, background: bg, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: ink, lineHeight: 1 }}>{d}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: ink, textTransform: "uppercase", letterSpacing: "0.02em", marginTop: 1 }}>{monthLabel}</div>
    </div>
  );
}

// Cartão de uma nota — bloco de data, texto (com "há N dias" só nas
// atrasadas), botão eliminar (40 na gerência, 48 no telemóvel — os dois
// tamanhos já existentes do `IconButton` partilhado batem certo com os
// dois tamanhos que o documento pede aqui, por acaso).
function NoteCard({ note, lang, state, t, todayIso, onDelete, deleteSize }) {
  return (
    <Card style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <DateBlock dateIso={note.date} lang={lang} state={state} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {state === "atraso" && (
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.alert, marginBottom: 2 }}>
            {t.daysAgo(daysAgoCount(note.date, todayIso))}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: COLORS.ink, lineHeight: 1.4 }}>{note.text}</div>
      </div>
      <IconButton icon={Trash2} size={deleteSize} onClick={() => onDelete(note.id)} ariaLabel={t.deleteNote} />
    </Card>
  );
}

// Grupo da lista (documento: "Hoje", "Em atraso", "Esta semana", "Mais
// tarde") — não desenha nada se estiver vazio, pra não deixar um título
// solto sem cartões por baixo.
function NoteGroup({ groupKey, label, items, lang, t, todayIso, onDelete, deleteSize }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.ink3, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((n) => (
          <NoteCard key={n.id} note={n} lang={lang} state={STATE_BY_GROUP[groupKey]} t={t} todayIso={todayIso} onDelete={onDelete} deleteSize={deleteSize} />
        ))}
      </div>
    </div>
  );
}

// Estado vazio (documento: "ícone + 'Sem lembretes. Adicione o
// primeiro.'").
function EmptyNotes({ text }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 16px", textAlign: "center" }}>
      <StickyNote size={28} color={COLORS.ink3} strokeWidth={1.5} />
      <div style={{ fontSize: 13.5, color: COLORS.ink3 }}>{text}</div>
    </div>
  );
}

// Estado das notificações push — a pílula/cartão muda consoante o
// documento pede em cada lado (4.8 gerência: pílula sozinha quando ativa,
// botão "Ativar notificações" quando não; 5.7 telemóvel: cartão
// empilhado — texto + botão a toda a largura — que se reduz a uma
// pílula quando ativa).
function PushStatus({ push, t, desktop }) {
  if (!push.supported) return null;
  const gap = desktop ? 18 : 14;
  if (push.subscribed) {
    return <div style={{ marginBottom: gap }}><Pill variant="paid">{desktop ? t.pushEnabled : t.pushEnabledShort}</Pill></div>;
  }
  if (push.permission === "denied") {
    return <div style={{ fontSize: 12.5, color: COLORS.ink3, marginBottom: gap }}>{t.pushDenied}</div>;
  }
  if (desktop) {
    return <div style={{ marginBottom: gap }}><Button variant="secondary" onClick={() => push.subscribe()} disabled={push.busy}>{t.pushEnable}</Button></div>;
  }
  return (
    <Card style={{ padding: 14, marginBottom: gap }}>
      <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 10 }}>{t.pushOffer}</div>
      <Button size="mobile" style={{ width: "100%" }} onClick={() => push.subscribe()} disabled={push.busy}>{t.pushEnable}</Button>
    </Card>
  );
}

// Notas — lembretes pessoais com data (documento, 4.8 gerência / 5.7
// telemóvel). Ecrã partilhado entre gerência e funcionário/supervisor,
// em qualquer tamanho de ecrã: `ownerId` é o id do funcionário (dono das
// notas) ou a string "management" pras notas partilhadas da gerência;
// `desktop` escolhe o enquadramento (PC/tablet = `PageHeader`+conteúdo,
// telemóvel = moldura `mobStyles.phone`) — mesmo padrão já usado em
// EmployeeHistoricoScreen.jsx/EmployeeAvisosScreen.jsx.
function NotasScreen({ lang, setLang, onHome, ownerId, personalNotes, setPersonalNotes, desktop }) {
  const t = T[lang].notas;
  const c0 = T[lang].common;
  const todayIso = isoDateStr(TODAY);
  const weekEndIso = isoDateStr(addDays(startOfISOWeek(TODAY), 6));
  const notes = notesForOwner(personalNotes, ownerId);
  const push = usePushNotifications(ownerId);

  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [undoInfo, setUndoInfo] = useState(null);

  function openSheet() { setDate(""); setText(""); setSheetOpen(true); }
  function addNote() {
    if (!date || !text.trim()) return;
    setPersonalNotes((prev) => [...(prev || []), { id: Date.now(), ownerId, date, text: text.trim() }]);
    setDate(""); setText(""); setSheetOpen(false);
  }
  // Documento, 4.8/5.7, literal: "ao eliminar, toast com 'Desfazer' (não
  // há confirmação)" — elimina logo, sem perguntar, e dá 5s pra desfazer
  // (a nota fica guardada no próprio toast até lá, não num lado
  // qualquer do estado global).
  function deleteNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setPersonalNotes((prev) => (prev || []).filter((n) => n.id !== id));
    setUndoInfo({ note });
    setTimeout(() => setUndoInfo((cur) => (cur && cur.note.id === note.id ? null : cur)), 5000);
  }
  function undoDelete() {
    if (!undoInfo) return;
    setPersonalNotes((prev) => [...(prev || []), undoInfo.note]);
    setUndoInfo(null);
  }

  function bucketOf(n) {
    if (n.date === todayIso) return "hoje";
    if (n.date < todayIso) return "atraso";
    if (n.date <= weekEndIso) return "semana";
    return "depois";
  }
  const groups = { hoje: [], atraso: [], semana: [], depois: [] };
  notes.forEach((n) => groups[bucketOf(n)].push(n));
  const groupDefs = [
    { key: "hoje", label: t.groupToday },
    { key: "atraso", label: t.groupOverdue },
    { key: "semana", label: t.groupThisWeek },
    { key: "depois", label: t.groupLater },
  ];

  const list = notes.length === 0 ? (
    <EmptyNotes text={t.emptyState} />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groupDefs.map((g) => (
        <NoteGroup key={g.key} groupKey={g.key} label={g.label} items={groups[g.key]} lang={lang} t={t} todayIso={todayIso} onDelete={deleteNote} deleteSize={desktop ? "gerencia" : "mobile"} />
      ))}
    </div>
  );

  const undoToast = undoInfo && (
    <Toast message={t.noteDeletedToast} actionLabel={t.undo} onAction={undoDelete} onDismiss={() => setUndoInfo(null)} closeLabel={c0.close} />
  );

  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader title={t.title} subtitle={t.subtitle} lang={lang} setLang={setLang} langNames={LANG_NAMES} />

        <PushStatus push={push} t={t} desktop />

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 7, minWidth: 280 }}>{list}</div>
          <Card style={{ flex: 5, minWidth: 260, padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label={t.fDate}>
                <input type="date" style={styles.input} value={date} min={todayIso} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t.fText}>
                <textarea style={{ ...styles.textarea, minHeight: 84 }} rows={4} placeholder={t.textPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <Button onClick={addNote} disabled={!date || !text.trim()} disabledReason={!date ? t.chooseDateReason : !text.trim() ? c0.requiredField : undefined}>{t.addNote}</Button>
            </div>
          </Card>
        </div>

        {undoToast}
      </div>
    );
  }

  return (
    <div style={{ ...mobStyles.phone, maxWidth: 460 }}>
      <div style={mobStyles.header}>
        <button style={mobStyles.homeIcon} onClick={onHome} aria-label="menu">
          <HouseIcon size={18} color={COLORS.textSoft} />
        </button>
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
      <h1 style={mobStyles.title}>{t.title}</h1>
      <div style={{ fontSize: 12.5, color: COLORS.ink3, marginBottom: 14, textAlign: "center" }}>{t.subtitle}</div>

      <PushStatus push={push} t={t} desktop={false} />

      <Button size="mobile" icon={Plus} onClick={openSheet} style={{ width: "100%", marginBottom: 18 }}>{t.newNote}</Button>

      {list}

      <Drawer
        open={sheetOpen} onClose={() => setSheetOpen(false)} title={t.newNote} closeLabel={c0.close}
        footer={
          <Button
            size="mobile" style={{ width: "100%" }} onClick={addNote}
            disabled={!date || !text.trim()} disabledReason={!date ? t.chooseDateReason : !text.trim() ? c0.requiredField : undefined} disabledReasonBelow
          >
            {t.addNote}
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label={t.fDate}>
            <input type="date" style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} value={date} min={todayIso} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t.fText}>
            <textarea style={{ ...styles.textarea, minHeight: 84 }} rows={4} placeholder={t.textPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
      </Drawer>

      {undoToast}
    </div>
  );
}

export default NotasScreen;
