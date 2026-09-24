import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'nv-eyebrow transition-colors font-medium disabled:opacity-60';

  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-2',
    secondary: 'bg-white text-navy border border-navy hover:bg-mist',
    outline: 'border border-navy text-navy hover:bg-navy hover:text-white',
    ghost: 'text-navy hover:opacity-60',
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2" aria-busy="true">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
