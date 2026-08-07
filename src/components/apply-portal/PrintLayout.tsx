import React from 'react';
import type { ApplyCutSheet, CutSheetComponent } from '../../lib/types';
import type { ApplyWizardState } from '../../contexts/ApplyWizardContext';

interface PrintLayoutProps {
  state: ApplyWizardState;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ state }) => {
  const { companyInfo, blanketPo, workOrder, sizeMatrix, cutSheetData } = state;
  const components: CutSheetComponent[] = cutSheetData.sheet_data?.components || [];
  const trims = cutSheetData.sheet_data?.trims;

  return (
    <div className="print-only hidden font-mono text-black text-xs p-8 max-w-4xl mx-auto bg-white">
      {/* Factory Print Header */}
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">
            FORGE &amp; FABRIC — PRODUCTION CUT TICKET
          </h1>
          <p className="text-sm font-bold mt-1">
            CLIENT: {companyInfo.company_name.toUpperCase()} {companyInfo.brand_name ? `(${companyInfo.brand_name.toUpperCase()})` : ''}
          </p>
          <p className="text-xs">
            CONTACT: {companyInfo.contact_name} · {companyInfo.contact_phone || companyInfo.contact_email}
          </p>
        </div>
        <div className="text-right border-2 border-black p-3">
          <p className="text-xs font-bold uppercase">CUT TICKET NO.</p>
          <p className="text-lg font-black">{cutSheetData.cut_number || 'CUT-PROD-01'}</p>
          <p className="text-[10px] mt-1">DATE: {cutSheetData.cut_date || new Date().toISOString().split('T')[0]}</p>
        </div>
      </div>

      {/* Order Parameters */}
      <div className="grid grid-cols-3 gap-4 border-b border-black pb-4 mb-6 text-xs">
        <div>
          <p><strong>STYLE NAME:</strong> {workOrder.style_name.toUpperCase()}</p>
          <p><strong>STYLE CODE:</strong> {workOrder.style_number.toUpperCase()}</p>
          <p><strong>COLORWAY:</strong> {workOrder.colorway.toUpperCase()}</p>
        </div>
        <div>
          <p><strong>WASH RECIPE:</strong> {workOrder.wash_type.toUpperCase()}</p>
          <p><strong>INSEAM:</strong> {workOrder.inseam}</p>
          <p><strong>PRIORITY:</strong> {workOrder.priority.toUpperCase()}</p>
        </div>
        <div>
          <p><strong>TARGET UNITS:</strong> {sizeMatrix.grand_total} PCS</p>
          <p><strong>CONTRACT PERIOD:</strong> {blanketPo.contract_duration.toUpperCase()}</p>
          <p><strong>EX-FACTORY DATE:</strong> {blanketPo.target_delivery_date}</p>
        </div>
      </div>

      {/* Size Matrix Table */}
      <div className="mb-6">
        <h2 className="text-sm font-black uppercase border-b border-black pb-1 mb-2">
          1. SIZE BREAKDOWN &amp; FABRIC MATRIX
        </h2>
        <table className="w-full border-collapse border border-black text-center text-xs">
          <thead>
            <tr className="bg-neutral-200 font-bold border-b border-black">
              <th className="border border-black p-1 text-left">FABRIC</th>
              <th className="border border-black p-1 text-left">COLOR</th>
              {sizeMatrix.size_columns.map((s) => (
                <th key={s} className="border border-black p-1">{s}</th>
              ))}
              <th className="border border-black p-1">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sizeMatrix.fabrics.map((f, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border border-black p-1 text-left font-bold">{f.fabric_name}</td>
                <td className="border border-black p-1 text-left">{f.color}</td>
                {sizeMatrix.size_columns.map((s) => (
                  <td key={s} className="border border-black p-1">{f.size_matrix[s] || 0}</td>
                ))}
                <td className="border border-black p-1 font-bold">{f.line_total}</td>
              </tr>
            ))}
            <tr className="bg-neutral-100 font-black border-t-2 border-black">
              <td className="border border-black p-1 text-left" colSpan={2}>TOTAL UNITS</td>
              {sizeMatrix.size_columns.map((s) => {
                const colSum = sizeMatrix.fabrics.reduce((acc, f) => acc + (f.size_matrix[s] || 0), 0);
                return <td key={s} className="border border-black p-1">{colSum}</td>;
              })}
              <td className="border border-black p-1">{sizeMatrix.grand_total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Component & Yield Details */}
      {components.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-black uppercase border-b border-black pb-1 mb-2">
            2. FABRIC YIELD &amp; SPREAD SPECIFICATIONS
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

      {/* Trims */}
      {trims && (
        <div className="mb-8">
          <h2 className="text-sm font-black uppercase border-b border-black pb-1 mb-2">
            3. TRIMS &amp; HARDWARE
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <p><strong>BUTTONS:</strong> {trims.buttons?.type || 'Standard Brass'}</p>
            <p><strong>RIVETS:</strong> {trims.rivets?.type || 'Copper Burrs'}</p>
            <p><strong>ZIPPER:</strong> {trims.zippers?.type || 'YKK #5'}</p>
            <p><strong>TOPSTITCH THREAD:</strong> {trims.thread_outside || 'Tex 105'}</p>
          </div>
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
