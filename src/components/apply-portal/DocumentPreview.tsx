import React from 'react';
import type { WizardDocumentItem } from '../../contexts/ApplyWizardContext';
import { 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Tag, 
  Paperclip 
} from 'lucide-react';

interface DocumentPreviewProps {
  documents: WizardDocumentItem[];
  onUpdate: (id: string, updates: Partial<WizardDocumentItem>) => void;
  onRemove: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  documents,
  onUpdate,
  onRemove,
  onReorder,
}) => {
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
        <Paperclip className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-xs font-bold text-neutral-700">No Technical Documents Uploaded Yet</p>
        <p className="text-[11px] text-neutral-500 mt-1">
          Upload Tech Packs, Spec Sheets, Bill of Materials, or Fabric Photos above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc, idx) => {
        const isImage = doc.file_type.startsWith('image/');
        const isPdf = doc.file_type.includes('pdf');
        const isExcel = doc.file_type.includes('spreadsheet') || doc.file_name.endsWith('.xlsx');

        return (
          <div
            key={doc.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-neutral-200 shadow-2xs hover:border-amber-300 transition-all"
          >
            {/* File Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Thumbnail / Icon */}
              <div className="h-12 w-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 overflow-hidden">
                {doc.preview_url ? (
                  <img src={doc.preview_url} alt="Preview" className="h-full w-full object-cover" />
                ) : isImage ? (
                  <ImageIcon className="w-5 h-5 text-amber-700" />
                ) : isPdf ? (
                  <FileText className="w-5 h-5 text-red-600" />
                ) : isExcel ? (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Paperclip className="w-5 h-5 text-neutral-500" />
                )}
              </div>

              {/* Title & Category */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-xs text-neutral-900 truncate max-w-xs sm:max-w-md">
                    {doc.file_name}
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                    {doc.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-500">
                  <span>{formatFileSize(doc.file_size_bytes)}</span>
                  <span>•</span>
                  <input
                    type="text"
                    placeholder="Add description / revision note..."
                    value={doc.description || ''}
                    onChange={(e) => onUpdate(doc.id, { description: e.target.value })}
                    className="h-6 px-1.5 rounded border border-transparent hover:border-neutral-300 focus:border-amber-500 text-[11px] w-full max-w-sm"
                  />
                </div>
              </div>
            </div>

            {/* Actions: Reorder & Delete */}
            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onReorder(idx, idx - 1)}
                className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                title="Move Up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={idx === documents.length - 1}
                onClick={() => onReorder(idx, idx + 1)}
                className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20 cursor-pointer"
                title="Move Down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onRemove(doc.id)}
                className="p-1.5 rounded text-neutral-400 hover:text-red-600 cursor-pointer"
                title="Remove Document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
