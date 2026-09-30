import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { mobStyles } from "../../styles/mobStyles.js";
import { styles } from "../../styles/styles.js";
import { COLORS } from "../../styles/colors.js";
import {
  TYPE_ICONS, MONTHS_ABBR_PT, DAY_LABELS_1_7, AGENDA_DAYS, TODAY, WEEKDAY_FULL_PT, DAY_ABBR_SUN0_PT,
} from "../../models/data.js";
import {
  clientById, staffById, pad2, fmtEuro, fmtHoursNum, fmtMinutes, parseDMY, dateStrInPeriod,
  startOfISOWeek, addDays, isoDateStr, weekDiff, clientAppliesThisWeek, weekLabelPT,
  getAssignedClientIds, recomputeSharedHours, getCutoffPeriod, formatPeriodLabel,
  getWeekChunk, getPayPeriodFor, getWeekChunkFor, nextWeekChunk, prevWeekChunk,
  buildWeekChunkSequence, weekChunksOfPayPeriod, calPeriodDays, calPeriodLabel,
} from "../../models/utils.js";
import { T } from "../../models/i18n.js";
import { LangSwitcher } from "../shared/Layout.jsx";

function EmployeeClientesScreen({ lang, setLang, onHome, staffId, clients, assignments, canViewAll }) {
  const t = T[lang].employeeClientes;
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const myClientIds = getAssignedClientIds(assignments, staffId);
  const myClients = canViewAll ? clients : clients.filter((c) => myClientIds.includes(c.id));
  const filtered = myClients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

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
            return (
              <div key={c.id} style={mobStyles.clientCard}>
                <button style={{ ...mobStyles.clientHeader, borderBottom: isExpanded ? `1px solid ${COLORS.border}` : "none" }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div style={mobStyles.clientHeaderLeft}>
                    <div style={mobStyles.iconCircle}><Icon size={18} color={COLORS.primaryDark} /></div>
                    <div style={{ textAlign: "left", minWidth: 0 }}>
                      <div style={mobStyles.clientName}>{c.name} - {c.availability}</div>
                      <div style={mobStyles.clientSub}>{fmtMinutes(c.duration)} · {(c.days || []).length}x</div>
                    </div>
                  </div>
                  <ChevronDown size={16} color={COLORS.textSoft} style={{ transform: isExpanded ? "rotate(180deg)" : "none" }} />
                </button>
                {isExpanded && (
                  <div style={mobStyles.clientBody}>
                    <div style={mobStyles.detailBlock}>
                      <div style={mobStyles.detailLabel}>{t.address}</div>
                      <div style={mobStyles.addressRow}>
                        <span style={mobStyles.detailText}>{c.address}</span>
                        {c.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...mobStyles.mapLink, textDecoration: "none" }}
                          >
                            <MapPin size={12} style={{ marginRight: 4 }} />{t.openMap}
                          </a>
                        )}
                      </div>
                    </div>
                    {c.description && <div style={mobStyles.detailBlock}><div style={mobStyles.detailLabel}>{t.description}</div><div style={mobStyles.detailText}>{c.description}</div></div>}
                    {c.priorities && <div style={mobStyles.detailBlock}><div style={mobStyles.detailLabel}>{t.priorities}</div><div style={mobStyles.detailText}>{c.priorities}</div></div>}
                    {c.note && <div style={mobStyles.detailBlock}><div style={mobStyles.detailLabel}>{t.note}</div><div style={mobStyles.detailText}>{c.note}</div></div>}
                    {!c.description && !c.priorities && !c.note && <div style={mobStyles.noDetails}>{t.noDetails}</div>}
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
