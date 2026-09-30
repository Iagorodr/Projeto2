import { useState } from "react";
import { X, Trash2, Home as HouseIcon, StickyNote } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { mobStyles } from "../../styles/mobStyles.js";
import { COLORS } from "../../styles/colors.js";
import { TODAY } from "../../models/data.js";
import { isoDateStr, notesForOwner, fmtNoteDate } from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar, LangSwitcher, Field } from "./Layout.jsx";
import { usePushNotifications } from "../../hooks/usePushNotifications.js";

function NotasScreen({ lang, setLang, onHome, ownerId, personalNotes, setPersonalNotes, desktop }) {
  const t = T[lang].notas;
  const todayIso = isoDateStr(TODAY);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const notes = notesForOwner(personalNotes, ownerId);
  const push = usePushNotifications(ownerId);

  function addNote() {
    if (!date || !text.trim()) return;
    setPersonalNotes((prev) => [...(prev || []), { id: Date.now(), ownerId, date, text: text.trim() }]);
    setDate(""); setText("");
  }
  function deleteNote(id) {
    setPersonalNotes((prev) => (prev || []).filter((n) => n.id !== id));
  }

  const body = (
    <>
      <div style={{ ...styles.defSettingHint, marginBottom: 14, maxWidth: 560 }}>{t.subtitle}</div>

      {push.supported && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
            background: COLORS.bg, marginBottom: 16, maxWidth: 560,
          }}
        >
          <div style={{ fontSize: 12.5, color: COLORS.text }}>
            {push.subscribed ? t.pushEnabled : push.permission === "denied" ? t.pushDenied : t.pushOffer}
          </div>
          {!push.subscribed && push.permission !== "denied" && (
            <button
              style={{ ...styles.editButton, flexShrink: 0, opacity: push.busy ? 0.6 : 1, cursor: push.busy ? "not-allowed" : "pointer" }}
              onClick={() => push.subscribe()}
              disabled={push.busy}
            >
              {t.pushEnable}
            </button>
          )}
        </div>
      )}

      <div style={desktop ? { ...styles.formGrid, maxWidth: 560 } : { display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label={t.fDate}>
          <input type="date" style={styles.input} value={date} min={todayIso} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t.fText} full>
          <textarea
            style={{ ...styles.input, minHeight: 72, resize: "vertical", fontFamily: "inherit" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.textPlaceholder}
          />
        </Field>
      </div>
      <button
        style={{ ...styles.newButton, marginTop: 12, opacity: date && text.trim() ? 1 : 0.5, cursor: date && text.trim() ? "pointer" : "not-allowed" }}
        onClick={addNote}
        disabled={!date || !text.trim()}
      >
        {t.addNote}
      </button>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {notes.length === 0 ? (
          <div style={styles.noResults}>{t.noNotes}</div>
        ) : (
          notes.map((n) => {
            const due = n.date <= todayIso;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10,
                  background: due ? COLORS.extraTint : COLORS.surface,
                  border: `1px solid ${due ? COLORS.extra : COLORS.border}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: due ? COLORS.extra : COLORS.textSoft, minWidth: 40, flexShrink: 0, marginTop: 1 }}>
                  {fmtNoteDate(n.date)}
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, flex: 1, lineHeight: 1.45 }}>
                  {due && <span style={{ fontWeight: 700, color: COLORS.extra }}>{t.dueTag} · </span>}
                  {n.text}
                </div>
                <button
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.extra, flexShrink: 0 }}
                  onClick={() => deleteNote(n.id)}
                  aria-label={t.deleteNote}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  if (desktop) {
    return (
      <div style={styles.content}>
        <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />
        <h1 style={styles.title}>{t.title}</h1>
        {body}
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <StickyNote size={18} color={COLORS.primaryDark} />
        <h1 style={{ ...styles.title, marginBottom: 0 }}>{t.title}</h1>
      </div>
      {body}
    </div>
  );
}

export default NotasScreen;
