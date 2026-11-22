"use client";

import * as React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/client";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  numeric?: boolean;
}
export type ReportRow = Record<string, string | number | null>;

function fileName(title: string, ext: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  return `${slug}-${stamp}.${ext}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButtons({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState<"xlsx" | "pdf" | null>(null);

  async function toExcel() {
    setBusy("xlsx");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "AsePrev";
      const ws = wb.addWorksheet(title.slice(0, 31));
      ws.addRow([title]).font = { bold: true, size: 14 };
      ws.addRow([subtitle]).font = { italic: true, color: { argb: "FF5B6878" } };
      ws.addRow([]);
      const header = ws.addRow(columns.map((c) => c.label));
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      });
      for (const r of rows) ws.addRow(columns.map((c) => (c.numeric && r[c.key] !== null && r[c.key] !== "" ? Number(r[c.key]) : r[c.key] ?? "")));
      columns.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        const longest = Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? "").length));
        col.width = Math.min(Math.max(10, longest + 2), 60);
        if (c.numeric) col.numFmt = "#,##0.##";
      });
      ws.views = [{ state: "frozen", ySplit: 4 }];
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName(title, "xlsx"));
    } catch {
      toast({ tone: "error", message: "No se pudo generar el archivo de Excel." });
    } finally {
      setBusy(null);
    }
  }

  async function toPdf() {
    setBusy("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "letter" });
      doc.setFontSize(14);
      doc.text(title, 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(91, 104, 120);
      doc.text(subtitle, 40, 56);
      autoTable(doc, {
        startY: 70,
        head: [columns.map((c) => c.label)],
        body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [31, 78, 121] },
        columnStyles: Object.fromEntries(columns.map((c, i) => [i, { halign: c.align === "right" || c.numeric ? "right" : "left" }])),
        didDrawPage: () => {
          const h = doc.internal.pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text(`AsePrev · Generado ${new Date().toLocaleString("es-CO")} · Página ${doc.getNumberOfPages()}`, 40, h - 20);
        },
      });
      download(doc.output("blob"), fileName(title, "pdf"));
    } catch {
      toast({ tone: "error", message: "No se pudo generar el PDF." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={toExcel} loading={busy === "xlsx"} disabled={!rows.length || !!busy}>
        <FileSpreadsheet className="h-4 w-4 text-success" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={toPdf} loading={busy === "pdf"} disabled={!rows.length || !!busy}>
        <FileText className="h-4 w-4 text-danger" /> PDF
      </Button>
    </div>
  );
}
