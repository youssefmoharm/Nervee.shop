import { X } from 'lucide-react'

interface SizeGuideModalProps {
  onClose: () => void
}

const CHART = [
  { size: 'XS', chest: '86–89', waist: '71–74', hip: '89–92', length: '66' },
  { size: 'S', chest: '90–93', waist: '75–78', hip: '93–96', length: '68' },
  { size: 'M', chest: '94–98', waist: '79–83', hip: '97–101', length: '70' },
  { size: 'L', chest: '99–104', waist: '84–89', hip: '102–107', length: '72' },
  { size: 'XL', chest: '105–110', waist: '90–95', hip: '108–113', length: '74' },
  { size: 'XXL', chest: '111–117', waist: '96–102', hip: '114–120', length: '76' },
]

export default function SizeGuideModal({ onClose }: SizeGuideModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button type="button" aria-label="Close size guide" className="absolute inset-0 bg-navy/60 border-0 p-0" onClick={onClose} />
      <div className="relative bg-white max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-5 border-b border-navy/10">
          <h2 className="nv-heading text-2xl">Size Guide</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 hover:opacity-60">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-navy/60 mb-5">
            All measurements in centimeters, taken flat. NERVE runs true to size — if you&apos;re between
            sizes, size up for an oversized fit or down for something more fitted.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-navy/20">
                  <th className="text-left py-2.5 nv-eyebrow text-[10px]">Size</th>
                  <th className="text-left py-2.5 nv-eyebrow text-[10px]">Chest</th>
                  <th className="text-left py-2.5 nv-eyebrow text-[10px]">Waist</th>
                  <th className="text-left py-2.5 nv-eyebrow text-[10px]">Hip</th>
                  <th className="text-left py-2.5 nv-eyebrow text-[10px]">Length</th>
                </tr>
              </thead>
              <tbody>
                {CHART.map((row) => (
                  <tr key={row.size} className="border-b border-navy/10">
                    <td className="py-2.5 font-semibold">{row.size}</td>
                    <td className="py-2.5 text-navy/70">{row.chest}</td>
                    <td className="py-2.5 text-navy/70">{row.waist}</td>
                    <td className="py-2.5 text-navy/70">{row.hip}</td>
                    <td className="py-2.5 text-navy/70">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 text-sm text-navy/70">
            <p><strong className="text-navy">How to measure:</strong></p>
            <p><strong className="text-navy">Chest</strong> — measure around the fullest part of your chest, keeping the tape level.</p>
            <p><strong className="text-navy">Waist</strong> — measure around your natural waistline.</p>
            <p><strong className="text-navy">Hip</strong> — measure around the fullest part of your hips.</p>
            <p><strong className="text-navy">Length</strong> — measure from the highest point of the shoulder to the hem.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
