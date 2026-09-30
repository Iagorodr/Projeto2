// Camada "Model": geração de relatórios em PDF de verdade (tabela formatada,
// tipo planilha profissional), substituindo o antigo window.print() que só
// imprimia a tela como estava (com botões, ícones de edição etc.).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { clientById, fmtEuro, fmtHoursNum } from "./utils.js";

const BRAND = [31, 111, 92]; // COLORS.primary
const BRAND_DARK = [20, 63, 53]; // COLORS.primaryDark
const TEXT_SOFT = [91, 105, 97]; // COLORS.textSoft

function shortDate(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return dateStr || "-";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Monta o cabeçalho comum (nome da empresa, título do relatório, subtítulo
// com o período/funcionário) e devolve o doc + o Y onde a tabela deve começar.
function buildHeader(doc, { companyName, reportTitle, subtitle, pdfT }) {
  doc.setFontSize(16);
  doc.setTextColor(...BRAND_DARK);
  doc.text(companyName || "", 40, 42);
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(reportTitle, 40, 62);
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_SOFT);
  doc.text(subtitle, 40, 78);
  doc.text(`${pdfT.generatedOn}: ${todayStr()}`, 40, 92);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1);
  doc.line(40, 100, doc.internal.pageSize.getWidth() - 40, 100);
  return 114;
}

function buildTotalsBox(doc, startY, totals) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxW = 220;
  const boxX = pageWidth - 40 - boxW;
  let y = startY + 22;
  doc.setDrawColor(...BRAND);
  doc.setFillColor(245, 248, 246);
  doc.roundedRect(boxX, y - 14, boxW, totals.length * 18 + 12, 4, 4, "FD");
  totals.forEach((tItem, i) => {
    const rowY = y + i * 18;
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_SOFT);
    doc.text(tItem.label, boxX + 12, rowY);
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_DARK);
    doc.text(String(tItem.value), boxX + boxW - 12, rowY, { align: "right" });
  });
  return y + totals.length * 18 + 12;
}

// Relatório detalhado por funcionário: Data, Cliente, Horas, Valor/hora, Total
// — igual às colunas já usadas na tela (Data/Cliente/Horas/Valor/Total).
function exportStaffHorasPdf({ companyName, staffName, periodLabel, entries, clients, totalHours, totalValue, lang, pdfT }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = buildHeader(doc, {
    companyName,
    reportTitle: pdfT.reportTitleStaff,
    subtitle: `${staffName} — ${periodLabel}`,
    pdfT,
  });

  const rows = entries
    .filter((e) => !e.voided)
    .map((e) => {
      const c = clientById(clients, e.clientId);
      const valueHour = c ? c.valueHour : 0;
      return [
        shortDate(e.date),
        c ? c.name : "—",
        `${fmtHoursNum(e.hours)}${e.extra ? "*" : ""}`,
        fmtEuro(valueHour),
        fmtEuro(e.hours * valueHour),
      ];
    });

  autoTable(doc, {
    startY,
    head: [[pdfT.colDate, pdfT.colClient, pdfT.colHours, pdfT.colValueHour, pdfT.colTotal]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6, textColor: [22, 33, 29] },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const afterTableY = doc.lastAutoTable.finalY;
  buildTotalsBox(doc, afterTableY, [
    { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(totalHours)}h` },
    { label: pdfT.totalValueLabel, value: fmtEuro(totalValue) },
  ]);

  doc.save(`horas-${staffName.replace(/\s+/g, "_")}-${periodLabel.replace(/\s+/g, "_")}.pdf`);
}

// Resumo do período inteiro (todos os funcionários): Funcionário, Status,
// Total de horas, Total a pagar — para o botão "Exportar PDF (geral)".
function exportPeriodSummaryPdf({ companyName, periodLabel, rows, totalHours, totalValue, pdfT, statusLabels }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = buildHeader(doc, {
    companyName,
    reportTitle: pdfT.reportTitleGeneral,
    subtitle: periodLabel,
    pdfT,
  });

  const body = rows.map((r) => [
    r.name,
    r.paid ? statusLabels.paid : r.status === "finalizado" ? statusLabels.finished : statusLabels.pending,
    `${fmtHoursNum(r.hours)}h`,
    fmtEuro(r.value),
  ]);

  autoTable(doc, {
    startY,
    head: [[pdfT.colStaff, pdfT.colStatus, pdfT.colTotalHours, pdfT.colTotalPay]],
    body,
    styles: { fontSize: 9, cellPadding: 6, textColor: [22, 33, 29] },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const afterTableY = doc.lastAutoTable.finalY;
  buildTotalsBox(doc, afterTableY, [
    { label: pdfT.totalHoursLabel, value: `${fmtHoursNum(totalHours)}h` },
    { label: pdfT.totalValueLabel, value: fmtEuro(totalValue) },
  ]);

  doc.save(`periodo-${periodLabel.replace(/\s+/g, "_")}.pdf`);
}

// Relatório genérico de tabela + caixa de totais — usado pelo Histórico da
// gerência (auditoria de um período já fechado: horas por funcionário +
// contagens de reclamações/elogios/avisos/solicitações daquele período).
function exportGenericTablePdf({ companyName, reportTitle, subtitle, columns, rows, totals, columnStyles, fileName, pdfT }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const startY = buildHeader(doc, { companyName, reportTitle, subtitle, pdfT });

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6, textColor: [22, 33, 29] },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    columnStyles: columnStyles || {},
    margin: { left: 40, right: 40 },
  });

  if (totals && totals.length > 0) {
    buildTotalsBox(doc, doc.lastAutoTable.finalY, totals);
  }

  doc.save(fileName);
}

export { exportStaffHorasPdf, exportPeriodSummaryPdf, exportGenericTablePdf };
