import React from 'react';
import type { ApplyCutSheet, CutSheetComponent } from '../../lib/types';
import type { StyleBlockItem } from '../../contexts/ApplyWizardContext';
import { emptyStageProgress, type CutSheetStageProgress } from '../../hooks/useCutSheetParser';

export interface PrintLayoutProps {
  companyName: string;
  brandName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  /** e.g. "new_order", "sample_request" — displayed as-is, uppercased. */
  orderType?: string;
  referenceCode?: string | null;
  /** Blanket PO contract terms — only present for a Bulk PO order; omitted (renders "N/A") for a merchandiser-created order or sample with no contract of its own. */
  contractQuantity?: number;
  contractDuration?: string;
  targetDeliveryDate?: string;
  /** The order's real, complete multi-style-block spec — the single source of truth for size matrix + trims BOM, identical on the customer wizard and the merchandiser's Cut Sheet Editor. */
  styleBlocks: StyleBlockItem[];
  cutSheetData: Partial<ApplyCutSheet>;
  /** Real, live stage-completion data — same source the .xlsx export uses.
   * Optional so PrintLayout still renders (with an honest "not yet in
   * production" state) if a caller doesn't fetch it. */
  stageProgress?: CutSheetStageProgress;
  /** Pricing & Rates engine — Phase D: the exact itemized breakdown a price
   * quote was issued with. Optional — a plain cut ticket (no quote
   * involved) simply omits this and the section doesn't render. Reused
   * as-is by PricingQuoteModal.tsx's "Print Quote" action and by
   * finance.tsx's invoice view, rather than building a second print
   * pathway for pricing documents. */
  pricingBreakdown?: {
    isSample: boolean;
    baseCmtCost: number;
    washCost: number;
    trimsCost: number;
    marginPercent: number;
    subtotalWithMargin: number;
    rushMultiplier?: number | null;
    customerDiscountPercent?: number | null;
    finalUnitPrice: number;
    quantity: number;
    totalContractValue: number;
    quoteNumber?: string;
    quoteStatus?: string;
  };
}

/**
 * The one universal, factory-floor Production Cut Ticket — rendered
 * identically whether the order came in through the public/customer intake
 * wizard (CutSheetEditor.tsx) or was created/edited by a merchandiser
 * (CutSheetManager.tsx). Only visible via the .print-only / @media print
 * rule in styles.css; window.print() on the page hosting this swaps the
 * on-screen app chrome out for this document.
 */
