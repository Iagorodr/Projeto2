// Ajuda (gerência, supervisor e funcionário): guia de cada página + formulário para reportar um
// problema, pedir apoio ou sugerir uma ideia. O pedido chega à administração do Servix (/admin)
// com a página, o papel, o nome e a empresa (a empresa e o e-mail vêm do login, no banco).
//  • PC/tablet: botão fixo "?" (HelpFab) abre `HelpDrawer`, já virado para a página em que se está.
//  • Telemóvel: sem botão fixo — "Ajuda" é uma página (HelpScreen) no menu "Mais".
import { useState } from "react";
import { ChevronDown, CircleHelp, Send, CheckCircle2 } from "lucide-react";
import { styles } from "../../styles/styles.js";
import { mobStyles } from "../../styles/mobStyles.js";
import { COLORS } from "../../styles/colors.js";
import { RADIUS, FONT, SHADOW } from "../../styles/tokens.js";
import { LANG_NAMES } from "../../models/data.js";
import { T } from "../../models/i18n.js";
import { helpTexts } from "../../models/helpTexts.js";
import { submitHelpReport, HELP_KINDS } from "../../models/helpApi.js";
import { Card, Button, PageHeader, MobileHeader, Drawer, SegmentedControl } from "./ui/index.js";

const MANAGER_ORDER = ["dashboard", "clientes", "contratantes", "agendas", "horas", "monitoramento", "historico", "avisos", "notas", "funcionarios", "acessos", "definicoes"];
const STAFF_ORDER = ["menu", "horas", "agenda", "avisos", "clientes", "historico", "monitoramento", "notas"];

// Quais páginas existem para este papel e como se chamam no menu.
function pageList(lang, role) {
  const manager = role === "manager";
  const names = manager ? T[lang].sidebar : T[lang].supervisorSidebar;
  const order = manager ? MANAGER_ORDER : STAFF_ORDER.filter((k) => role === "supervisor" || k !== "monitoramento");
  return order.map((key) => ({ key, name: names[key] })).filter((p) => p.name);
}

function pageSummary(h, role, key) {
  return h.pages[role === "manager" ? "manager" : "staff"][key] || "";
}

function pageName(lang, role, key) {
  const names = role === "manager" ? T[lang].sidebar : T[lang].supervisorSidebar;
  return names[key] || "";
}

