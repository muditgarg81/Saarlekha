/**
 * Saarlekha — Export Utilities
 * Generates Excel (.xlsx), PDF, CSV, and TXT files client-side.
 * Per spec: exports download to device, then user shares via native share sheet.
 * Exports NEVER include full Aadhaar numbers (masked only).
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportColumn {
  header: string;
  key: string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;         // e.g. "2024-01-01 to 2024-01-31"
  columns: ExportColumn[];
  rows: Record<string, any>[];
  filename: string;          // without extension
}

// ─── CSV ────────────────────────────────────────────────────────────────────

export function exportCSV(opts: ExportOptions) {
  const header = opts.columns.map(c => `"${c.header}"`).join(',');
  const body = opts.rows.map(row =>
    opts.columns.map(c => {
      const val = row[c.key] ?? '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  const csv = [header, ...body].join('\n');
  trigger(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${opts.filename}.csv`);
}

// ─── TXT ────────────────────────────────────────────────────────────────────

export function exportTXT(opts: ExportOptions) {
  const lines: string[] = [
    opts.title,
    opts.subtitle ?? '',
    '─'.repeat(60),
    opts.columns.map(c => c.header.padEnd(20)).join(' '),
    '─'.repeat(60),
    ...opts.rows.map(row =>
      opts.columns.map(c => String(row[c.key] ?? '').padEnd(20)).join(' ')
    ),
    '─'.repeat(60),
    `Exported: ${new Date().toLocaleString()}`,
  ];
  trigger(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' }), `${opts.filename}.txt`);
}

// ─── Excel (.xlsx) ───────────────────────────────────────────────────────────

export function exportExcel(opts: ExportOptions) {
  const wsData = [
    opts.columns.map(c => c.header),  // header row
    ...opts.rows.map(row => opts.columns.map(c => row[c.key] ?? ''))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row bold (column widths)
  ws['!cols'] = opts.columns.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.title.slice(0, 31)); // sheet name max 31 chars

  // Add a metadata sheet
  const metaData = [
    ['Report', opts.title],
    ['Period', opts.subtitle ?? ''],
    ['Generated', new Date().toLocaleString()],
    ['Platform', 'Saarlekha — Operations Reporting'],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function exportPDF(opts: ExportOptions) {
  const doc = new jsPDF({ orientation: opts.columns.length > 5 ? 'landscape' : 'portrait' });

  // Header block
  doc.setFontSize(16);
  doc.setTextColor(0, 89, 187); // Industrial Blue
  doc.text(opts.title, 14, 18);

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(65, 71, 84); // text-secondary
    doc.text(opts.subtitle, 14, 26);
  }

  doc.setFontSize(8);
  doc.setTextColor(65, 71, 84);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  Saarlekha Operations Reporting`, 14, 32);

  // Table
  autoTable(doc, {
    startY: 38,
    head: [opts.columns.map(c => c.header)],
    body: opts.rows.map(row => opts.columns.map(c => String(row[c.key] ?? ''))),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [0, 89, 187],  // #0059bb
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 249, 255], // #f9f9ff
    },
    columnStyles: Object.fromEntries(
      opts.columns.map((_, i) => [i, { cellWidth: 'auto' }])
    ),
  });

  // Footer on each page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8,
      { align: 'center' }
    );
  }

  doc.save(`${opts.filename}.pdf`);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Shared Export Button Bar ─────────────────────────────────────────────────

import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';

interface ExportBarProps {
  opts: ExportOptions;
  loading?: boolean;
}

export function ExportBar({ opts, loading }: ExportBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) return null;

  const formats = [
    { label: 'Excel', fn: exportExcel, hoverColor: 'hover:bg-green-50 hover:text-green-700' },
    { label: 'PDF',   fn: exportPDF,   hoverColor: 'hover:bg-red-50 hover:text-red-700' },
    { label: 'CSV',   fn: exportCSV,   hoverColor: 'hover:bg-blue-50 hover:text-blue-700' },
    { label: 'TXT',   fn: exportTXT,   hoverColor: 'hover:bg-surface hover:text-text-primary' },
  ] as const;

  const isDisabled = opts.rows.length === 0;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 px-4 py-2 border border-border rounded-md text-sm font-semibold bg-white text-text-primary shadow-sm transition-colors hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed min-w-[110px]"
      >
        <div className="flex items-center gap-1.5">
          <Download className="h-4 w-4 text-text-secondary" />
          <span>Export</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-36 bg-white border border-border rounded-md shadow-lg z-40 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
            {formats.map(({ label, fn, hoverColor }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  fn(opts);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs font-semibold text-text-secondary transition-colors ${hoverColor}`}
              >
                Export as {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
