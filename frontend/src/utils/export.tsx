/**
 * Saarlekha — Export Utilities
 * Generates Excel (.xlsx), PDF, CSV, and TXT files client-side.
 * Per spec: exports download to device, then user shares via native share sheet.
 * Exports NEVER include full Aadhaar numbers (masked only).
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

export async function exportCSV(opts: ExportOptions) {
  const header = opts.columns.map(c => `"${c.header}"`).join(',');
  const body = opts.rows.map(row =>
    opts.columns.map(c => {
      const val = row[c.key] ?? '';
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  const csv = [header, ...body].join('\n');
  await saveAndShare(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${opts.filename}.csv`);
}

// ─── TXT ────────────────────────────────────────────────────────────────────

export async function exportTXT(opts: ExportOptions) {
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
  await saveAndShare(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' }), `${opts.filename}.txt`);
}

// ─── Excel (.xlsx) ───────────────────────────────────────────────────────────

export async function exportExcel(opts: ExportOptions) {
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
    ['Platform', 'SaarLekha - Operations Reporting'],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveAndShare(blob, `${opts.filename}.xlsx`);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function exportPDF(opts: ExportOptions) {
  const colCount = opts.columns.length;
  
  let orientation: 'portrait' | 'landscape' = 'portrait';
  let format = 'a4';
  let fontSize = 9;
  let cellPadding = 3;
  let titleSize = 16;
  let subSize = 10;
  let metaSize = 8;
  let titleY = 18;
  let subY = 26;
  let metaY = 32;
  let startY = 38;

  if (colCount > 5) {
    orientation = 'landscape';
    if (colCount > 15) {
      format = 'a1';
      fontSize = 6.5;
      cellPadding = 1.5;
      titleSize = 28;
      subSize = 16;
      metaSize = 11;
      titleY = 36;
      subY = 54;
      metaY = 68;
      startY = 80;
    } else if (colCount > 11) {
      format = 'a2';
      fontSize = 7.5;
      cellPadding = 2;
      titleSize = 24;
      subSize = 14;
      metaSize = 10;
      titleY = 28;
      subY = 42;
      metaY = 52;
      startY = 62;
    } else if (colCount > 7) {
      format = 'a3';
      fontSize = 8.5;
      cellPadding = 2.5;
      titleSize = 20;
      subSize = 12;
      metaSize = 9;
      titleY = 22;
      subY = 32;
      metaY = 40;
      startY = 48;
    }
  }

  const doc = new jsPDF({ orientation, format });

  // Header block
  doc.setFontSize(titleSize);
  doc.setTextColor(0, 89, 187); // Industrial Blue
  doc.text(opts.title, 14, titleY);

  if (opts.subtitle) {
    doc.setFontSize(subSize);
    doc.setTextColor(65, 71, 84); // text-secondary
    doc.text(opts.subtitle, 14, subY);
  }

  doc.setFontSize(metaSize);
  doc.setTextColor(65, 71, 84);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  SaarLekha - Operations Reporting`, 14, metaY);

  // Table
  autoTable(doc, {
    startY: startY,
    head: [opts.columns.map(c => c.header)],
    body: opts.rows.map(row => opts.columns.map(c => String(row[c.key] ?? ''))),
    styles: {
      fontSize: fontSize,
      cellPadding: cellPadding,
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

  const blob = doc.output('blob');
  await saveAndShare(blob, `${opts.filename}.pdf`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.substring(result.indexOf(',') + 1);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveAndShare(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: `Share ${filename}`,
        url: result.uri,
      });
    } catch (err) {
      console.error('Error during native save/share:', err);
      trigger(blob, filename);
    }
  } else {
    trigger(blob, filename);
  }
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
                onClick={async () => {
                  setIsOpen(false);
                  try {
                    await fn(opts);
                  } catch (e) {
                    console.error(`Export failed for format ${label}:`, e);
                  }
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
