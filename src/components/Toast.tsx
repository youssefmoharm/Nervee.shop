import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

export default function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
  }

  const colors = {
    success: 'bg-green-50 text-green-900 border-green-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    info: 'bg-blue-50 text-blue-900 border-blue-200',
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[type]}`}
        role="alert"
      >
        {icons[type]}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false)
            onClose()
          }}
          className="ml-2 p-1 hover:opacity-70"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
