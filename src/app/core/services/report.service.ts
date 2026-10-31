import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ExportColumn, buildCsv, exportFileName } from '../utils/csv';
import { formatDateTime } from '../utils/format';

/** Opciones de un informe tabulado. */
export interface ReportOptions<T> {
  /** Título del informe (p. ej. "Inventario de productos"). */
  title: string;
  /** Entidad para el nombre del archivo (p. ej. "productos"). */
  entity: string;
  /** Definición de columnas. */
  columns: ExportColumn<T>[];
  /** Filas de datos. */
  rows: readonly T[];
  /** Descripción legible de los filtros aplicados. */
  filters?: string[];
  /** Usuario que genera el informe. */
  author?: string;
  /** Cifras clave que se muestran antes de la tabla. */
  summary?: string[];
  /** Fila de totales opcional (una celda por columna). */
  totals?: string[];
}

/** Colores corporativos del PDF (RGB). */
const BRAND: [number, number, number] = [67, 56, 202];
/** Color de texto principal (RGB). */
const TEXT: [number, number, number] = [15, 23, 42];
/** Color de texto secundario (RGB). */
const MUTED: [number, number, number] = [71, 85, 105];
/** Color de las filas alternas (RGB). */
const ZEBRA: [number, number, number] = [248, 250, 252];

/**
 * Generación y descarga de informes tabulados en CSV y PDF.
 * jsPDF se carga con import dinámico solo cuando el usuario exporta.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly document = inject(DOCUMENT);

  /**
   * Descarga un CSV (RFC 4180, separador `;`, UTF-8 con BOM para Excel).
   * @returns Nombre del archivo generado.
   */
  exportCsv<T>(options: Pick<ReportOptions<T>, 'entity' | 'columns' | 'rows'>): string {
    const content = buildCsv(options.rows, options.columns);
    const fileName = exportFileName(options.entity, 'csv');
    this.download(new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }), fileName);
    return fileName;
  }

  /**
   * Genera y descarga un PDF con cabecera corporativa, filtros aplicados,
   * tabla con filas alternas, totales y numeración "Página X de Y".
   * @returns Nombre del archivo generado.
   */
  async exportPdf<T>(options: ReportOptions<T>): Promise<string> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const landscape = options.columns.length > 5;
    const doc = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Cabecera: logotipo vectorial + nombre de la app
    doc.setFillColor(...BRAND);
    doc.roundedRect(margin, 12, 10, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SP', margin + 5, 18.6, { align: 'center' });
    doc.setTextColor(...TEXT);
    doc.setFontSize(13);
    doc.text('StockPilot', margin + 13, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('Gestión de inventario y pedidos', margin + 13, 21.2);
    doc.text(`Generado: ${formatDateTime(new Date())}`, pageWidth - margin, 17, { align: 'right' });
    if (options.author) {
      doc.text(`Por: ${options.author}`, pageWidth - margin, 21.2, { align: 'right' });
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 26, pageWidth - margin, 26);

    // Título, filtros y resumen
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(options.title, margin, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const filters = options.filters?.length ? options.filters.join(' · ') : 'Sin filtros';
    const filterLines = doc.splitTextToSize(
      `Filtros: ${filters}`,
      pageWidth - margin * 2,
    ) as string[];
    doc.text(filterLines, margin, 42);
    let summaryY = 42 + filterLines.length * 4.2;
    if (options.summary?.length) {
      doc.setTextColor(...TEXT);
      doc.setFont('helvetica', 'bold');
      const summaryLines = doc.splitTextToSize(
        options.summary.join('   ·   '),
        pageWidth - margin * 2,
      ) as string[];
      doc.text(summaryLines, margin, summaryY + 1.5);
      summaryY += summaryLines.length * 4.6 + 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
    }
    doc.text(`${options.rows.length} registros`, margin, summaryY);

    autoTable(doc, {
      startY: summaryY + 4,
      margin: { left: margin, right: margin, bottom: 18 },
      head: [options.columns.map((column) => column.header)],
      body: options.rows.map((row) =>
        options.columns.map((column) => {
          const value = column.value(row);
          return value === null || value === undefined ? '' : String(value);
        }),
      ),
      foot: options.totals ? [options.totals] : undefined,
      showFoot: 'lastPage',
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 2.4,
        textColor: TEXT,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [238, 242, 255], textColor: TEXT, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: Object.fromEntries(
        options.columns.map((column, index) => [index, { halign: column.align ?? 'left' }]),
      ),
    });

    // Pie con numeración en todas las páginas
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text('StockPilot · Datos sintéticos de demostración', margin, pageHeight - 8);
      doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, {
        align: 'right',
      });
    }

    const fileName = exportFileName(options.entity, 'pdf');
    this.download(doc.output('blob'), fileName);
    return fileName;
  }

  /** Dispara la descarga de un Blob en el navegador. */
  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
