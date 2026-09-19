import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, MENU_ITEMS,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  buildClosedPeriodSnapshot, getCutoffPeriod, formatPeriodLabel, startOfISOWeek, addDays, isoDateStr,
  weekDiff, clientAppliesThisWeek, weekLabelPT, staffTotalHours, staffTotalPay, getAssignedClientIds,
  recomputeSharedHours,
} from "../../models/utils.js";
import { TopBar, LangSwitcher, Field, ViewField, Sidebar } from "../shared/Layout.jsx";

function AgendasScreen({ lang, setLang, clients, staff, assignments, setAssignments }) {
  const [staffSearch, setStaffSearch] = useState("");
  const [openCell, setOpenCell] = useState(null);
  const [cellSearch, setCellSearch] = useState("");

  const visibleStaff = staff.filter((s) => s.name.toLowerCase().includes(staffSearch.toLowerCase()));

  function cellKey(staffId, day) { return `${staffId}-${day}`; }
  function getCellClientIds(staffId, day) { return assignments[cellKey(staffId, day)] || []; }
  function addClient(staffId, day, clientId) {
    const key = cellKey(staffId, day);
    setAssignments((prev) => {
      const current = prev[key] || [];
      if (current.includes(clientId)) return prev;
      return { ...prev, [key]: [...current, clientId] };
    });
    setCellSearch(""); setOpenCell(null);
  }
  function removeClient(staffId, day, clientId) {
    const key = cellKey(staffId, day);
    setAssignments((prev) => ({ ...prev, [key]: (prev[key] || []).filter((id) => id !== clientId) }));
  }
  function teamSizeFor(day, clientId) {
    return staff.filter((s) => getCellClientIds(s.id, day).includes(clientId)).length;
  }

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />

      <div style={styles.agdSearchWrap}>
        <input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Pesquisar funcionário" style={styles.defTextInput} />
      </div>

      <div style={styles.agdGridWrap}>
        <div style={styles.agdGridScroll}>
          <div style={{ ...styles.agdGridRow, ...styles.agdGridHeaderRow }}>
            <div style={styles.agdStaffHeaderCell}>Funcionário</div>
            {AGENDA_DAYS.map((d) => <div key={d} style={styles.agdDayHeaderCell}>{DAY_LABELS_1_7[d]}</div>)}
          </div>

          {visibleStaff.length === 0 ? (
            <div style={styles.noResults}>Nenhum funcionário encontrado</div>
          ) : (
            visibleStaff.map((s) => (
              <div key={s.id} style={styles.agdGridRow}>
                <div style={styles.agdStaffCell}>{s.name}</div>
                {AGENDA_DAYS.map((day) => {
                  const clientIds = getCellClientIds(s.id, day);
                  const key = cellKey(s.id, day);
                  const isOpen = openCell === key;
                  return (
                    <div key={day} style={styles.agdDayCell}>
                      {clientIds.map((cid) => {
                        const client = clientById(clients, cid);
                        if (!client) return null;
                        const teamSize = teamSizeFor(day, cid);
                        return (
                          <div key={cid} style={styles.agdChip}>
                            <span style={styles.agdChipText}>{client.name}</span>
                            {teamSize > 1 && <span style={styles.agdTeamBadge}><UsersRound size={10} style={{ marginRight: 2 }} />{teamSize}</span>}
                            <button style={styles.agdChipRemove} onClick={() => removeClient(s.id, day, cid)}><X size={10} /></button>
                          </div>
                        );
                      })}

                      {isOpen ? (
                        <div style={styles.agdCellPopover}>
                          <input
                            autoFocus
                            value={cellSearch}
                            onChange={(e) => setCellSearch(e.target.value)}
                            placeholder="Pesquisar cliente"
                            style={styles.agdCellSearchInput}
                          />
                          <div style={styles.agdCellResults}>
                            {clients
                              .filter((c) => c.name.toLowerCase().includes(cellSearch.toLowerCase()) && !clientIds.includes(c.id))
                              .map((c) => (
                                <button key={c.id} style={styles.agdCellResultRow} onClick={() => addClient(s.id, day, c.id)}>{c.name}</button>
                              ))}
                          </div>
                          <button style={styles.agdCellCancel} onClick={() => { setOpenCell(null); setCellSearch(""); }}><X size={12} /></button>
                        </div>
                      ) : (
                        <button style={styles.agdAddCellButton} onClick={() => setOpenCell(key)}><Plus size={12} /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.agdFootNote}>Quando 2+ funcionários têm o mesmo cliente no mesmo dia, viram equipe automaticamente (selo com o número de pessoas).</div>
    </div>
  );
}

export default AgendasScreen;
