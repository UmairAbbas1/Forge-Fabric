import React, { useState, useRef, useCallback } from 'react';
import { useApplyWizard } from '../../contexts/ApplyWizardContext';
import { DocumentPreview } from './DocumentPreview';
import { CameraCapture } from './CameraCapture';
import { compressImageFile } from '../../hooks/useApplySubmission';
import { 
  FileUp, 
  UploadCloud, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Paperclip,
  CheckCircle2
} from 'lucide-react';

const DOCUMENT_CATEGORIES = [
  'Final Design / Prototype',
  'Tech Pack / Design Spec',
  'Fabric Swatch / Material Photo',
  'Other Reference Document',
];

const DISALLOWED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.vbs', '.js', '.bin'];

export const DocumentUploader: React.FC = () => {
  const { 
    state, 
    addDocument, 
    updateDocument, 
    removeDocument, 
    reorderDocuments, 
    nextStep, 
    prevStep, 
    saveDraftNow 
  } = useApplyWizard();
  
  const { documents } = state;
  const [selectedCategory, setSelectedCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFinalDesignUpload = documents.some(
    (doc) => doc.category === 'Final Design / Prototype' || doc.file_type.startsWith('image/')
  );

  const processFile = async (rawFile: File, category: string) => {
    // Security check: validate extension
    const ext = rawFile.name.substring(rawFile.name.lastIndexOf('.')).toLowerCase();
    if (DISALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Executable/script file types (${ext}) are not permitted for security.`);
      return;
    }

    // File size limit (50MB)
    if (rawFile.size > 50 * 1024 * 1024) {
      setErrorMessage(`File ${rawFile.name} exceeds the maximum permitted size of 50MB.`);
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // Compress if photo/image
      const finalFile = await compressImageFile(rawFile);
      const previewUrl = finalFile.type.startsWith('image/')
        ? URL.createObjectURL(finalFile)
        : undefined;

      addDocument({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: finalFile,
        file_name: finalFile.name,
        file_size_bytes: finalFile.size,
        file_type: finalFile.type || 'application/octet-stream',
        category,
        description: '',
        preview_url: previewUrl,
        is_uploaded: false,
      });
    } catch (err) {
      console.error('Error processing file:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], selectedCategory);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          await processFile(files[i], selectedCategory);
        }
      }
    },
    [selectedCategory]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasFinalDesignUpload) {
      setErrorMessage(
        'Mandatory Requirement: Please upload at least 1 Final Design / Prototype Reference Image before proceeding to final review.'
      );
      return;
    }
    setErrorMessage(null);
    saveDraftNow();
    nextStep();
  };

  return (
    <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
      
      {/* Header */}
      <div className="border-b border-neutral-100 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
              Technical Document &amp; Design Vault
            </h2>
            <p className="text-xs md:text-sm text-neutral-500">
              Upload your compulsory Final Design / Prototype reference image and optional Tech Pack specs.
            </p>
          </div>
        </div>

        {/* Mobile Camera Shutter Shortcut */}
        <div className="flex items-center gap-2">
          <CameraCapture
            category={selectedCategory}
            onCapture={(file) => processFile(file, selectedCategory)}
          />
        </div>
      </div>

      {/* Mandatory Final Design Banner */}
      <div
        className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
          hasFinalDesignUpload
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {hasFinalDesignUpload ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">
              {hasFinalDesignUpload
                ? '✓ Final Design / Prototype Reference Image Attached'
                : 'Mandatory Requirement: Upload Final Design / Prototype Image *'}
            </span>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              {hasFinalDesignUpload
                ? 'Your reference design image is attached. Other documents (Tech Pack, BOM, Swatch) are optional.'
                : 'Please upload at least 1 image showing how you envision the finished product to look (3D render, flat sketch, or photo).'}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message Callout */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-900 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Category Picker & Drag-Drop Dropzone */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Upload Category:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} {cat === 'Final Design / Prototype' ? '*' : '(Optional)'}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-neutral-500">
            Max 50MB per file · PDF, AI, PNG, JPG, XLSX, ZIP
          </span>
        </div>

        {/* Dropzone Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 md:p-12 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
            isDragging
              ? 'border-amber-600 bg-amber-50/50 scale-[1.01]'
              : 'border-neutral-300 hover:border-amber-500 hover:bg-neutral-50/60 bg-neutral-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.ai,.psd,.xlsx,.xls,.csv,.zip,.docx"
          />

          <div className="h-14 w-14 rounded-2xl bg-amber-100/70 text-amber-800 flex items-center justify-center mb-4">
            <UploadCloud className="w-7 h-7 stroke-[1.75]" />
          </div>

          <h3 className="font-bold text-sm text-neutral-900 mb-1">
            {isProcessing ? 'Optimizing & Attaching File...' : 'Drag & Drop documents here, or browse files'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-md leading-relaxed">
            Attaching files under category: <strong className="text-neutral-800">{selectedCategory}</strong>.
            Images are automatically compressed for high-speed transfer.
          </p>
        </div>
      </div>

      {/* Uploaded Documents List */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
            <span>Attached Documents ({documents.length})</span>
          </h3>
          {documents.length > 0 && (
            <span className="text-[11px] text-neutral-500">
              Drag or use arrows to organize sequence for production floor.
            </span>
          )}
        </div>

        <DocumentPreview
          documents={documents}
          onUpdate={updateDocument}
          onRemove={removeDocument}
          onReorder={reorderDocuments}
        />
      </div>

      {/* Actions & Navigation */}
      <div className="pt-6 border-t border-neutral-100 flex justify-between items-center gap-4">
        <button
          type="button"
          onClick={prevStep}
          className="h-12 px-6 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Cut Sheet</span>
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="h-12 px-8 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          <span>Continue to Final Review</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
