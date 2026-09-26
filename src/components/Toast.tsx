import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} aria-hidden="true" />,
    error: <AlertCircle size={20} aria-hidden="true" />,
    info: <Info size={20} aria-hidden="true" />,
  };

  const colors = {
    success: 'bg-green-50 text-green-900 border-green-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    info: 'bg-blue-50 text-blue-900 border-blue-200',
  };

  return (
    <div
      className={`max-w-[min(24rem,calc(100vw-2rem))] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-sm ${colors[type]}`}
        role="alert"
      >
        <span className="mt-0.5 shrink-0">{icons[type]}</span>
        <p className="text-sm font-medium flex-1 min-w-0 break-words">{message}</p>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            onClose();
          }}
          aria-label="Dismiss notification"
          className="ms-1 p-2 hover:opacity-70 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
