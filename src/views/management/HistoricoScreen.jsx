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

function HistoricoScreen({ lang, setLang, clients, closedPeriods }) {
  const [openId, setOpenId] = useState(null);
  const [openStaffId, setOpenStaffId] = useState(null);
  const open = closedPeriods.find((p) => p.id === openId);
  function closeModal() { setOpenId(null); setOpenStaffId(null); }

  return (
    <div style={styles.content}>
      <TopBar lang={lang} setLang={setLang} label="Dia 16 de setembro, 2026" />
      <h1 style={styles.title}>HISTÓRICO</h1>
      <div style={{ ...styles.defSettingHint, marginBottom: 14, maxWidth: 640 }}>
        Um período entra aqui quando é fechado na tela de Horas (todos pagos). Clique numa linha para ver o detalhe completo daquele período.
      </div>

      {closedPeriods.length === 0 ? (
        <div style={styles.noResults}>Nenhum período fechado ainda. Feche um período em Horas quando todos os funcionários estiverem pagos.</div>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.tableHeaderRow}>
            <div style={{ ...styles.th, flex: 1.6 }}>Período</div>
            <div style={{ ...styles.th, flex: 1 }}>Horas</div>
            <div style={{ ...styles.th, flex: 1 }}>Valor</div>
            <div style={{ ...styles.th, flex: 1 }}>Reclamações</div>
            <div style={{ ...styles.th, flex: 1 }}>Elogios</div>
            <div style={{ ...styles.th, flex: 1 }}>Avisos</div>
            <div style={{ ...styles.th, flex: 1.3 }}>Solicitações</div>
          </div>
          {closedPeriods.map((p) => (
            <button key={p.id} style={styles.tableRow} onClick={() => setOpenId(p.id)}>
              <div style={{ ...styles.td, flex: 1.6, fontWeight: 600 }}>{p.periodLabel}</div>
              <div style={{ ...styles.td, flex: 1 }}>{fmtHoursNum(p.totalHours)}h</div>
              <div style={{ ...styles.td, flex: 1 }}>{fmtEuro(p.totalEuros)}</div>
              <div style={{ ...styles.td, flex: 1 }}>{p.reclamacoes}</div>
              <div style={{ ...styles.td, flex: 1 }}>{p.elogios}</div>
              <div style={{ ...styles.td, flex: 1 }}>{p.avisos}</div>
              <div style={{ ...styles.td, flex: 1.3 }}>{p.solicitacoesResolvidas}/{p.solicitacoes}</div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={{ ...styles.modalCard, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{open.periodLabel}</div>
                <div style={styles.modalSubtitle}>Fechado em {open.closedAt} · Total: {fmtHoursNum(open.totalHours)}h · {fmtEuro(open.totalEuros)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.cancelButton} onClick={() => window.print()}>Exportar PDF</button>
                <button style={styles.modalClose} onClick={closeModal}><X size={16} /></button>
              </div>
            </div>

            <div style={styles.sectionTitle}>Horas por funcionário (clique para ver dia a dia)</div>
            <div style={{ ...styles.tableWrap, marginBottom: 18 }}>
              <div style={styles.tableHeaderRow}>
                <div style={{ ...styles.th, flex: 2 }}>Funcionário</div>
                <div style={{ ...styles.th, flex: 1 }}>Horas</div>
                <div style={{ ...styles.th, flex: 1 }}>Valor</div>
                <div style={{ ...styles.th, flex: 1 }}>Pago</div>
              </div>
              {open.staffSummaries.map((s) => {
                const isStaffOpen = openStaffId === s.staffId;
                return (
                  <div key={s.staffId}>
                    <button style={styles.tableRow} onClick={() => setOpenStaffId(isStaffOpen ? null : s.staffId)}>
                      <div style={{ ...styles.td, flex: 2, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ ...styles.td, flex: 1 }}>{fmtHoursNum(s.hours)}h</div>
                      <div style={{ ...styles.td, flex: 1 }}>{fmtEuro(s.euros)}</div>
                      <div style={{ ...styles.td, flex: 1 }}>
                        <span style={{ ...styles.statusBadge, ...(s.paid ? styles.statusActive : styles.statusInactive) }}>{s.paid ? "Pago" : "Não pago"}</span>
                      </div>
                    </button>
                    {isStaffOpen && (
                      <div style={{ padding: "6px 16px 12px", background: COLORS.bg }}>
                        {s.entries.length === 0 ? (
                          <div style={styles.avNoItems}>Sem lançamentos.</div>
                        ) : (
                          s.entries.map((e, i) => {
                            const c = clientById(clients, e.clientId);
                            return (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12.5, borderBottom: `1px solid ${COLORS.border}` }}>
                                <span>{e.date} · {c ? c.name : "—"}</span>
                                <span>{fmtHoursNum(e.hours)}h{e.extra && "*"}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.sectionTitle}>Reclamações ({open.reclamacoes})</div>
            {open.reclamacoesItems.length === 0 ? <div style={{ ...styles.avNoItems, marginBottom: 14 }}>Nenhuma neste período.</div> : (
              <div style={{ ...styles.avItemsList, marginBottom: 14 }}>
                {open.reclamacoesItems.map((i) => (
                  <div key={i.id} style={styles.avItemCard}>
                    <div style={styles.avItemDate}>{i.date}</div>
                    <div style={styles.avItemText}>{i.text}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.sectionTitle}>Elogios ({open.elogios})</div>
            {open.elogiosItems.length === 0 ? <div style={{ ...styles.avNoItems, marginBottom: 14 }}>Nenhum neste período.</div> : (
              <div style={{ ...styles.avItemsList, marginBottom: 14 }}>
                {open.elogiosItems.map((i) => (
                  <div key={i.id} style={styles.avItemCard}>
                    <div style={styles.avItemDate}>{i.date}</div>
                    <div style={styles.avItemText}>{i.text}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.sectionTitle}>Avisos gerais ({open.avisos})</div>
            {open.avisosItems.length === 0 ? <div style={{ ...styles.avNoItems, marginBottom: 14 }}>Nenhum neste período.</div> : (
              <div style={{ ...styles.avItemsList, marginBottom: 14 }}>
                {open.avisosItems.map((i) => (
                  <div key={i.id} style={styles.avItemCard}>
                    <div style={styles.avItemDate}>{i.date}</div>
                    <div style={styles.avItemText}>{i.text}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.sectionTitle}>Solicitações ({open.solicitacoesResolvidas}/{open.solicitacoes} resolvidas)</div>
            {open.solicitacoesItems.length === 0 ? <div style={styles.avNoItems}>Nenhuma neste período.</div> : (
              <div style={styles.avItemsList}>
                {open.solicitacoesItems.map((i) => (
                  <div key={i.id} style={styles.avItemCard}>
                    <div style={styles.avItemTopRow}>
                      <div style={styles.avItemDate}>{i.date} · {i.kind === "correcao" ? "Correção de horas" : "Falta de produto"}</div>
                      <span style={{ ...styles.statusBadge, ...(i.resolved ? styles.statusActive : styles.statusInactive) }}>{i.resolved ? "Resolvido" : "Pendente"}</span>
                    </div>
                    <div style={styles.avItemText}>{i.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoricoScreen;
