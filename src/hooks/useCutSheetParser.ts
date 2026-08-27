import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { 
  ApplyCutSheet, 
  SheetType, 
  WeissmadeFabricRow,
  CutSheetComponent 
} from '../lib/types';
import type { SizeMatrixData, StyleBlockItem } from '../contexts/ApplyWizardContext';
import { supabase, isRealSupabase } from '../lib/supabase';

// Real, live stage-completion data for one order — see
// supabase/functions/get-cut-sheet-stage-progress/index.ts, the single
// shared source both the customer wizard and merchandiser/admin callers use.
// Never fabricated: a field is null/false when that data genuinely doesn't
// exist yet, not filled with a plausible-looking placeholder.
export interface CutSheetStageProgress {
  in_production: boolean;
  order_received_date: string | null;
  fabric_received: boolean;
  fabric_received_date: string | null;
  pattern_marker_ready: boolean;
  cutting_reached: boolean;
  cutting_date: string | null;
  sewing_reached: boolean;
  sewing_date: string | null;
  laundry_reached: boolean;
  laundry_date: string | null;
  finishing_reached: boolean;
  finishing_date: string | null;
  shipped_reached: boolean;
  shipped_date: string | null;
}

export function emptyStageProgress(): CutSheetStageProgress {
  return {
    in_production: false,
    order_received_date: null,
    fabric_received: false,
    fabric_received_date: null,
    pattern_marker_ready: false,
    cutting_reached: false,
    cutting_date: null,
    sewing_reached: false,
    sewing_date: null,
    laundry_reached: false,
    laundry_date: null,
    finishing_reached: false,
    finishing_date: null,
    shipped_reached: false,
    shipped_date: null,
  };
}

export interface ParsedCutSheetResult {
  detectedType: SheetType;
  styleName?: string;
  styleNumber?: string;
  colorway?: string;
  cutNumber?: string;
  totalQuantity: number;
  fabrics?: WeissmadeFabricRow[];
  components?: CutSheetComponent[];
  rawHeaders: string[];
  rawRows: any[][];
}

