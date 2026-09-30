import { styles } from "../../styles/styles.js";
import { TODAY } from "../../models/data.js";
import { isoDateStr, notesForOwner } from "../../models/utils.js";
import { formatTodayLabel, T } from "../../models/i18n.js";
import { TopBar } from "../shared/Layout.jsx";
import { NotesWidget } from "../shared/NotesWidget.jsx";

function SupervisorDashboardScreen({ lang, setLang, me, personalNotes, onNavigate }) {
  const t = T[lang].employeeMenu;
  const todayIso = isoDateStr(TODAY);
  const notes = notesForOwner(personalNotes, me.id);

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label={formatTodayLabel(lang)} />
      <h1 style={styles.title}>{t.hello}, {me.name}</h1>
      <div style={{ maxWidth: 560, marginTop: 14 }}>
        <NotesWidget notes={notes} todayIso={todayIso} lang={lang} onSeeAll={() => onNavigate("notas")} limit={6} />
      </div>
    </div>
  );
}

export default SupervisorDashboardScreen;
