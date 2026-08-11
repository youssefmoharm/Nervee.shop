/**
 * Simple skeleton loader for Suspense fallback - no callback needed
 */
export default function SimpleSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="nv-checker w-10 h-10 animate-pulse" />
    </div>
  )
}
