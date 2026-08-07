import React from 'react';

interface ReferenceCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const ReferenceCodeInput: React.FC<ReferenceCodeInputProps> = ({
  value,
  onChange,
  placeholder = 'APP-YYYY-XXXX or PO-YYYY-XXXX',
  required = true,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase();
    onChange(raw);
  };

  return (
    <input
      type="text"
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      className={`w-full h-11 px-3.5 rounded-xl border border-neutral-300 font-mono text-sm uppercase tracking-wider text-neutral-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white ${className}`}
    />
  );
};
