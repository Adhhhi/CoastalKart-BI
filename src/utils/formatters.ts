import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function formatINR(value: number | null | undefined, compact = false): string {
  const num = Number(value || 0);
  if (compact) {
    if (Math.abs(num) >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(num) >= 100000) {
      return `₹${(num / 100000).toFixed(2)} L`;
    }
    if (Math.abs(num) >= 1000) {
      return `₹${(num / 1000).toFixed(1)} K`;
    }
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatINRDecimal(value: number | null | undefined): string {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

export function formatDateDDMMYYYY(iso: string): string {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function exportToCSV(filename: string, rows: Record<string, any>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename: string, sheetName: string, rows: Record<string, any>[]): void {
  if (!rows.length) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportMultiSheetExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, any>[] }[]
): void {
  const workbook = XLSX.utils.book_new();
  let added = 0;
  for (const s of sheets) {
    if (!s.rows || s.rows.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(workbook, ws, s.name.slice(0, 31));
    added++;
  }
  if (added > 0) {
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }
}

export function exportToPDF(
  filename: string,
  reportTitle: string,
  subtitle: string,
  rows: Record<string, any>[],
  kpis?: { label: string; value: string }[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFillColor(15, 41, 66);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(`CoastalKart Retail & E-commerce Pvt. Ltd. — ${reportTitle}`, 32, 30);
  doc.setFontSize(9);
  doc.text(`${subtitle} | Simulated BI Case Study Report | Generated ${new Date().toLocaleDateString('en-GB')}`, 32, 48);

  let startY = 84;
  if (kpis && kpis.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    const kpiSummary = kpis.map((k) => `${k.label}: ${k.value}`).join('   |   ');
    doc.text(kpiSummary, 32, startY);
    startY += 20;
  }

  if (rows.length > 0) {
    const columns = Object.keys(rows[0]).slice(0, 9);
    const body = rows.slice(0, 45).map((r) => columns.map((c) => String(r[c] ?? '')));
    autoTable(doc, {
      startY,
      head: [columns.map((c) => c.replace(/_/g, ' ').toUpperCase())],
      body,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  doc.save(`${filename}.pdf`);
}