export const PrintLayout: React.FC<PrintLayoutProps> = ({
  companyName,
  brandName,
  contactName,
  contactPhone,
  contactEmail,
  orderType,
  referenceCode,
  contractQuantity,
  contractDuration,
  targetDeliveryDate,
  styleBlocks,
  cutSheetData,
  stageProgress,
  pricingBreakdown: pb,
}) => {
  const progress = stageProgress || emptyStageProgress();
  const components: CutSheetComponent[] = cutSheetData.sheet_data?.components || [];

  return (
    <div className="print-only hidden font-mono text-black text-xs p-8 max-w-4xl mx-auto bg-white">
      {/* Factory Print Header */}
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">
            FORGE &amp; FABRIC INDUSTRIES, INC. — PRODUCTION CUT TICKET
          </h1>
          <p className="text-sm font-bold mt-1">
            CLIENT: {companyName.toUpperCase()} {brandName ? `(${brandName.toUpperCase()})` : ''}
          </p>
          <p className="text-xs">
            CONTACT: {contactName || 'N/A'} · {contactPhone || contactEmail || 'N/A'}
          </p>
        </div>
        <div className="text-right border-2 border-black p-3">
          <p className="text-xs font-bold uppercase">CUT TICKET NO.</p>
          <p className="text-lg font-black">{cutSheetData.cut_number || 'CUT-PROD-01'}</p>
          <p className="text-[10px] mt-1">DATE: {cutSheetData.cut_date || new Date().toISOString().split('T')[0]}</p>
        </div>
      </div>

      {/* Contract & Order Summary */}
      <div className="grid grid-cols-3 gap-4 border-b border-black pb-4 mb-6 text-xs">
        <div>
          <p><strong>TOTAL STYLES:</strong> {styleBlocks.length} STYLE BLOCKS</p>
          <p><strong>CONTRACT UNITS:</strong> {contractQuantity != null ? `${contractQuantity} PCS` : 'N/A'}</p>
        </div>
        <div>
          <p><strong>CONTRACT PERIOD:</strong> {contractDuration ? contractDuration.toUpperCase() : 'N/A'}</p>
          <p><strong>ORDER TYPE:</strong> {orderType ? orderType.toUpperCase().replace(/_/g, ' ') : 'N/A'}</p>
        </div>
        <div>
          <p><strong>EX-FACTORY DATE:</strong> {targetDeliveryDate || 'N/A'}</p>
          <p><strong>REF CODE:</strong> {referenceCode || 'PENDING'}</p>
        </div>
      </div>

      {/* Pricing & Rates: itemized quote breakdown — only rendered when the
          caller (PricingQuoteModal.tsx / finance.tsx) supplies it. */}
      {pb && (
        <div className="mb-6 border-2 border-black p-4">
          <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
            <h2 className="text-base font-black uppercase">
              {pb.isSample ? 'SAMPLE PRICE QUOTE' : 'PRICE QUOTE'} BREAKDOWN
            </h2>
            <span className="text-xs font-bold border border-black px-2 py-0.5">
              {pb.quoteNumber || 'DRAFT'} {pb.quoteStatus ? `· ${pb.quoteStatus.toUpperCase().replace(/_/g, ' ')}` : ''}
            </span>
          </div>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {pb.isSample ? (
                <tr>
                  <td className="py-1">Sample Unit Price</td>
                  <td className="py-1 text-right font-mono font-bold">${pb.finalUnitPrice.toFixed(2)} / pc</td>
                </tr>
              ) : (
                <>
                  <tr><td className="py-1">Base CMT Labor</td><td className="py-1 text-right font-mono">${pb.baseCmtCost.toFixed(2)} / pc</td></tr>
                  <tr><td className="py-1">Washing Surcharge</td><td className="py-1 text-right font-mono">${pb.washCost.toFixed(2)} / pc</td></tr>
                  <tr><td className="py-1">Trims &amp; Packaging Labor</td><td className="py-1 text-right font-mono">${pb.trimsCost.toFixed(2)} / pc</td></tr>
                  <tr className="border-t border-black font-bold"><td className="py-1">Subtotal + Margin ({pb.marginPercent.toFixed(1)}%)</td><td className="py-1 text-right font-mono">${pb.subtotalWithMargin.toFixed(2)} / pc</td></tr>
                  {pb.rushMultiplier != null && (
                    <tr><td className="py-1">Rush Multiplier Applied</td><td className="py-1 text-right font-mono">×{pb.rushMultiplier.toFixed(2)}</td></tr>
                  )}
                  {pb.customerDiscountPercent != null && (
                    <tr><td className="py-1">Customer Discount Applied</td><td className="py-1 text-right font-mono">−{pb.customerDiscountPercent.toFixed(1)}%</td></tr>
                  )}
                </>
              )}
              <tr className="border-t-2 border-black font-black text-sm">
                <td className="py-1.5">FINAL UNIT PRICE</td>
                <td className="py-1.5 text-right font-mono">${pb.finalUnitPrice.toFixed(2)} / pc</td>
              </tr>
              <tr>
                <td className="py-1">Total Quantity</td>
                <td className="py-1 text-right font-mono">{pb.quantity.toLocaleString()} pcs</td>
              </tr>
              <tr className="font-black text-sm">
                <td className="py-1.5">TOTAL CONTRACT VALUE</td>
                <td className="py-1.5 text-right font-mono">${pb.totalContractValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Stage Tracking Group — real live data, never a blank cell implying
          manual entry is expected. */}
      <div className="mb-6">
        <p className="font-bold text-xs uppercase mb-1">PRODUCTION STAGE TRACKING</p>
        <table className="w-full border-collapse border border-black text-center text-[10px]">
          <thead>
            <tr className="bg-neutral-200 font-bold border-b border-black">
              <th className="border border-black p-1">ORDER RCVD</th>
              <th className="border border-black p-1">FABRIC RECEIVED</th>
              <th className="border border-black p-1">PATTERN/MARKER</th>
              <th className="border border-black p-1">CUTTING</th>
              <th className="border border-black p-1">SEWING</th>
              <th className="border border-black p-1">LAUNDRY</th>
              <th className="border border-black p-1">FINISHING</th>
              <th className="border border-black p-1">SHIPPED</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1 font-mono">{progress.order_received_date || 'Not yet recorded'}</td>
              <td className="border border-black p-1 font-mono">{progress.fabric_received ? (progress.fabric_received_date || 'Received') : 'Not yet received'}</td>
              <td className="border border-black p-1 font-mono">{progress.pattern_marker_ready ? 'Ready' : 'Not yet ready'}</td>
              <td className="border border-black p-1 font-mono">{progress.cutting_reached ? (progress.cutting_date || 'Completed') : 'Not yet reached'}</td>
              <td className="border border-black p-1 font-mono">{progress.sewing_reached ? (progress.sewing_date || 'Completed') : 'Not yet reached'}</td>
              <td className="border border-black p-1 font-mono">{progress.laundry_reached ? (progress.laundry_date || 'Completed') : 'Not yet reached'}</td>
              <td className="border border-black p-1 font-mono">{progress.finishing_reached ? (progress.finishing_date || 'Completed') : 'Not yet reached'}</td>
              <td className="border border-black p-1 font-mono">{progress.shipped_reached ? (progress.shipped_date || 'Shipped') : 'Not yet shipped'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Render each Style Block in Cut Ticket */}
      {styleBlocks.length === 0 ? (
        <div className="border-2 border-black p-4 mb-8 text-center text-neutral-600">
          No style block data on file for this order yet.
        </div>
      ) : (
        styleBlocks.map((block, sbIdx) => (
          <div key={block.id || sbIdx} className="mb-8 border-2 border-black p-4 page-break-inside-avoid">
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
              <h2 className="text-base font-black uppercase">
                STYLE BLOCK #{sbIdx + 1}: {block.style_name.toUpperCase()}
              </h2>
              <span className="text-xs font-bold border border-black px-2 py-0.5">
                {block.product_type} ({block.fabric_type}) · {block.line_total} PCS
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2 text-[11px]">
              <p><strong>STYLE SKU:</strong> {block.style_number}</p>
              <p><strong>COLORWAY:</strong> {block.colorway}</p>
              <p><strong>WASH / FINISH:</strong> {block.wash_type}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 text-[11px]">
              <p><strong>GENDER:</strong> {(block as any).gender_category || 'N/A'}</p>
              <p><strong>INSEAM:</strong> {(block as any).inseam || 'N/A'}</p>
              <p><strong>COMMENT:</strong> {(block as any).comment || '—'}</p>
            </div>

            {/* Size Breakdown */}
            <div className="mb-4">
              <p className="font-bold text-xs uppercase mb-1">1. SIZE MATRIX BREAKDOWN</p>
              <table className="w-full border-collapse border border-black text-center text-xs">
                <thead>
                  <tr className="bg-neutral-200 font-bold border-b border-black">
                    {block.size_columns.map((sz) => (
                      <th key={sz} className="border border-black p-1">{sz}</th>
                    ))}
                    <th className="border border-black p-1 bg-neutral-300">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {block.size_columns.map((sz) => (
                      <td key={sz} className="border border-black p-1 font-mono">
                        {block.size_matrix[sz] || 0}
                      </td>
                    ))}
                    <td className="border border-black p-1 font-bold font-mono bg-neutral-100">
                      {block.line_total}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Trims BOM */}
            {block.trims_bom && block.trims_bom.length > 0 && (
              <div>
                <p className="font-bold text-xs uppercase mb-1">2. TRIMS &amp; COMPONENT BOM</p>
                <table className="w-full border-collapse border border-black text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100 font-bold border-b border-black">
                      <th className="border border-black p-1 w-1/4">TRIM TYPE</th>
                      <th className="border border-black p-1 w-1/2">SPECIFICATION / DETAIL</th>
                      <th className="border border-black p-1 w-1/4 text-right">QTY / GARMENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.trims_bom.map((trim) => (
                      <tr key={trim.id} className="border-b border-black">
                        <td className="border border-black p-1 font-bold">{trim.trim_type}</td>
                        <td className="border border-black p-1">{trim.specification || 'Standard Spec'}</td>
                        <td className="border border-black p-1 text-right font-mono font-bold">
                          {trim.qty_per_garment} {trim.uom}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {/* Component & Yield Details */}
      {components.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-black uppercase border-b border-black pb-1 mb-2">
            FABRIC YIELD &amp; SPREAD SPECIFICATIONS
          </h2>
          {components.map((comp, idx) => (
            <div key={idx} className="border border-black p-3 mb-3 text-xs">
              <div className="flex justify-between font-bold pb-2 border-b border-neutral-400 mb-2">
                <span>COMPONENT {idx + 1}: {comp.component_name} ({comp.fabric_code})</span>
                <span>LOT: {comp.lot_number || 'N/A'} · SHADE: {comp.shade_number || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <p>SPREADS: {comp.number_of_spreads}</p>
                <p>EST. YIELD: {comp.estimated_yield} yds/pc</p>
                <p>YDS CUT: {comp.yards_cut} yds</p>
                <p>YDS USED: {comp.yards_used} yds</p>
                <p>DAMAGE: {comp.yards_damaged} yds ({comp.damage_percent}%)</p>
                <p>SHORT: {comp.yards_short} yds ({comp.short_percent}%)</p>
                <p className="font-bold col-span-2">BALANCE YARDAGE: {comp.yards_balance} yds</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Factory Floor Verification Signatures */}
      <div className="border-t-2 border-black pt-4 grid grid-cols-3 gap-8 text-xs">
        <div>
          <p className="font-bold mb-8">CUTTER SIGNATURE:</p>
          <div className="border-b border-black w-full" />
          <p className="text-[10px] text-neutral-600 mt-1">Name: {cutSheetData.cutter_name || 'Production Line #1'}</p>
        </div>
        <div>
          <p className="font-bold mb-8">SPREADER SIGNATURE:</p>
          <div className="border-b border-black w-full" />
          <p className="text-[10px] text-neutral-600 mt-1">Name: {cutSheetData.spreader_name || 'Spreader Operator'}</p>
        </div>
        <div>
          <p className="font-bold mb-8">QC VERIFIED BY:</p>
          <div className="border-b border-black w-full" />
          <p className="text-[10px] text-neutral-600 mt-1">Lead Quality Assurance Inspector</p>
        </div>
      </div>
    </div>
  );
};
