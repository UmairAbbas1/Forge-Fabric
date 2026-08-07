import React, { useRef, useCallback } from 'react';

export interface GridColumn {
  key: string;
  header: string;
  width?: string;
  type?: 'text' | 'number' | 'readonly';
  align?: 'left' | 'center' | 'right';
}

interface SpreadsheetGridProps {
  columns: GridColumn[];
  rows: Record<string, any>[];
  onChangeRow: (rowIndex: number, columnKey: string, value: any) => void;
  onPasteBlock?: (startRow: number, startColKey: string, pastedData: string[][]) => void;
  stickyFirstColumn?: boolean;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  columns,
  rows,
  onChangeRow,
  onPasteBlock,
  stickyFirstColumn = true,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);

  // Handle cell navigation with Arrow Keys, Tab, Enter
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key);
    if (!isArrow) return;

    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === 'ArrowUp') {
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = Math.min(rows.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      targetCol = Math.max(0, colIndex - 1);
    } else if (e.key === 'ArrowRight' && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
      targetCol = Math.min(columns.length - 1, colIndex + 1);
    } else {
      return;
    }

    if (targetRow !== rowIndex || targetCol !== colIndex) {
      e.preventDefault();
      const targetInput = tableRef.current?.querySelector<HTMLInputElement>(
        `input[data-row="${targetRow}"][data-col="${targetCol}"]`
      );
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    }
  };

  // Handle clipboard paste from Excel TSV
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startColIndex: number
  ) => {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;

    e.preventDefault();
    const parsedRows = text
      .split(/\r\n|\n|\r/)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split('\t'));

    if (onPasteBlock) {
      onPasteBlock(startRow, columns[startColIndex].key, parsedRows);
    } else {
      // Fallback row-by-row setter
      parsedRows.forEach((pRow, rOffset) => {
        const rIdx = startRow + rOffset;
        if (rIdx >= rows.length) return;

        pRow.forEach((val, cOffset) => {
          const cIdx = startColIndex + cOffset;
          if (cIdx >= columns.length) return;

          const col = columns[cIdx];
          if (col.type !== 'readonly') {
            const formattedVal = col.type === 'number' ? parseFloat(val) || 0 : val;
            onChangeRow(rIdx, col.key, formattedVal);
          }
        });
      });
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-300 bg-white shadow-2xs">
      <table ref={tableRef} className="w-full text-xs text-left border-collapse min-w-[700px]">
        <thead>
          <tr className="bg-neutral-900 text-white font-mono uppercase tracking-wider text-[11px]">
            {columns.map((col, cIdx) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`p-3 border-r border-neutral-800 ${
                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                } ${
                  cIdx === 0 && stickyFirstColumn
                    ? 'sticky left-0 z-20 bg-neutral-900 shadow-xs'
                    : ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-200 font-sans">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-amber-50/30 transition-colors">
              {columns.map((col, cIdx) => {
                const isSticky = cIdx === 0 && stickyFirstColumn;
                const value = row[col.key] ?? '';
                const isReadonly = col.type === 'readonly';

                return (
                  <td
                    key={col.key}
                    className={`p-2 border-r border-neutral-200 ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    } ${
                      isSticky
                        ? 'sticky left-0 z-10 bg-white group-hover:bg-amber-50/30 font-bold text-neutral-900 border-r-2 border-neutral-300'
                        : ''
                    }`}
                  >
                    {isReadonly ? (
                      <span className="font-mono font-bold text-neutral-800 px-2 py-1 block">
                        {value}
                      </span>
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        data-row={rIdx}
                        data-col={cIdx}
                        value={value}
                        onChange={(e) => {
                          const val =
                            col.type === 'number'
                              ? parseFloat(e.target.value) || 0
                              : e.target.value;
                          onChangeRow(rIdx, col.key, val);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                        onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                        className={`w-full h-8 px-2 rounded border border-transparent hover:border-neutral-300 focus:border-amber-500 focus:bg-white text-xs ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        } ${col.type === 'number' ? 'font-mono' : ''}`}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
