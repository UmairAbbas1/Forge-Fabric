import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { 
  ApplyCutSheet, 
  SheetType, 
  WeissmadeFabricRow,
  CutSheetComponent 
} from '../lib/types';
import type { SizeMatrixData } from '../contexts/ApplyWizardContext';

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
  const exportSizeMatrixToExcel = useCallback((matrix: SizeMatrixData, styleName: string = 'Forge & Fabric Production') => {
    const wsData: any[][] = [];

    // Title Row
    wsData.push([`FORGE & FABRIC — ${styleName.toUpperCase()}`]);
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
   * Export Cut Sheet Ticket to .xlsx matching Factory One specifications
   */
  const exportCutSheetToExcel = useCallback((cutSheet: Partial<ApplyCutSheet>) => {
    const wsData: any[][] = [];
    const sheetData = cutSheet.sheet_data || {};
    const components = sheetData.components || [];

    wsData.push(['FACTORY ONE PRODUCTION CUT TICKET']);
    wsData.push(['Cut For:', cutSheet.sheet_name || 'Forge & Fabric', 'Ship To:', 'Distribution Hub (Petaluma)']);
    wsData.push(['Style No:', cutSheet.style_number || 'WSM-01', 'Cut No:', cutSheet.cut_number || 'CUT-01']);
    wsData.push(['Cut Date:', cutSheet.cut_date || new Date().toISOString().split('T')[0], 'Wash:', cutSheet.wash_type || 'Rigid']);
    wsData.push(['Cutter:', cutSheet.cutter_name || 'Floor 1', 'Spreader:', cutSheet.spreader_name || 'Spreader A']);
    wsData.push([]); // blank

    components.forEach((comp, idx) => {
      wsData.push([`COMPONENT ${idx + 1}: ${comp.component_name} (${comp.fabric_code} - ${comp.fabric_desc})`]);
      wsData.push(['Lot#:', comp.lot_number || '', 'Shade:', comp.shade_number || '', 'Roll#:', comp.roll_number || '']);
      wsData.push(['Spreads:', comp.number_of_spreads, 'Est. Yield:', comp.estimated_yield, 'Plies:', comp.plies]);
      
      const sizes = comp.size_columns || ['28', '30', '32', '34', '36'];
      wsData.push(['Size Breakdown', ...sizes, 'TOTAL UNITS', 'Yds Cut', 'Yds Used', 'Balance']);
      wsData.push([
        'Quantity',
        ...sizes.map(s => comp.size_matrix[s] || 0),
        comp.total_units,
        comp.yards_cut,
        comp.yards_used || 0,
        comp.yards_balance || 0,
      ]);
      wsData.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cut Ticket');

    const filename = `Forge_Fabric_CutTicket_${cutSheet.cut_number || 'CUT'}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, []);

  /**
   * Download a blank pre-formatted Excel template for clients to fill offline
   */
  const downloadBlankTemplate = useCallback((_type?: SheetType) => {
    const wb = XLSX.utils.book_new();

    const rows = [
      ['FORGE & FABRIC — PRODUCTION CUT TICKET & SPEC SHEET'],
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
    downloadBlankTemplate,
  };
}
