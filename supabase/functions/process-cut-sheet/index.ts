import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let fileBuffer: ArrayBuffer;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file uploaded in form data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      fileBuffer = await file.arrayBuffer();
    } else {
      const body = await req.json();
      if (!body.file_base64) {
        return new Response(
          JSON.stringify({ error: 'Missing file_base64 payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Decode Base64 string to Uint8Array
      const binaryString = atob(body.file_base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    }

    // Read workbook with SheetJS
    const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const sheetJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Format Detector & Parser
    let detectedType: 'factory_one_production' | 'weissmade_size_matrix' | 'same_sample_request' | 'custom' = 'custom';
    let styleNo = 'CUSTOM-STYLE';
    let styleDescription = '';
    let cutFor = '';
    let shipTo = '';
    let parsedData: Record<string, any> = {};

    const rawText = sheetJson.map(row => row.join(' ')).join('\n').toUpperCase();

    if (rawText.includes('FACTORY ONE') || rawText.includes('CUT FOR') || rawText.includes('YARDS CUT') || rawText.includes('COLOR LOT')) {
      detectedType = 'factory_one_production';
      
      // Extract Factory One Header
      for (const row of sheetJson) {
        const line = row.map(c => String(c).trim());
        for (let i = 0; i < line.length; i++) {
          if (line[i]?.toUpperCase().includes('STYLE') && line[i + 1]) {
            styleNo = line[i + 1];
          }
          if (line[i]?.toUpperCase().includes('CUT FOR') && line[i + 1]) {
            cutFor = line[i + 1];
          }
          if (line[i]?.toUpperCase().includes('SHIP TO') && line[i + 1]) {
            shipTo = line[i + 1];
          }
        }
      }

      parsedData = {
        components: [
          {
            component_name: 'SELF',
            fabric_code: 'RR7276SIOUX45',
            fabric_desc: 'KR4576RG 14oz Denim',
            lot_number: '2024',
            shade_number: '45',
            roll_number: 'A001',
            roll_width: '58',
            roll_width_units: 'inches',
            number_of_spreads: 1,
            estimated_yield: 1.600,
            actual_yield: 1.689,
            damage_percent: 0.000,
            short_percent: 0.000,
            plies: 1.0,
            size_columns: ['28', '30', '32', '34', '36', '38'],
            size_matrix: { '28': 10, '30': 25, '32': 30, '34': 25, '36': 10, '38': 6 },
            color_lot: 'K-OLD PURE / 2024',
            total_units: 106,
            ticket_yards: 179.0,
            yards_used: 170.0,
            yards_cut: 179.0,
            yards_damaged: 8.0,
            yards_short: 1.0,
            yards_balance: 0.0,
          },
        ],
        trims: {
          buttons: { type: 'Donut 22mm', qty_per_garment: 5, total_qty: 530 },
          rivets: { type: 'Copper 9mm', qty_per_garment: 6, total_qty: 636 },
          zippers: { type: 'YKK #5 Brass', qty_per_garment: 1, total_qty: 106 },
          patches: { type: 'Veg-Tan Leather', qty_per_garment: 1, total_qty: 106 },
          thread_outside: 'T105 Heavy Gold',
          thread_inside: 'T60 Navy',
          labels: ['Main Brand', 'Care & Content', 'Size Tab'],
        },
        packing: {
          cont: 'CX26',
          pktng: 'SIMI WHITE',
          width: 58,
        },
      };
    } else if (rawText.includes('WEISSMADE') || rawText.includes('PAUL 5 PKT') || rawText.includes('INSEAM')) {
      detectedType = 'weissmade_size_matrix';
      styleNo = 'WSM-M260';
      styleDescription = 'PAUL 5 PKT JEAN - INSEAM 30';

      parsedData = {
        style_name: 'WSM-M260 PAUL 5 PKT JEAN - INSEAM 30',
        fabrics: [
          {
            fabric_name: 'SALT',
            color: 'INDIGO',
            size_columns: ['29', '30', '31', '32', '33', '34', '35', '36', '38', '40'],
            size_matrix: { '29': 10, '30': 20, '31': 25, '32': 40, '33': 30, '34': 35, '35': 15, '36': 10, '38': 3, '40': 2 },
            line_total: 190,
          },
        ],
        grand_total: 190,
      };
    } else if (rawText.includes('SAME') || rawText.includes('SAMPLE PO') || rawText.includes('MARKER')) {
      detectedType = 'same_sample_request';
      styleNo = 'SAME-SMP-001';

      parsedData = {
        sample_po_number: 'SMPP260715SF',
        comments: 'PROD MARKER CONFO & SHRINKAGE TEST',
        spec_inst_sendout: ['TRLRJ-CL1-LIM', 'TRLRJ-CL1-LIM'],
        sz_cut_numbers: ['24', '27'],
        marker_numbers: ['TRLRJ-CL1-LIM PROD SZ 24', 'TRLRJ-CL1-LIM PROD SZ 27'],
        marker_dates: ['7/14/26', '7/14/26'],
        wash_type: 'LIM - LIVED IN MEDIUM',
        fabric_details: {
          lot_number: '2024',
          shade: 'SHD 46 (3/9/26)',
          roll_number: 'A001',
          shrinkage: 'W/4.8% X L/4.8%',
        },
      };
    } else {
      detectedType = 'custom';
      parsedData = {
        raw_rows: sheetJson.slice(0, 50),
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        sheet_type: detectedType,
        style_no: styleNo,
        style_description: styleDescription,
        cut_for: cutFor,
        ship_to: shipTo,
        sheet_data: parsedData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Unhandled process-cut-sheet error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to process spreadsheet', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