function GuideRow({ page, summary, open, onToggle }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.lineSoft}` }}>
      <button
        type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "none", padding: "8px 2px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{page.name}</span>
        <ChevronDown size={18} color={COLORS.ink3} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} />
      </button>
      {open && <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5, padding: "0 2px 12px" }}>{summary}</div>}
    </div>
  );
}

function ReportForm({ lang, role, reportKey, userName, small }) {
  const h = helpTexts(lang).ui;
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ phase: "idle", reason: null, demo: false });
  const kindLabels = { problem: h.kindProblem, support: h.kindSupport, idea: h.kindIdea };
  const canSend = message.trim().length >= 3 && state.phase !== "sending";

  async function send() {
    if (!canSend) return;
    setState({ phase: "sending", reason: null, demo: false });
    const res = await submitHelpReport({ kind, message: message.trim(), screen: reportKey, role, lang, authorName: userName });
    if (res.ok) { setState({ phase: "sent", reason: null, demo: !!res.demo }); setMessage(""); }
    else setState({ phase: "error", reason: res.reason, demo: false });
  }

  if (state.phase === "sent") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "10px 0 4px" }}>
        <CheckCircle2 size={30} color={COLORS.vivo} />
        <div style={{ fontWeight: 700, color: COLORS.ink }}>{h.sentTitle}</div>
        <div style={{ fontSize: 13.5, color: COLORS.ink2 }}>{state.demo ? h.sentDemo : h.sentText}</div>
        <Button variant="secondary" onClick={() => setState({ phase: "idle", reason: null, demo: false })} style={{ marginTop: 6 }}>{h.sendAnother}</Button>
      </div>
    );
  }

  const errorText = state.phase === "error"
    ? ({ too_many: h.errTooMany, invalid: h.errInvalid, missing: h.errMissing }[state.reason] || h.errGeneric)
    : null;
  const screenLabel = reportKey ? (pageName(lang, role, reportKey) || reportKey) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5 }}>{h.reportIntro}</div>
      {small
        ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {HELP_KINDS.map((k) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.ink, minHeight: 36, cursor: "pointer" }}>
                <input type="radio" name="help-kind" checked={kind === k} onChange={() => setKind(k)} style={{ accentColor: COLORS.vivo, width: 18, height: 18 }} />
                {kindLabels[k]}
              </label>
            ))}
          </div>
        )
        : <div><SegmentedControl value={kind} onChange={setKind} options={HELP_KINDS.map((k) => ({ value: k, label: kindLabels[k] }))} /></div>}
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: COLORS.ink2 }}>
        {h.messageLabel}
        <textarea
          style={{ ...styles.textarea, minHeight: 110, fontSize: 14, fontWeight: 400 }} rows={5} maxLength={4000}
          placeholder={h.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <div style={{ fontSize: 12, color: COLORS.ink3 }}>{h.sendsWith(screenLabel, userName)}</div>
      {errorText && <div role="alert" style={{ background: COLORS.alertTint, color: COLORS.alert, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{errorText}</div>}
      <Button icon={Send} onClick={send} disabled={!canSend} disabledReason={message.trim().length < 3 ? h.sendDisabled : undefined} disabledReasonBelow>
        {state.phase === "sending" ? h.sending : h.send}
      </Button>
    </div>
  );
}

// Corpo da Ajuda (usado na página do telemóvel e na gaveta do PC).
//  contextKey = página em que a pessoa está (cartão "Esta página"); reportKey = o que vai no pedido.
function HelpBody({ lang, role, contextKey, reportKey, userName, small }) {
  const h = helpTexts(lang).ui;
  const pages = pageList(lang, role);
  const [openKey, setOpenKey] = useState(null);
  const ctxSummary = contextKey ? pageSummary(helpTexts(lang), role, contextKey) : "";
  const ctxName = contextKey ? pageName(lang, role, contextKey) : "";
  const others = pages;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {contextKey && ctxName && (
        <Card variant="tintOk" style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.vivoInk, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>{h.thisPage}</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{ctxName}</div>
          <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.5 }}>{ctxSummary || h.noGuide}</div>
        </Card>
      )}

      <Card style={{ padding: 16 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.ink }}>{h.reportTitle}</div>
        <div style={{ height: 10 }} />
        <ReportForm key={lang} lang={lang} role={role} reportKey={reportKey} userName={userName} small={small} />
      </Card>

      <Card style={{ padding: "14px 16px 4px" }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: COLORS.ink }}>{h.guides}</div>
        <div style={{ fontSize: 12.5, color: COLORS.ink3, margin: "2px 0 8px" }}>{h.guidesHint}</div>
        {others.map((p) => (
          <GuideRow key={p.key} page={p} summary={pageSummary(helpTexts(lang), role, p.key) || h.noGuide} open={openKey === p.key} onToggle={() => setOpenKey(openKey === p.key ? null : p.key)} />
        ))}
      </Card>
    </div>
  );
}

// Página "Ajuda" inteira (telemóvel; no PC também funciona se se chegar aqui).
export default function HelpScreen({ lang, setLang, role, reportKey, userName, onHome, desktop }) {
  const h = helpTexts(lang).ui;
  const body = <HelpBody lang={lang} role={role} contextKey={desktop ? reportKey : null} reportKey={reportKey} userName={userName} small={!desktop} />;
  if (desktop) {
    return (
      <div style={styles.content}>
        <PageHeader title={h.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
        <div style={{ maxWidth: 720 }}>{body}</div>
      </div>
    );
  }
  return (
    <div style={{ ...mobStyles.phone, maxWidth: 460 }}>
      <MobileHeader onBack={onHome} backLabel={h.back} title={h.title} lang={lang} setLang={setLang} langNames={LANG_NAMES} />
      {body}
    </div>
  );
}

// Gaveta do PC/tablet, aberta pelo botão "?" na página atual.
export function HelpDrawer({ open, onClose, lang, role, screenKey, userName }) {
  const h = helpTexts(lang).ui;
  return (
    <Drawer open={open} onClose={onClose} icon={CircleHelp} title={h.title} closeLabel={h.close}>
      <HelpBody lang={lang} role={role} contextKey={screenKey} reportKey={screenKey} userName={userName} small />
    </Drawer>
  );
}

// Botão fixo "?" (só PC/tablet), canto inferior direito.
export function HelpFab({ lang, onClick }) {
  const h = helpTexts(lang).ui;
  return (
    <button
      type="button" onClick={onClick} aria-label={h.fabLabel} title={h.fabLabel}
      style={{
        position: "fixed", right: 22, bottom: 22, zIndex: 40, width: 52, height: 52, borderRadius: RADIUS.pill ?? 999,
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(180deg, ${COLORS.vivoBtnTop}, ${COLORS.vivoBtnBottom})`, color: "#fff",
        boxShadow: SHADOW.sh2 || "0 10px 20px -8px rgba(31,122,95,.7)",
      }}
    >
      <CircleHelp size={26} strokeWidth={2} />
    </button>
  );
}
