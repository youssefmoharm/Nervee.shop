import { sizeCharts, type SizeChart } from '../data/sizingData';

/**
 * Single rendering of the size chart table. Data always comes from
 * `src/data/sizingData.ts` (the one source of truth) — modal, page, and
 * calculator must not re-declare columns.
 */
export default function SizeChartTable({
  variant = 'default',
  chart = sizeCharts.default,
}: {
  variant?: 'default' | 'page' | 'tool';
  chart?: SizeChart[];
}) {
  if (variant === 'tool') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-mist">
              <th className="border border-navy/10 px-3 py-2 text-left">Size</th>
              <th className="border border-navy/10 px-3 py-2 text-left">Chest</th>
              <th className="border border-navy/10 px-3 py-2 text-left">Waist</th>
              <th className="border border-navy/10 px-3 py-2 text-left">Length</th>
              <th className="border border-navy/10 px-3 py-2 text-left">Fit</th>
            </tr>
          </thead>
          <tbody>
            {chart.map(size => (
              <tr key={size.size} className="hover:bg-mist/50">
                <td className="border border-navy/10 px-3 py-2 font-semibold">{size.size}</td>
                <td className="border border-navy/10 px-3 py-2">{size.chest}</td>
                <td className="border border-navy/10 px-3 py-2">{size.waist}</td>
                <td className="border border-navy/10 px-3 py-2">{size.length}</td>
                <td className="border border-navy/10 px-3 py-2 text-navy/70">{size.fit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-navy text-white">
              <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Size</th>
              <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Chest</th>
              <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Waist</th>
              <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Length</th>
              <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Fit</th>
            </tr>
          </thead>
          <tbody>
            {chart.map((size, i) => (
              <tr key={size.size} className={i % 2 === 0 ? 'bg-white' : 'bg-mist/50'}>
                <td className="border border-navy/10 px-4 py-3 font-semibold text-navy">
                  {size.size}
                </td>
                <td className="border border-navy/10 px-4 py-3 text-navy/80">{size.chest}</td>
                <td className="border border-navy/10 px-4 py-3 text-navy/80">{size.waist}</td>
                <td className="border border-navy/10 px-4 py-3 text-navy/80">{size.length}</td>
                <td className="border border-navy/10 px-4 py-3 text-navy/70">{size.fit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-navy/20">
            <th className="text-left py-2.5 nv-eyebrow text-[10px]">Size</th>
            <th className="text-left py-2.5 nv-eyebrow text-[10px]">Chest</th>
            <th className="text-left py-2.5 nv-eyebrow text-[10px]">Waist</th>
            <th className="text-left py-2.5 nv-eyebrow text-[10px]">Length</th>
            <th className="text-left py-2.5 nv-eyebrow text-[10px]">Fit</th>
          </tr>
        </thead>
        <tbody>
          {chart.map(row => (
            <tr key={row.size} className="border-b border-navy/10">
              <td className="py-2.5 font-semibold">{row.size}</td>
              <td className="py-2.5 text-navy/70">{row.chest}</td>
              <td className="py-2.5 text-navy/70">{row.waist}</td>
              <td className="py-2.5 text-navy/70">{row.length}</td>
              <td className="py-2.5 text-navy/70">{row.fit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
