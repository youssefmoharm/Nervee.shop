import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
}

export default forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, fullWidth = false, className = '', ...props },
  ref,
) {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && <label className="block text-sm font-medium text-navy mb-2">{label}</label>}
      <input
        ref={ref}
        className={`border ${
          error ? 'border-red-600' : 'border-navy/20'
        } px-3 py-3 w-full text-base focus:outline-2 focus:outline-offset-2 focus:outline-navy transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {helper && <p className="text-xs text-navy/50 mt-1">{helper}</p>}
    </div>
  );
});
