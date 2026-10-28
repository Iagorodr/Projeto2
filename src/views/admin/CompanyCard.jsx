import { useState } from "react";
import { Link2, KeyRound, Pencil, PauseCircle, PlayCircle, CalendarPlus, Users, Building2, Trash2, ArchiveRestore, DatabaseBackup } from "lucide-react";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, SHADOW, FONT } from "../../styles/tokens.js";
import { Badge } from "./AdminUi.jsx";
import { stateInfo, renewedUntil, todayIso, formatIsoDate, isArchived, canArchive, backupInfo } from "../../models/adminCompanies.js";

const RENEW_OPTIONS = [1, 3, 6, 12];

const dangerBtn = { color: COLORS.dangerInk, borderColor: "#E9B8AD" };

const actionBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px", borderRadius: RADIUS.control,
  border: `1px solid ${COLORS.iconBorder}`, background: COLORS.card, color: COLORS.vivoInk, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
};

// Um cartão por empresa. Todas as ações sobem para a página (`on...`).
export default function CompanyCard({ company: c, busy, backup, backupReady, backingUp, onBackup, onRenew, onEdit, onCopyLink, onResetLogin, onToggleSuspend, onArchive, onRestore, onDeleteForever }) {
  const [renewOpen, setRenewOpen] = useState(false);
  const info = stateInfo(c);
  const archived = isArchived(c);
  const today = todayIso(c.timezone);
  const validText = c.validUntil == null
    ? "Sem prazo"
    : `Válida até ${formatIsoDate(c.validUntil)}${c.daysLeft != null ? (c.daysLeft >= 0 ? ` · faltam ${c.daysLeft} d` : ` · venceu há ${-c.daysLeft} d`) : ""}`;

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.card, boxShadow: SHADOW.sh1, padding: 18, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 17, fontWeight: 600, color: COLORS.ink, overflowWrap: "anywhere" }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: COLORS.ink3, marginTop: 2 }}>código <b style={{ color: COLORS.ink2 }}>{c.code}</b></div>
        </div>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <div style={{ fontSize: 13.5, color: COLORS.ink }}>{validText}</div>
      <div style={{ fontSize: 13, color: COLORS.ink2, overflowWrap: "anywhere" }}>{c.managerEmail || "— sem e-mail de gerência —"}</div>
      <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: COLORS.ink3 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Users size={14} /> {c.staffCount} {c.staffCount === 1 ? "funcionário" : "funcionários"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Building2 size={14} /> {c.clientsCount} {c.clientsCount === 1 ? "cliente" : "clientes"}</span>
      </div>
      {c.notes && <div style={{ fontSize: 12.5, color: COLORS.ink2, background: COLORS.headerTint, borderRadius: 8, padding: "7px 10px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.notes}</div>}

      {!archived && backupReady && (() => {
        const bi = backupInfo(backup, c.timezone);
        const warn = bi.tone === "warn";
        return (
          <div role="group" aria-label="Backup" style={{ fontSize: 12.5, lineHeight: 1.5, borderRadius: 8, padding: "8px 10px", background: warn ? COLORS.alertTint : COLORS.headerTint, color: warn ? COLORS.alert : COLORS.ink2 }}>
            <div style={{ fontWeight: 700, color: warn ? COLORS.alert : COLORS.ink }}>{bi.title}</div>
            {bi.lines.map((l) => <div key={l}>{l}</div>)}
          </div>
        );
      })()}

      {archived ? (
        <>
          <div style={{ fontSize: 12.5, color: COLORS.ink2, background: COLORS.headerTint, borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 }}>
            Na lixeira desde {formatIsoDate(String(c.archivedAt).slice(0, 10))}. Sem acesso; os dados continuam guardados até excluir definitivamente.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <button type="button" style={{ ...actionBtn, background: COLORS.mintBg }} onClick={() => onRestore(c)} disabled={busy}><ArchiveRestore size={15} /> Restaurar</button>
            <button type="button" style={{ ...actionBtn, ...dangerBtn }} onClick={() => onDeleteForever(c)} disabled={busy}><Trash2 size={15} /> Excluir definitivamente</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button type="button" style={{ ...actionBtn, background: COLORS.mintBg }} onClick={() => setRenewOpen((v) => !v)} disabled={busy} aria-haspopup="menu" aria-expanded={renewOpen}>
              <CalendarPlus size={15} /> Renovar
            </button>
            {renewOpen && (
              <>
                <div onClick={() => setRenewOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div role="menu" style={{ position: "absolute", top: 42, left: 0, zIndex: 21, minWidth: 230, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, boxShadow: SHADOW.sh2, padding: 6 }}>
                  {RENEW_OPTIONS.map((m) => {
                    const to = renewedUntil(c.validUntil, today, m);
                    return (
                      <button key={m} type="button" role="menuitem" onClick={() => { setRenewOpen(false); onRenew(c, m, to); }}
                        style={{ display: "flex", justifyContent: "space-between", gap: 14, width: "100%", border: "none", background: "transparent", padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: COLORS.ink, fontFamily: "inherit", textAlign: "left" }}>
                        <span>+{m} {m === 1 ? "mês" : "meses"}</span><span style={{ color: COLORS.ink3 }}>até {formatIsoDate(to)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {backupReady && (
            <button type="button" style={actionBtn} onClick={() => onBackup(c)} disabled={busy || backingUp}><DatabaseBackup size={15} /> {backingUp ? "A guardar…" : "Fazer backup agora"}</button>
          )}
          <button type="button" style={actionBtn} onClick={() => onEdit(c)} disabled={busy}><Pencil size={15} /> Editar</button>
          <button type="button" style={actionBtn} onClick={() => onCopyLink(c)}><Link2 size={15} /> Link</button>
          <button type="button" style={actionBtn} onClick={() => onResetLogin(c)} disabled={busy || !c.managerEmail}><KeyRound size={15} /> Nova senha</button>
          <button type="button" style={{ ...actionBtn, color: c.suspended ? COLORS.vivoInk : COLORS.dangerInk, borderColor: c.suspended ? COLORS.iconBorder : "#E9B8AD" }} onClick={() => onToggleSuspend(c)} disabled={busy}>
            {c.suspended ? <><PlayCircle size={15} /> Reativar</> : <><PauseCircle size={15} /> Suspender</>}
          </button>
          {canArchive(c) && (
            <button type="button" style={{ ...actionBtn, ...dangerBtn }} onClick={() => onArchive(c)} disabled={busy}><Trash2 size={15} /> Excluir</button>
          )}
        </div>
      )}
    </div>
  );
}
