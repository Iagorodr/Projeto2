// Camada "Model": geração de relatórios em PDF de verdade (tabela formatada,
// tipo planilha profissional), substituindo o antigo window.print() que só
// imprimia a tela como estava (com botões, ícones de edição etc.).
// jsPDF (~400 kB) só é descarregado quando alguém exporta um PDF.
let pdfLib = null;
async function loadPdf() {
  if (!pdfLib) {
    const [{ jsPDF }, at] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    pdfLib = { jsPDF, autoTable: at.default || at.autoTable };
  }
  return pdfLib;
}
import { clientById, entryClientName, fmtEuro, fmtHoursNum, expenseApprovedValue } from "./utils.js";

// ---------------------------------------------------------------------------
// Padrão fixo dos PDFs (redesign B1, decisão do Iago): cores neutras da app,
// logo da empresa à esquerda, marca Servix à direita e pequenos acentos na cor
// do tema ativo (--p1). Tudo em vetor/texto, por isso fica nítido a imprimir.
// ---------------------------------------------------------------------------
const INK = [21, 24, 22];        // #151816
const INK2 = [90, 98, 92];       // #5A625C
const INK3 = [111, 119, 111];    // #6F776F
const LINE = [226, 229, 223];    // #E2E5DF
const SOFT = [244, 246, 242];    // fundo dos totais / cabeçalho da tabela
const ZEBRA = [250, 251, 249];
const AMBER = [201, 138, 18];    // #C98A12 (atenção — marca d'água "provisório")
const DEFAULT_P1 = "#1E8C5A";
const DEFAULT_P2 = "#166B45";
const M = 40; // margem lateral

function hexToRgb(hex) {
  const h = String(hex || "").trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// Cor do tema ativo, lida das variáveis CSS no <html> (applyTheme).
function themeColors() {
  let p1 = DEFAULT_P1, p2 = DEFAULT_P2;
  try {
    const cs = getComputedStyle(document.documentElement);
    p1 = cs.getPropertyValue("--p1").trim() || p1;
    p2 = cs.getPropertyValue("--p2").trim() || p2;
  } catch { /* fora do browser: cores por defeito */ }
  return { p1: hexToRgb(p1) || hexToRgb(DEFAULT_P1), p2: hexToRgb(p2) || hexToRgb(DEFAULT_P2) };
}

// Logo da empresa (Definições → foto), vindo de `companyInfo.photoUrl`.
let logoCache = { url: null, img: null };

// Converte qualquer imagem (data URL, URL do cofre, webp…) em PNG via canvas.
function loadLogoPng(url) {
  if (!url || typeof document === "undefined") return Promise.resolve(null);
  if (logoCache.url === url) return Promise.resolve(logoCache.img);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (v) => { logoCache = { url, img: v }; resolve(v); };
    const timer = setTimeout(() => done(null), 4000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const max = 256;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        done({ data: c.toDataURL("image/png"), w, h });
      } catch { done(null); }
    };
    img.onerror = () => { clearTimeout(timer); done(null); };
    img.src = url;
  });
}

