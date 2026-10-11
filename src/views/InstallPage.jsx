import React, { useEffect, useMemo, useState } from "react";
import {
  Share, MoreHorizontal, MoreVertical, PlusSquare, Check, Download, Menu, Compass,
  Chrome, ChevronDown, Copy, ExternalLink, Smartphone, CheckCircle2,
} from "lucide-react";
import { COLORS } from "../styles/colors.js";
import { INSTALL_TEXTS } from "../models/installTexts.js";
import { Shot } from "./InstallMocks.jsx";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

// Página /instalar — pensada para ser enviada por WhatsApp/SMS. Deteta o
// aparelho e o navegador e mostra só os passos que servem a essa pessoa.

function detectEnv() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const touchMac = typeof navigator !== "undefined" && /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || touchMac;
  const isAndroid = /Android/i.test(ua);
  // Navegadores embutidos noutras apps: não deixam instalar nada.
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Messenger|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest|GSA\//i.test(ua)
    || (isAndroid && /; wv\)/i.test(ua));
  let browser = "other";
  if (isIOS) {
    if (/CriOS/i.test(ua)) browser = "chrome";
    else if (/FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua)) browser = "other";
    else if (/Safari/i.test(ua) && !inApp) browser = "safari";
    else browser = inApp ? "safari" : "other";
  } else if (isAndroid) {
    if (/SamsungBrowser/i.test(ua)) browser = "samsung";
    else if (/Firefox/i.test(ua)) browser = "firefox";
    else if (/EdgA|OPR\/|OPT\/|DuckDuckGo|Brave/i.test(ua)) browser = "other";
    else if (/Chrome\//i.test(ua)) browser = "chrome";
  }
  return { isIOS, isAndroid, inApp, browser };
}

function initialLang() {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q && INSTALL_TEXTS[q]) return q;
    const saved = window.localStorage.getItem("servix_lang");
    if (saved && INSTALL_TEXTS[saved]) return saved;
  } catch (e) { /* sem armazenamento */ }
  const nav = ((navigator.language || "pt") + "").slice(0, 2).toLowerCase();
  return INSTALL_TEXTS[nav] ? nav : "pt";
}

const ICONS = {
  more: MoreHorizontal, down: ChevronDown, dots: MoreVertical, share: Share, plus: PlusSquare, check: Check,
  install: Download, menu: Menu, safari: Compass, chrome: Chrome,
};

function StepCard({ index, step, word, lang }) {
  const Icon = ICONS[step.icon] || Check;
  return (
    <div style={S.step}>
      <div style={S.stepRow}>
        <div style={S.stepNum}>{index + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.stepHead}>
            <span style={S.stepWord}>{word} {index + 1}</span>
          </div>
          <div style={S.stepTitle}>{step.title}</div>
          <div style={S.stepText}>{step.text}</div>
        </div>
        <div style={S.stepIcon}><Icon size={26} color={COLORS.primaryDark} strokeWidth={2} /></div>
      </div>
      {step.shot && <Shot name={step.shot} lang={lang} />}
    </div>
  );
}

