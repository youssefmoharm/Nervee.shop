interface Props {
  height?: number
  invert?: boolean
  className?: string
}

/** The recurring NERVE signature mark — used sparingly as a section divider. */
export default function Checkerboard({ height = 14, invert = false, className = '' }: Props) {
  return (
    <div
      className={`w-full ${invert ? 'nv-checker-inv' : 'nv-checker'} ${className}`}
      style={{ height }}
      aria-hidden="true"
    />
  )
}