function shortDate(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr || "-";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Marca Servix (símbolo PROVISÓRIO das duas fitas cruzadas, o mesmo de
// views/shared/Logo.jsx) + nome, alinhada à direita em `rightX`.
function drawServixLogo(doc, rightX, topY, size, colors) {
  const k = size / 64;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 0.62);
  const name = "Servix";
  const textW = doc.getTextWidth(name);
  const gap = size * 0.3;
  const x0 = rightX - textW - gap - size;
  // Curva cúbica do SVG (M p0 C c1 c2 p3) em coordenadas relativas.
  const curve = (p0, c1, c2, p3) => doc.lines([[(c1[0] - p0[0]) * k, (c1[1] - p0[1]) * k, (c2[0] - p0[0]) * k, (c2[1] - p0[1]) * k, (p3[0] - p0[0]) * k, (p3[1] - p0[1]) * k]], x0 + p0[0] * k, topY + p0[1] * k, [1, 1], "S", false);
  doc.setLineCap("round");
  doc.setLineWidth(10 * k); doc.setDrawColor(...colors.p1);
  curve([14, 13], [35, 19], [29, 45], [50, 51]);
  doc.setLineWidth(16 * k); doc.setDrawColor(255, 255, 255);
  curve([50, 13], [29, 19], [35, 45], [14, 51]);
  doc.setLineWidth(10 * k); doc.setDrawColor(...colors.p2);
  curve([50, 13], [29, 19], [35, 45], [14, 51]);
  doc.setLineCap("butt");
  doc.setTextColor(...INK);
  doc.text(name, x0 + size + gap, topY + size * 0.68);
  doc.setFont("helvetica", "normal");
}

// Cabeçalho comum. Esquerda: logo + nome + dados da empresa. Direita: marca
// Servix + data de geração. Depois: título, subtítulo e um traço curto no tom
// do tema. Devolve o Y onde a tabela começa.
async function buildHeader(doc, { companyName, reportTitle, subtitle, pdfT, companyInfo }) {
  const colors = themeColors();
  const W = doc.internal.pageSize.getWidth();
  // Faixa fina de acento no topo da página.
  doc.setFillColor(...colors.p1);
  doc.rect(0, 0, W, 4, "F");

  const logo = await loadLogoPng(companyInfo && companyInfo.photoUrl);
  let textX = M;
  const top = 30;
  if (logo) {
    const box = 40;
    const k = Math.min(box / logo.w, box / logo.h);
    const w = logo.w * k, h = logo.h * k;
    try { doc.addImage(logo.data, "PNG", M + (box - w) / 2, top + (box - h) / 2, w, h); textX = M + box + 12; } catch { /* sem logo */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(companyName || "", textX, top + 15);
  doc.setFont("helvetica", "normal");
  const info = companyInfo ? [
    companyInfo.address,
    [companyInfo.vatNumber && `${pdfT.companyVat || "VAT"}: ${companyInfo.vatNumber}`, companyInfo.phone && `${pdfT.companyPhone || "Tel"}: ${companyInfo.phone}`].filter(Boolean).join("  ·  "),
    companyInfo.iban && `IBAN: ${companyInfo.iban}`,
  ].filter(Boolean) : [];
  doc.setFontSize(8.5);
  doc.setTextColor(...INK2);
  info.forEach((ln, i) => doc.text(String(ln), textX, top + 29 + i * 10.5));

  drawServixLogo(doc, W - M, top - 2, 22, colors);
  doc.setFontSize(8);
  doc.setTextColor(...INK3);
  doc.text(`${pdfT.generatedOn}: ${todayStr()}`, W - M, top + 34, { align: "right" });

  let y = Math.max(top + 54, top + 29 + info.length * 10.5 + 14);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(reportTitle, M, y);
  doc.setFont("helvetica", "normal");
  if (subtitle) {
    doc.setFontSize(10.5);
    doc.setTextColor(...INK2);
    doc.text(subtitle, M, y + 16);
  }
  doc.setFillColor(...colors.p1);
  doc.roundedRect(M, y + (subtitle ? 26 : 10), 28, 3, 1.5, 1.5, "F");
  return y + (subtitle ? 44 : 28);
}

// Estilo único das tabelas: cabeçalho neutro claro, linhas finas, zebra suave.
// O cabeçalho segue o alinhamento da coluna (números à direita).
function tableStyle(columnStyles = {}) {
  return {
    columnStyles,
    didParseCell: (data) => {
      const cs = columnStyles[data.column.index];
      if (data.section === "head" && cs && cs.halign) data.cell.styles.halign = cs.halign;
    },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: { top: 6, bottom: 6, left: 7, right: 7 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.6 } },
    headStyles: { fillColor: SOFT, textColor: INK2, fontStyle: "bold", fontSize: 8, lineWidth: { bottom: 0.8 }, lineColor: LINE },
    alternateRowStyles: { fillColor: ZEBRA },
    margin: { left: M, right: M, bottom: 50 },
  };
}

// Rodapé em todas as páginas: empresa · relatório à esquerda, "Página X de Y" à direita.
function drawFooters(doc, left, pdfT) {
  const n = doc.internal.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFontSize(7.5);
    doc.setTextColor(...INK3);
    doc.text(String(left || ""), M, H - 22);
    doc.text(pdfT.pageOf ? pdfT.pageOf(i, n) : `${i} / ${n}`, W - M, H - 22, { align: "right" });
  }
}

// Caixa de totais à direita; a última linha (o total que importa) leva o acento.
function buildTotalsBox(doc, startY, totals) {
  const colors = themeColors();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxW = 230;
  const rowH = 18;
  const h = totals.length * rowH + 16;
  let top = startY + 16;
  if (top + h > pageHeight - 50) { doc.addPage(); top = 50; }
  const boxX = pageWidth - M - boxW;
  doc.setFillColor(...SOFT);
  doc.roundedRect(boxX, top, boxW, h, 6, 6, "F");
  doc.setFillColor(...colors.p1);
  doc.rect(boxX, top + 8, 3, h - 16, "F");
  totals.forEach((tItem, i) => {
    const last = i === totals.length - 1 && totals.length > 1;
    const rowY = top + 20 + i * rowH;
    doc.setFont("helvetica", last ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK2);
    doc.text(tItem.label, boxX + 14, rowY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(last ? 12 : 10.5);
    doc.setTextColor(...(last ? colors.p2 : INK));
    doc.text(String(tItem.value), boxX + boxW - 12, rowY, { align: "right" });
  });
  doc.setFont("helvetica", "normal");
  return top + h;
}

// Relatório detalhado por funcionário: Data, Cliente, Horas, Valor/hora, Total
// — igual às colunas já usadas na tela (Data/Cliente/Horas/Valor/Total).
async function exportStaffHorasPdf({ companyName, companyInfo, staffName, periodLabel, entries, clients, totalHours, totalValue, expenses, lang, pdfT, provisional }) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = await buildHeader(doc, {
    companyInfo,
    companyName,
    reportTitle: provisional ? `${pdfT.reportTitleStaff} — ${pdfT.provisionalStamp}` : pdfT.reportTitleStaff,
    subtitle: `${staffName} — ${periodLabel}`,
    pdfT,
  });

  // Spec 6.4: distinguir hora extra já aprovada (soma normal, sem marca) de
  // hora extra ainda por aprovar (marcada com "*" e explicada na legenda) —
  // antes toda hora extra levava "*", aprovada ou não, o que confundia quem
  // lia o PDF já depois de a gerência ter aprovado.
  const hasPendingExtra = entries.some((e) => !e.voided && e.extra && !e.approved);
  const rows = entries
    .filter((e) => !e.voided)
    .map((e) => {
      const c = clientById(clients, e.clientId);
      const valueHour = c ? c.valueHour : 0;
      const pendingMark = e.extra && !e.approved ? "*" : "";
      return [
        shortDate(e.date),
        entryClientName(clients, e),
        `${fmtHoursNum(e.hours)}${pendingMark}`,
        fmtEuro(valueHour),
        fmtEuro(e.hours * valueHour),
      ];
    });

  autoTable(doc, {
    startY,
    head: [[pdfT.colDate, pdfT.colClient, pdfT.colHours, pdfT.colValueHour, pdfT.colTotal]],
    body: rows,
    ...tableStyle({ 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } }),
  });

  let afterTableY = doc.lastAutoTable.finalY;
  if (hasPendingExtra) {
    doc.setFontSize(8.5);
    doc.setTextColor(...INK2);
    doc.text(pdfT.extraPendingLegend, 40, afterTableY + 14);
    afterTableY += 14;
  }
  // Reembolsos (despesas pagas pelo funcionário): tabela à parte; só as
  // aprovadas somam, as ainda por aprovar aparecem marcadas com "†".
  const expenseList = (expenses || []).filter((x) => x.status !== "rejected");
  const totals = [
    { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(totalHours)}h` },
    { label: pdfT.totalValueLabel, value: fmtEuro(totalValue) },
  ];
  if (expenseList.length > 0) {
    const typeName = (ty) => (ty === "fuel" ? pdfT.expTypeFuel : ty === "product" ? pdfT.expTypeProduct : pdfT.expTypeOther);
    const hasPendingExp = expenseList.some((x) => x.status !== "approved");
    const expTotal = expenseList.reduce((s, x) => s + expenseApprovedValue(x), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(pdfT.expensesTitle, 40, afterTableY + 28);
    doc.setFont("helvetica", "normal");
    autoTable(doc, {
      startY: afterTableY + 36,
      head: [[pdfT.colDate, pdfT.colExpenseDesc, pdfT.colExpenseStatus, pdfT.colTotal]],
      body: expenseList.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x) => [
        shortDate(x.date),
        [typeName(x.type), x.description].filter(Boolean).join(" — "),
        x.status === "approved" ? pdfT.expApproved : `${pdfT.expPending} †`,
        x.status === "approved" ? fmtEuro(expenseApprovedValue(x)) : `${fmtEuro(x.amount)} †`,
      ]),
      ...tableStyle({ 3: { halign: "right" } }),
      });
    afterTableY = doc.lastAutoTable.finalY;
    if (hasPendingExp) {
      doc.setFontSize(8.5);
      doc.setTextColor(...INK2);
      doc.text(pdfT.expensePendingLegend, 40, afterTableY + 14);
      afterTableY += 14;
    }
    totals.push({ label: pdfT.expenseTotalLabel, value: fmtEuro(expTotal) });
    totals.push({ label: pdfT.grandTotalLabel, value: fmtEuro(totalValue + expTotal) });
  }
  buildTotalsBox(doc, afterTableY, totals);

  if (provisional) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let pg = 1; pg <= doc.internal.getNumberOfPages(); pg += 1) {
    doc.setPage(pg);
    doc.saveGraphicsState();
    doc.setFontSize(52);
    doc.setTextColor(...AMBER); // cor de "atenção" — nunca confundir com o relatório final
    if (typeof doc.setGState === "function" && doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.16 }));
    }
    doc.text(pdfT.provisionalStamp, pageWidth / 2, pageHeight / 2, { align: "center", angle: 35 });
    doc.restoreGraphicsState();
    }
  }

  drawFooters(doc, `${companyName || ""} · ${pdfT.reportTitleStaff} · ${staffName}`, pdfT);
  const fileSuffix = provisional ? "-provisorio" : "";
  doc.save(`horas-${staffName.replace(/\s+/g, "_")}-${periodLabel.replace(/\s+/g, "_")}${fileSuffix}.pdf`);
}

// Resumo do período inteiro (todos os funcionários): Funcionário, Status,
// Total de horas, Total a pagar — para o botão "Exportar PDF (geral)".
async function exportPeriodSummaryPdf({ companyName, companyInfo, periodLabel, rows, totalHours, totalValue, totalExpenses, pdfT, statusLabels }) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = await buildHeader(doc, {
    companyInfo,
    companyName,
    reportTitle: pdfT.reportTitleGeneral,
    subtitle: periodLabel,
    pdfT,
  });

  const withExpenses = (totalExpenses || 0) > 0;
  const body = rows.map((r) => [
    r.name,
    r.paid ? statusLabels.paid : r.status === "finalizado" ? statusLabels.finished : statusLabels.pending,
    `${fmtHoursNum(r.hours)}h`,
    fmtEuro(r.value),
    ...(withExpenses ? [r.expenses ? fmtEuro(r.expenses) : "-"] : []),
  ]);

  autoTable(doc, {
    startY,
    head: [[pdfT.colStaff, pdfT.colStatus, pdfT.colTotalHours, pdfT.colTotalPay, ...(withExpenses ? [pdfT.colExpenses] : [])]],
    body,
    ...tableStyle({ 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } }),
  });

  const afterTableY = doc.lastAutoTable.finalY;
  buildTotalsBox(doc, afterTableY, [
    { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(totalHours)}h` },
    { label: pdfT.totalValueLabel, value: fmtEuro(totalValue) },
    ...(withExpenses ? [{ label: pdfT.expenseTotalLabel, value: fmtEuro(totalExpenses) }, { label: pdfT.grandTotalLabel, value: fmtEuro(totalValue + totalExpenses) }] : []),
  ]);

  drawFooters(doc, `${companyName || ""} · ${pdfT.reportTitleGeneral} · ${periodLabel}`, pdfT);
  doc.save(`periodo-${periodLabel.replace(/\s+/g, "_")}.pdf`);
}

// Relatório genérico de tabela + caixa de totais — usado pelo Histórico da
// gerência (auditoria de um período já fechado: horas por funcionário +
// contagens de reclamações/elogios/avisos/solicitações daquele período).
async function exportGenericTablePdf({ companyName, companyInfo, reportTitle, subtitle, columns, rows, totals, columnStyles, fileName, pdfT }) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = await buildHeader(doc, { companyName, reportTitle, subtitle, pdfT, companyInfo });

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    ...tableStyle(columnStyles || {}),
  });

  if (totals && totals.length > 0) {
    buildTotalsBox(doc, doc.lastAutoTable.finalY, totals);
  }

  drawFooters(doc, `${companyName || ""} · ${reportTitle}`, pdfT);
  doc.save(fileName);
}

export { exportStaffHorasPdf, exportPeriodSummaryPdf, exportGenericTablePdf };
