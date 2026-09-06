import { useState } from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SizeGuideTool from '../components/SizeGuideTool';
import { sizeCharts, materialFitGuides, faqItems, fitDescriptions } from '../data/sizingData';
import Button from '../components/Button';

export default function SizeGuide() {
  const [toolOpen, setToolOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link to="/" className="text-navy/60 hover:text-navy transition-colors">
            Home
          </Link>
          <ChevronRight size={16} className="text-navy/40" />
          <span className="text-navy font-semibold">Size Guide</span>
        </nav>

        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-navy mb-2">Size Guide</h1>
          <p className="text-navy/70">
            Find your perfect fit with our comprehensive size charts and measurement guide
          </p>
        </div>

        {/* CTA Button */}
        <div className="mb-12">
          <Button onClick={() => setToolOpen(true)} className="w-full md:w-auto">
            Use Size Calculator
          </Button>
        </div>

        {/* Fit Types */}
        <section className="mb-12 bg-mist rounded-lg p-6 md:p-8">
          <h2 className="text-2xl font-bold text-navy mb-6">Fit Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(fitDescriptions).map(([fit, description]) => (
              <div key={fit} className="bg-white rounded-lg p-4">
                <h3 className="text-lg font-semibold text-navy mb-2">{fit}</h3>
                <p className="text-navy/70 text-sm">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Size Chart */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-navy mb-6">Size Chart</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Size</th>
                  <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Chest</th>
                  <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Waist</th>
                  <th className="border border-navy/20 px-4 py-3 text-left font-semibold">
                    Length
                  </th>
                  <th className="border border-navy/20 px-4 py-3 text-left font-semibold">Fit</th>
                </tr>
              </thead>
              <tbody>
                {sizeCharts.default.map((size, i) => (
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
        </section>

        {/* How to Measure */}
        <section className="mb-12 bg-blue-50 border border-blue-200 rounded-lg p-6 md:p-8">
          <h2 className="text-2xl font-bold text-navy mb-6">How to Measure</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="text-4xl font-bold text-blue-600 flex-shrink-0 w-12">1</div>
              <div>
                <h3 className="text-lg font-semibold text-navy mb-2">Chest</h3>
                <p className="text-navy/80">
                  Measure around the fullest part of your chest while wearing a well-fitting shirt.
                  Keep the tape measure snug but not tight.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-4xl font-bold text-blue-600 flex-shrink-0 w-12">2</div>
              <div>
                <h3 className="text-lg font-semibold text-navy mb-2">Waist</h3>
                <p className="text-navy/80">
                  Measure at the narrowest part of your waist, just above your natural waist line.
                  Don&apos;t pull the tape too tight.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-4xl font-bold text-blue-600 flex-shrink-0 w-12">3</div>
              <div>
                <h3 className="text-lg font-semibold text-navy mb-2">Length</h3>
                <p className="text-navy/80">
                  Measure from your shoulder (top of your shoulder seam) down to your desired shirt
                  length. This helps ensure the perfect proportions for your body.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Material Information */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-navy mb-6">Material Information</h2>
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(materialFitGuides).map(([key, guide]) => (
              <div
                key={key}
                className="border border-navy/10 rounded-lg p-4 hover:bg-mist/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-navy mb-2">{guide.material}</h3>
                <p className="text-navy/80 text-sm mb-2">{guide.description}</p>
                <p className="text-navy/70 text-xs italic">{guide.careNotes}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-navy mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <details
                key={i}
                className="border border-navy/10 rounded-lg p-4 cursor-pointer group"
              >
                <summary className="flex items-center gap-2 font-semibold text-navy group-open:text-blue-600 hover:text-blue-600 transition-colors">
                  <HelpCircle size={18} />
                  {item.question}
                </summary>
                <p className="text-navy/80 mt-3 ml-7 text-sm leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Additional CTA */}
        <section className="bg-navy text-white rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to find your perfect fit?</h2>
          <p className="text-white/80 mb-6">
            Use our interactive size calculator to get personalized recommendations
          </p>
          <Button
            onClick={() => setToolOpen(true)}
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-navy"
          >
            Calculate My Size
          </Button>
        </section>
      </div>

      {/* Size Guide Tool Modal */}
      <SizeGuideTool isOpen={toolOpen} onClose={() => setToolOpen(false)} />
    </div>
  );
}