export function useCutSheetParser() {
  /**
   * Parse an uploaded .xlsx, .xls, or .csv file and extract size matrix & cut sheet data
   */
  const parseExcelFile = useCallback(async (file: File): Promise<ParsedCutSheetResult> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse as 2D array
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded spreadsheet is empty.');
    }

    // Determine template type based on cell content
    const fullText = JSON.stringify(rawRows).toUpperCase();
    let detectedType: SheetType = 'weissmade_size_matrix';
    
    if (fullText.includes('FACTORY ONE') || fullText.includes('CUT TICKET') || fullText.includes('YARDS USED') || fullText.includes('ESTIMATED YIELD')) {
      detectedType = 'factory_one_production';
    } else if (fullText.includes('SAME') || fullText.includes('SAMPLE REQ') || fullText.includes('SOABAR') || fullText.includes('SPEC INST')) {
      detectedType = 'same_sample_request';
    } else if (fullText.includes('WIESMADE') || fullText.includes('WEISSMADE') || fullText.includes('SALT') || fullText.includes('RIVER')) {
      detectedType = 'weissmade_size_matrix';
    }

    let styleName = 'CUSTOM IMPORT STYLE';
    let styleNumber = 'IMP-001';
    let colorway = 'INDIGO';
    let cutNumber = `CUT-${Date.now().toString().slice(-6)}`;
    let totalQuantity = 0;
    const fabrics: WeissmadeFabricRow[] = [];
    const components: CutSheetComponent[] = [];
    const rawHeaders: string[] = [];

    // Parse Weissmade-style matrix rows
    // Format: Look for row containing size headers (e.g. 28, 29, 30, 31...)
    let sizeHeaderRowIndex = -1;
    let sizeColumns: string[] = [];

    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r].map(c => String(c).trim());
      const numericMatches = row.filter(c => /^(2[0-9]|3[0-9]|4[0-9]|XS|S|M|L|XL|XXL)$/i.test(c));
      if (numericMatches.length >= 3) {
        sizeHeaderRowIndex = r;
        sizeColumns = row.filter(c => /^(2[0-9]|3[0-9]|4[0-9]|XS|S|M|L|XL|XXL)$/i.test(c));
        break;
      }
    }

    if (sizeHeaderRowIndex !== -1 && sizeColumns.length > 0) {
      // Find style name above header
      for (let r = 0; r < sizeHeaderRowIndex; r++) {
        const text = rawRows[r].filter(Boolean).join(' ').trim();
        if (text.length > 3 && !text.includes('WIESMADE') && !text.includes('CUT TICKET')) {
          styleName = text;
          break;
        }
      }

      // Read fabric data rows below header
      for (let r = sizeHeaderRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;
        const firstCell = String(row[0] || '').trim();
        if (!firstCell || firstCell.toUpperCase().includes('TOTAL') || firstCell.toUpperCase().includes('GRAND')) {
          continue;
        }

        const fabricName = firstCell;
        const color = String(row[1] || 'INDIGO').trim();
        const sizeMatrix: Record<string, number> = {};
        let lineTotal = 0;

        sizeColumns.forEach((size, idx) => {
          const val = Number(row[idx + 2]) || 0;
          if (val > 0) {
            sizeMatrix[size] = val;
            lineTotal += val;
          }
        });

        if (lineTotal > 0 || fabricName.length > 0) {
          fabrics.push({
            fabric_name: fabricName,
            color: color || 'PRIMARY',
            size_columns: sizeColumns,
            size_matrix: sizeMatrix,
            line_total: lineTotal,
          });
          totalQuantity += lineTotal;
        }
      }
    }

    // Default fallback if no structured sizes found
    if (fabrics.length === 0) {
      fabrics.push({
        fabric_name: 'PRIMARY FABRIC',
        color: 'INDIGO',
        size_columns: ['28', '30', '32', '34', '36'],
        size_matrix: { '28': 10, '30': 20, '32': 30, '34': 20, '36': 10 },
        line_total: 90,
      });
      totalQuantity = 90;
    }

    return {
      detectedType,
      styleName,
      styleNumber,
      colorway,
      cutNumber,
      totalQuantity,
      fabrics,
      components,
      rawHeaders: rawRows[0] ? rawRows[0].map(String) : [],
      rawRows,
    };
  }, []);

  /**
   * Export Size Matrix Grid directly to .xlsx workbook
   */
  const exportSizeMatrixToExcel = useCallback((matrix: SizeMatrixData, styleName: string = 'Forge & Fabric Industries, Inc. Production') => {
    const wsData: any[][] = [];

    // Title Row
    wsData.push([`FORGE & FABRIC INDUSTRIES, INC. — ${styleName.toUpperCase()}`]);
    wsData.push([`Generated: ${new Date().toLocaleDateString()} · Target Units: ${matrix.grand_total}`]);
    wsData.push([]); // blank

    // Header Row: Fabric, Color, Sizes..., TOTAL
    const headerRow = ['Fabric', 'Color', ...matrix.size_columns, 'TOTAL'];
    wsData.push(headerRow);

    // Data Rows
    matrix.fabrics.forEach(f => {
      const row = [
        f.fabric_name,
        f.color,
        ...matrix.size_columns.map(s => f.size_matrix[s] || 0),
        f.line_total,
      ];
      wsData.push(row);
    });

    // Grand Total Row
    const grandTotals = matrix.size_columns.map(s => {
      return matrix.fabrics.reduce((acc, f) => acc + (f.size_matrix[s] || 0), 0);
    });
    wsData.push(['TOTAL UNITS', '', ...grandTotals, matrix.grand_total]);

    // Create Worksheet & Workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Size Matrix');

    // Trigger download
    const filename = `Forge_Fabric_Size_Matrix_${styleName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, []);

  /**
   * Fetch real, live stage-completion data for one order via the shared
   * edge function — the exact same call both the customer wizard and
   * merchandiser/admin callers make, so a given order's stage-progress
   * section is identical regardless of who's downloading. Never throws:
   * any failure (no reference code yet, network error, function down)
   * degrades to "not yet in production" rather than blocking the download
   * or fabricating data.
   */
  const fetchCutSheetStageProgress = useCallback(async (referenceCode?: string): Promise<CutSheetStageProgress> => {
    if (!referenceCode || !isRealSupabase) return emptyStageProgress();
    try {
      const { data, error } = await supabase.functions.invoke('get-cut-sheet-stage-progress', {
        body: { reference_code: referenceCode },
      });
      if (error || !data || data.error) return emptyStageProgress();
      return data as CutSheetStageProgress;
    } catch {
      return emptyStageProgress();
    }
  }, []);

  /**
   * Export Cut Sheet Ticket to .xlsx — matches the WeisMade reference
   * tracking-sheet structure: one row per StyleBlockItem (Style, Gender,
   * Inseam, per-size quantities, Total, Wash, Comment), a header/tracking
   * group sourced from real live stage-completion data (never fabricated —
   * a stage not yet reached says so, not a blank cell), then the existing
   * fabric-yield/component detail (Lot#/Shade#/Roll#/Spreads/Yield/Balance)
   * preserved as an additional section below, unchanged in content.
   *
   * This is the ONE shared function used by both the customer wizard
   * (CutSheetEditor.tsx) and the merchandiser/admin download
   * (CutSheetManager.tsx) — same styleBlocks shape, same stage-progress
   * shape in, same workbook out, regardless of caller.
   */
  const exportCutSheetToExcel = useCallback((
    styleBlocks: StyleBlockItem[],
    meta: { referenceCode?: string; companyName?: string; cutFor?: string },
    stageProgress?: CutSheetStageProgress,
    legacyCutSheet?: Partial<ApplyCutSheet>
  ) => {
    const wsData: any[][] = [];
    const progress = stageProgress || emptyStageProgress();

    wsData.push(['FORGE & FABRIC INDUSTRIES, INC. — PRODUCTION CUT TICKET & TRACKING SHEET']);
    wsData.push(['Ref:', meta.referenceCode || 'PENDING', 'Client:', meta.companyName || meta.cutFor || '']);
    wsData.push([]);

    // Header/tracking group — real live data, honest "not yet reached" state
    wsData.push(['Order Rcvd', 'Fabric Received', 'Pattern/Marker Ready', 'Cutting', 'Sewing', 'Laundry', 'Finishing', 'Shipped']);
    wsData.push([
      progress.order_received_date || 'Not yet recorded',
      progress.fabric_received ? (progress.fabric_received_date || 'Received') : 'Not yet received',
      progress.pattern_marker_ready ? 'Ready' : 'Not yet ready',
      progress.cutting_reached ? (progress.cutting_date || 'Completed') : 'Not yet reached',
      progress.sewing_reached ? (progress.sewing_date || 'Completed') : 'Not yet reached',
      progress.laundry_reached ? (progress.laundry_date || 'Completed') : 'Not yet reached',
      progress.finishing_reached ? (progress.finishing_date || 'Completed') : 'Not yet reached',
      progress.shipped_reached ? (progress.shipped_date || 'Shipped') : 'Not yet shipped',
    ]);
    wsData.push([]);

    // Style-block lines — union of every block's own size columns as the
    // sheet's size headers, so blocks on different scales (e.g. Mens vs
    // Womens numeric waist) can share one combined sheet.
    const allSizes = Array.from(new Set(styleBlocks.flatMap((b) => b.size_columns || [])));

    wsData.push(['Style', 'Style No', 'Gender', 'Inseam', ...allSizes, 'Total', 'Wash', 'Comment']);
    styleBlocks.forEach((b) => {
      wsData.push([
        b.style_name,
        b.style_number,
        b.gender_category || '',
        b.inseam || '',
        ...allSizes.map((sz) => b.size_matrix?.[sz] || 0),
        b.line_total || 0,
        b.wash_type || '',
        b.comment || '',
      ]);
    });
    wsData.push([
      'GRAND TOTAL', '', '', '',
      ...allSizes.map((sz) => styleBlocks.reduce((sum, b) => sum + (b.size_matrix?.[sz] || 0), 0)),
      styleBlocks.reduce((sum, b) => sum + (b.line_total || 0), 0),
      '',
      '',
    ]);

    // Preserve the existing fabric-yield component detail (Lot#/Shade#/
    // Roll#/Spreads/Est. Yield/Balance) as an additional section — this
    // capability isn't part of the reference sheet but stays available.
    const components = legacyCutSheet?.sheet_data?.components || [];
    if (components.length > 0) {
      wsData.push([]);
      wsData.push(['FABRIC YIELD & SPREAD SPECIFICATIONS']);
      components.forEach((comp, idx) => {
        wsData.push([`COMPONENT ${idx + 1}: ${comp.component_name} (${comp.fabric_code} - ${comp.fabric_desc})`]);
        wsData.push(['Lot#:', comp.lot_number || '', 'Shade:', comp.shade_number || '', 'Roll#:', comp.roll_number || '']);
        wsData.push(['Spreads:', comp.number_of_spreads, 'Est. Yield:', comp.estimated_yield, 'Plies:', comp.plies]);

        const sizes = comp.size_columns || allSizes;
        wsData.push(['Size Breakdown', ...sizes, 'TOTAL UNITS', 'Yds Cut', 'Yds Used', 'Balance']);
        wsData.push([
          'Quantity',
          ...sizes.map((s) => comp.size_matrix[s] || 0),
          comp.total_units,
          comp.yards_cut,
          comp.yards_used || 0,
          comp.yards_balance || 0,
        ]);
        wsData.push([]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cut Sheet');

    const filename = `Forge_Fabric_CutSheet_${meta.referenceCode || 'ORDER'}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, []);

  /**
   * Download a blank pre-formatted Excel template for clients to fill offline
   */
  const downloadBlankTemplate = useCallback((_type?: SheetType) => {
    const wb = XLSX.utils.book_new();

    const rows = [
      ['FORGE & FABRIC INDUSTRIES, INC. — PRODUCTION CUT TICKET & SPEC SHEET'],
      ['Cut For:', 'Client Name', 'Ship To:', 'Receiving Hub'],
      ['Style No:', 'SKU-2026', 'Cut No:', 'CUT-1001'],
      ['Cutter:', 'Cutter Name', 'Spreader:', 'Spreader Name'],
      [],
      ['Fabric Code', 'Fabric Description', 'Lot#', 'Shade#', 'Roll Width', 'Spreads', 'Est Yield (yds/pc)', 'S', 'M', 'L', 'XL', '2XL', 'Total Units', 'Yds Cut'],
      ['SELVEDGE-14OZ', '14oz Cotton Selvedge Denim', 'LOT-01', 'SH-01', '60"', 4, 1.60, 20, 40, 60, 40, 20, 180, 295],
      ['FLEECE-400GSM', '400gsm Heavyweight Cotton Fleece', 'LOT-02', 'SH-02', '58"', 3, 1.40, 15, 30, 45, 30, 15, 135, 195],
      [],
      ['REPEATABLE TRIMS & COMPONENT BOM'],
      ['Trim Category', 'Specification / Detail', 'Qty Per Garment', 'Unit of Measure (UOM)'],
      ['Buttons', 'Shank Brass Donut Buttons', 5, 'pieces'],
      ['Zippers', 'YKK #5 Antique Brass Zipper', 1, 'pieces'],
      ['Drawstrings', 'Flat Woven Cotton Cord w/ Aglets', 1, 'sets'],
      ['Labels / Tags', 'Main Woven Brand Neck Label', 1, 'pieces'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Production Cut Ticket');
    XLSX.writeFile(wb, 'Forge_Fabric_Production_Cut_Ticket_Template.xlsx');
  }, []);

  return {
    parseExcelFile,
    exportSizeMatrixToExcel,
    exportCutSheetToExcel,
    fetchCutSheetStageProgress,
    downloadBlankTemplate,
  };
}
