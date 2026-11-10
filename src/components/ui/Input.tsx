import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-zinc-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 ${
          error
            ? 'border-rose-400 focus:ring-rose-200 bg-rose-50/30'
            : 'border-zinc-300 focus:ring-zinc-900/10 focus:border-zinc-900 bg-white'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-zinc-500">{helperText}</p>}
    </div>
  );
};

