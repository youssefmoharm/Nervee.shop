/**
 * Reusable skeleton loader component for loading states.
 * Handles various shapes: rectangle, circle, text lines.
 */

interface SkeletonProps {
  className?: string
  variant?: 'rect' | 'circle' | 'text'
  count?: number
  height?: string
}

export default function Skeleton({
  className = '',
  variant = 'rect',
  count = 1,
  height = 'h-4',
}: SkeletonProps) {
  if (variant === 'circle') {
    return <div className={`rounded-full bg-gradient-to-r from-mist via-white to-mist animate-pulse ${className}`} />
  }

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`bg-gradient-to-r from-mist via-white to-mist animate-pulse ${
              i === count - 1 ? 'w-3/4' : 'w-full'
            } ${height}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-r from-mist via-white to-mist animate-pulse ${className}`} />
  )
}
