import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  border?: boolean
}

const paddingMap = {
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
}

export default function Card({
  children,
  className = '',
  padding = 'md',
  border = false,
}: CardProps) {
  return (
    <div
      className={`bg-white text-navy rounded-none ${paddingMap[padding]} ${
        border ? 'border border-navy/10' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
