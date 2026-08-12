import React, { useState, useRef, useEffect } from "react";
import { Info, HelpCircle, X } from "lucide-react";

export interface InfoTooltipProps {
  title: string;
  description: string;
  source?: string;
  formula?: string;
  example?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  description,
  source,
  formula,
  example,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center ml-1" ref={tooltipRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        className="text-neutral-400 hover:text-blue-600 p-0.5 rounded-full transition-colors focus:outline-none cursor-pointer"
        title="Click for info"
        aria-label={`Information about ${title}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-neutral-900 text-white rounded-xl shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 pointer-events-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-700 mb-2">
            <span className="font-extrabold text-blue-400 text-xs flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              {title}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <p className="text-[11px] text-neutral-300 leading-relaxed font-normal mb-2">
            {description}
          </p>

          {source && (
            <div className="mt-1.5 pt-1.5 border-t border-neutral-800 text-[10px]">
              <span className="text-neutral-400 font-bold uppercase block">Where to find it:</span>
              <span className="text-amber-300 font-medium">{source}</span>
            </div>
          )}

          {formula && (
            <div className="mt-1.5 pt-1.5 border-t border-neutral-800 text-[10px]">
              <span className="text-neutral-400 font-bold uppercase block">Calculation Formula:</span>
              <code className="text-emerald-300 font-mono font-bold block bg-neutral-800 px-1.5 py-0.5 rounded mt-0.5">
                {formula}
              </code>
            </div>
          )}

          {example && (
            <div className="mt-1.5 text-[10px] text-neutral-400">
              <span>Example: <strong className="text-neutral-200">{example}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