function InstallPage() {
  const [lang, setLang] = useState(initialLang);
  const t = INSTALL_TEXTS[lang];
  const env = useMemo(detectEnv, []);
  const { installed, canPromptNative, promptInstall } = useInstallPrompt();
  const [os, setOs] = useState(env.isIOS ? "ios" : "android");
  const [browser, setBrowser] = useState(env.browser);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [qr, setQr] = useState("");

  const showNative = !env.inApp && (canPromptNative || done);
  const isDesktop = !env.isIOS && !env.isAndroid;
  const url = typeof window !== "undefined" ? window.location.origin + "/instalar" : "";

  useEffect(() => {
    try { window.localStorage.setItem("servix_lang", lang); } catch (e) { /* ignora */ }
    document.title = t.title;
  }, [lang, t.title]);

  useEffect(() => {
    if (!isDesktop) return;
    import("qrcode").then((m) => (m.default || m).toDataURL(url, { margin: 1, width: 220, color: { dark: "#143F35", light: "#FFFFFF" } }))
      .then(setQr).catch(() => {});
  }, [isDesktop, url]);

  // Se o aparelho muda de sistema, o navegador tem de ser um dos desse sistema.
  const browsers = os === "ios" ? ["safari", "chrome", "other"] : ["chrome", "samsung", "firefox", "other"];
  const activeBrowser = browsers.includes(browser) ? browser : browsers[0];
  const stepsKey = `${os}-${activeBrowser}`;
  const steps = t.steps[stepsKey] || t.steps[`${os}-other`];

  function copyLink() {
    const finish = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(finish).catch(finish);
    else {
      const el = document.createElement("textarea");
      el.value = url; document.body.appendChild(el); el.select();
      try { document.execCommand("copy"); } catch (e) { /* ignora */ }
      document.body.removeChild(el); finish();
    }
  }

  async function doInstall() {
    const ok = await promptInstall();
    if (ok) setDone(true);
  }

  const chromeIntent = `intent://${window.location.host}/instalar#Intent;scheme=https;package=com.android.chrome;end`;

  return (
    <div style={S.page}>
      <style>{"@keyframes svxPulse{0%,100%{box-shadow:0 0 0 4px rgba(229,72,77,.35)}50%{box-shadow:0 0 0 9px rgba(229,72,77,.08)}}"}</style>
      <div style={S.wrap}>
        <div style={S.topRow}>
          <div style={S.brand}>
            <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
            <span style={S.brandName}>Servix</span>
          </div>
          <div style={S.langRow}>
            {Object.keys(INSTALL_TEXTS).map((code) => (
              <button key={code} onClick={() => setLang(code)} style={{ ...S.langBtn, ...(lang === code ? S.langBtnOn : null) }}>
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <h1 style={S.h1}>{t.title}</h1>
        <p style={S.sub}>{t.subtitle}</p>

        {installed ? (
          <div style={{ ...S.card, ...S.okCard }}>
            <CheckCircle2 size={28} color={COLORS.okInk} />
            <div>
              <div style={S.cardTitle}>{t.alreadyTitle}</div>
              <div style={S.cardText}>{t.alreadyBody}</div>
            </div>
          </div>
        ) : isDesktop ? (
          <div style={S.card}>
            <div style={S.cardTitle}>{t.desktopTitle}</div>
            <div style={S.cardText}>{t.desktopBody}</div>
            {qr && <img src={qr} alt="QR" width={220} height={220} style={{ display: "block", margin: "16px auto", borderRadius: 12, border: `1px solid ${COLORS.border}` }} />}
            <div style={{ ...S.cardText, marginBottom: 8 }}>{t.desktopNote}</div>
            <div style={S.linkRow}>
              <code style={S.linkBox}>{url}</code>
              <button style={S.ghostBtn} onClick={copyLink}><Copy size={15} />{copied ? t.copied : t.copyLink}</button>
            </div>
          </div>
        ) : (
          <>
            {env.inApp && (
              <div style={{ ...S.card, ...S.warnCard }}>
                <div style={S.cardTitle}>{t.inAppTitle}</div>
                <div style={S.cardText}>{t.inAppBody}</div>
                <div style={S.btnRow}>
                  {env.isAndroid && (
                    <a href={chromeIntent} style={S.primaryBtn}><ExternalLink size={17} />{t.openInChrome}</a>
                  )}
                  <button style={env.isAndroid ? S.ghostBtn : S.primaryBtn} onClick={copyLink}>
                    <Copy size={16} />{copied ? t.copied : t.copyLink}
                  </button>
                </div>
                <div style={{ ...S.cardText, marginTop: 12 }}>{env.isAndroid ? t.inAppStepsAndroid : t.inAppStepsIOS}</div>
              </div>
            )}

            {showNative && (
              <div style={S.card}>
                {done ? (
                  <div style={{ ...S.cardTitle, color: COLORS.okInk }}>{t.installedOk}</div>
                ) : (
                  <>
                    <button style={{ ...S.primaryBtn, width: "100%", justifyContent: "center", fontSize: 17, padding: "16px 18px" }} onClick={doInstall}>
                      <Download size={20} />{t.installNow}
                    </button>
                    <div style={{ ...S.cardText, marginTop: 10, textAlign: "center" }}>{t.installNowHint}</div>
                  </>
                )}
              </div>
            )}

            {!showNative && (
              <>
                <div style={S.tabs}>
                  {["ios", "android"].map((k) => (
                    <button key={k} onClick={() => setOs(k)} style={{ ...S.tab, ...(os === k ? S.tabOn : null) }}>
                      <Smartphone size={15} />{k === "ios" ? t.iphone : t.android}
                    </button>
                  ))}
                </div>

                <div style={S.label}>{t.browserLabel}</div>
                <div style={S.chips}>
                  {browsers.map((b) => (
                    <button key={b} onClick={() => setBrowser(b)} style={{ ...S.chip, ...(activeBrowser === b ? S.chipOn : null) }}>
                      {t[b]}
                    </button>
                  ))}
                </div>
                <div style={S.hint}>{t.detected}</div>

                <div style={S.stepList}>
                  {steps.map((s, i) => <StepCard key={stepsKey + lang + i} index={i} step={s} word={t.stepWord} lang={lang} />)}
                </div>
              </>
            )}
          </>
        )}

        {!installed && (
          <div style={S.card}>
            <div style={S.cardTitle}>{t.afterTitle}</div>
            <div style={S.cardText}>{t.afterBody}</div>
          </div>
        )}

        <div style={{ ...S.card, background: "transparent", border: `1px dashed ${COLORS.lineInput}` }}>
          <div style={S.cardTitle}>{installed ? t.openApp : t.stuckTitle}</div>
          {!installed && <div style={S.cardText}>{t.stuckBody}</div>}
          <a href="/" style={{ ...S.ghostBtn, marginTop: 12, textDecoration: "none", display: "inline-flex" }}>
            {installed ? t.openApp : t.useInBrowser}
          </a>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: COLORS.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: COLORS.text, padding: "16px 16px 40px" },
  wrap: { maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandName: { fontFamily: "'Poppins', 'Inter', sans-serif", fontWeight: 700, fontSize: 20, color: COLORS.primaryDark },
  langRow: { display: "flex", gap: 4 },
  langBtn: { border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.textSoft, borderRadius: 8, padding: "6px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  langBtnOn: { background: COLORS.primaryDark, color: "#fff", borderColor: COLORS.primaryDark },
  h1: { fontFamily: "'Poppins', 'Inter', sans-serif", fontSize: 28, lineHeight: 1.15, margin: "8px 0 0", color: COLORS.primaryDark },
  sub: { margin: 0, fontSize: 16, lineHeight: 1.45, color: COLORS.textSoft },
  card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 },
  okCard: { display: "flex", gap: 14, alignItems: "center", background: COLORS.okTint, borderColor: COLORS.ok },
  warnCard: { background: COLORS.amberBg, borderColor: "#E9C987" },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6, color: COLORS.primaryDark },
  cardText: { fontSize: 14.5, lineHeight: 1.5, color: COLORS.textSoft },
  btnRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.primaryDark, color: "#fff", border: "none", borderRadius: 12, padding: "13px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none", fontFamily: "inherit" },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.surface, color: COLORS.primaryDark, border: `1.5px solid ${COLORS.primaryDark}`, borderRadius: 12, padding: "11px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  linkRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  linkBox: { flex: 1, minWidth: 0, background: COLORS.bg, borderRadius: 8, padding: "10px 12px", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tabs: { display: "flex", gap: 8, background: COLORS.sidebarBg, borderRadius: 14, padding: 4 },
  tab: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "none", background: "transparent", borderRadius: 11, padding: "12px 8px", fontSize: 14.5, fontWeight: 700, color: COLORS.textSoft, cursor: "pointer", fontFamily: "inherit" },
  tabOn: { background: COLORS.surface, color: COLORS.primaryDark, boxShadow: "0 1px 4px rgba(20,63,53,.15)" },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: COLORS.textSoft, marginBottom: -6 },
  chips: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: { border: `1.5px solid ${COLORS.lineInput}`, background: COLORS.surface, color: COLORS.text, borderRadius: 999, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  chipOn: { background: COLORS.primaryTint, borderColor: COLORS.primary, color: COLORS.primaryDark },
  hint: { fontSize: 13, color: COLORS.textSoft, lineHeight: 1.4 },
  stepList: { display: "flex", flexDirection: "column", gap: 12 },
  step: { display: "flex", flexDirection: "column", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16 },
  stepRow: { display: "flex", gap: 14, alignItems: "flex-start" },
  stepNum: { width: 34, height: 34, borderRadius: "50%", background: COLORS.primaryDark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 },
  stepHead: { marginBottom: 2 },
  stepWord: { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: COLORS.textSoft },
  stepTitle: { fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: COLORS.text, marginBottom: 4 },
  stepText: { fontSize: 14.5, lineHeight: 1.5, color: COLORS.textSoft },
  stepIcon: { width: 52, height: 52, borderRadius: 14, background: COLORS.primaryTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
};

export default InstallPage;
