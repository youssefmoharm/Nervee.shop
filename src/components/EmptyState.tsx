import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

export default function EmptyState({ title, body, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-mist/30 px-6 py-10 text-center">
      <h3 className="nv-heading text-2xl mb-3">{title}</h3>
      <p className="text-sm text-navy/65 max-w-md mx-auto">{body}</p>
      {children}
      {actionLabel && onAction ? (
        <button onClick={onAction} className="mt-5 inline-flex items-center justify-center rounded-full border border-navy px-5 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors">
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
