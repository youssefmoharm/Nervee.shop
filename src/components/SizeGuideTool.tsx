import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { getRecommendedSize, materialFitGuides, faqItems } from '../data/sizingData';
import SizeChartTable from './SizeChartTable';

interface SizeGuideToolProps {
  isOpen: boolean;
  onClose: () => void;
  productMaterial?: string;
}

type MeasurementUnit = 'cm' | 'inches';

export default function SizeGuideTool({ isOpen, onClose, productMaterial }: SizeGuideToolProps) {
  const [step, setStep] = useState<'form' | 'result' | 'chart'>('form');
  const [unit, setUnit] = useState<MeasurementUnit>('cm');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [length, setLength] = useState('');
  const [recommendation, setRecommendation] = useState<ReturnType<typeof getRecommendedSize>>(null);

  if (!isOpen) return null;

  const inchesToCm = (inches: number) => inches * 2.54;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let chestCm = parseFloat(chest);
    let waistCm = parseFloat(waist);
    let lengthCm = parseFloat(length);

    if (unit === 'inches') {
      chestCm = inchesToCm(chestCm);
      waistCm = inchesToCm(waistCm);
      lengthCm = inchesToCm(lengthCm);
    }

    const rec = getRecommendedSize(chestCm, waistCm, lengthCm);
    setRecommendation(rec);
    setStep('result');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* The white panel states its own foreground so the tool renders correctly
          no matter which page (or theme) it is mounted from. */}
      <div className="bg-white text-navy rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-navy/10">
          <h2 className="text-xl md:text-2xl font-bold text-navy">Find Your Size</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-navy/10 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {step === 'form' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-navy mb-4">Enter Your Measurements</h3>

                {/* Unit toggle */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setUnit('cm')}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      unit === 'cm' ? 'bg-navy text-white' : 'bg-mist text-navy hover:bg-mist/75'
                    }`}
                  >
                    Centimeters
                  </button>
                  <button
                    onClick={() => setUnit('inches')}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      unit === 'inches'
                        ? 'bg-navy text-white'
                        : 'bg-mist text-navy hover:bg-mist/75'
                    }`}
                  >
                    Inches
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Chest */}
                  <div>
                    <label
                      htmlFor="chest-input"
                      className="block text-sm font-medium text-navy mb-1"
                    >
                      Chest Measurement
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="chest-input"
                        type="number"
                        value={chest}
                        onChange={e => setChest(e.target.value)}
                        placeholder="e.g., 96"
                        className="flex-1 px-3 py-2 border border-navy/20 rounded focus:outline-none focus:ring-2 focus:ring-navy"
                        required
                      />
                      <span className="px-3 py-2 bg-mist text-navy font-medium rounded">
                        {unit === 'cm' ? 'cm' : 'in'}
                      </span>
                    </div>
                    <p className="text-xs text-navy/60 mt-1">
                      Measure around the fullest part of your chest
                    </p>
                  </div>

                  {/* Waist */}
                  <div>
                    <label
                      htmlFor="waist-input"
                      className="block text-sm font-medium text-navy mb-1"
                    >
                      Waist Measurement
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="waist-input"
                        type="number"
                        value={waist}
                        onChange={e => setWaist(e.target.value)}
                        placeholder="e.g., 81"
                        className="flex-1 px-3 py-2 border border-navy/20 rounded focus:outline-none focus:ring-2 focus:ring-navy"
                        required
                      />
                      <span className="px-3 py-2 bg-mist text-navy font-medium rounded">
                        {unit === 'cm' ? 'cm' : 'in'}
                      </span>
                    </div>
                    <p className="text-xs text-navy/60 mt-1">
                      Measure at the narrowest part of your waist
                    </p>
                  </div>

                  {/* Length */}
                  <div>
                    <label
                      htmlFor="length-input"
                      className="block text-sm font-medium text-navy mb-1"
                    >
                      Desired Length
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="length-input"
                        type="number"
                        value={length}
                        onChange={e => setLength(e.target.value)}
                        placeholder="e.g., 70"
                        className="flex-1 px-3 py-2 border border-navy/20 rounded focus:outline-none focus:ring-2 focus:ring-navy"
                        required
                      />
                      <span className="px-3 py-2 bg-mist text-navy font-medium rounded">
                        {unit === 'cm' ? 'cm' : 'in'}
                      </span>
                    </div>
                    <p className="text-xs text-navy/60 mt-1">
                      From your shoulder to desired shirt length
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-navy text-white py-3 rounded font-semibold hover:bg-navy-2 transition-colors"
                  >
                    Get Size Recommendation
                  </button>
                </form>
              </div>

              {/* Size Chart Preview */}
              <div>
                <h3 className="text-lg font-semibold text-navy mb-4">Size Chart</h3>
                <SizeChartTable variant="tool" />
              </div>

              {/* Material fit guide */}
              {productMaterial && materialFitGuides[productMaterial.toLowerCase()] && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-navy mb-2">Material Information</h4>
                  <p className="text-sm text-navy/80">
                    {materialFitGuides[productMaterial.toLowerCase()]?.description}
                  </p>
                  <p className="text-xs text-navy/70 mt-2">
                    {materialFitGuides[productMaterial.toLowerCase()]?.careNotes}
                  </p>
                </div>
              )}

              {/* FAQ */}
              <div>
                <h3 className="text-lg font-semibold text-navy mb-4">Frequently Asked Questions</h3>
                <div className="space-y-3">
                  {faqItems.slice(0, 2).map((item, i) => (
                    <details
                      key={i}
                      className="border border-navy/10 rounded-lg p-3 cursor-pointer group"
                    >
                      <summary className="font-medium text-navy group-open:text-blue-600">
                        {item.question}
                      </summary>
                      <p className="text-sm text-navy/70 mt-2">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'result' && recommendation && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="text-white" size={28} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-navy mb-2">Size {recommendation.size}</h3>
                <p className="text-lg text-navy/80 mb-4">{recommendation.reason}</p>
                <p className="text-sm text-navy/70 italic">{recommendation.fit}</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-navy">What This Means</h3>
                <div className="space-y-2 text-sm text-navy/80">
                  <p>
                    ✓ Your recommended size is <strong>{recommendation.size}</strong> based on your
                    measurements
                  </p>
                  <p>
                    ✓ This size offers a <strong>{recommendation.fit.toLowerCase()}</strong> fit
                  </p>
                  <p>✓ If you prefer a tighter fit, go down one size. For a looser fit, go up.</p>
                </div>
              </div>

              {productMaterial && materialFitGuides[productMaterial.toLowerCase()] && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-navy mb-2">Material Care Tips</h4>
                  <p className="text-sm text-navy/80">
                    {materialFitGuides[productMaterial.toLowerCase()]?.careNotes}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStep('form');
                    setChest('');
                    setWaist('');
                    setLength('');
                  }}
                  className="flex-1 px-4 py-3 border border-navy rounded font-semibold text-navy hover:bg-navy/10 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-navy rounded font-semibold text-white hover:bg-navy-2 transition-colors"
                >
                  Shop Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
