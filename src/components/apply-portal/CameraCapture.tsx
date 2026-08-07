import React, { useRef } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { compressImageFile } from '../../hooks/useApplySubmission';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  category?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, category = 'Fabric Swatch / Photo' }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress high-res mobile camera photo
    const compressed = await compressImageFile(file);
    onCapture(compressed);

    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all cursor-pointer border border-neutral-300"
      >
        <Camera className="w-3.5 h-3.5 text-amber-700" />
        <span>Take Photo (Camera)</span>
      </button>
    </>
  );
};
