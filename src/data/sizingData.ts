import type { Size } from '../types';

export interface SizeChart {
  size: Size;
  chest: string;
  waist: string;
  length: string;
  fit: 'Slim' | 'Regular' | 'Oversized';
}

export interface MaterialFitGuide {
  material: string;
  description: string;
  careNotes: string;
  fitTendency: 'runs-small' | 'true-to-size' | 'runs-large' | 'oversized';
}

export const sizeCharts: Record<string, SizeChart[]> = {
  default: [
    {
      size: 'XS',
      chest: '83-88 cm',
      waist: '66-71 cm',
      length: '64-66 cm',
      fit: 'Slim',
    },
    {
      size: 'S',
      chest: '88-93 cm',
      waist: '71-76 cm',
      length: '66-68 cm',
      fit: 'Slim',
    },
    {
      size: 'M',
      chest: '93-98 cm',
      waist: '76-81 cm',
      length: '68-70 cm',
      fit: 'Regular',
    },
    {
      size: 'L',
      chest: '98-103 cm',
      waist: '81-86 cm',
      length: '70-72 cm',
      fit: 'Regular',
    },
    {
      size: 'XL',
      chest: '103-108 cm',
      waist: '86-91 cm',
      length: '72-74 cm',
      fit: 'Regular',
    },
    {
      size: 'XXL',
      chest: '108-113 cm',
      waist: '91-96 cm',
      length: '74-76 cm',
      fit: 'Oversized',
    },
  ],
};

export const materialFitGuides: Record<string, MaterialFitGuide> = {
  cotton: {
    material: 'Cotton',
    description: '100% Cotton - Breathable and comfortable for everyday wear',
    careNotes:
      'Cotton may shrink by 2-3% after first wash. We recommend washing in cold water and air drying for best results.',
    fitTendency: 'true-to-size',
  },
  'cotton-blend': {
    material: 'Cotton Blend',
    description: 'Cotton blend with polyester - Durable and easy to care for',
    careNotes:
      'Blend fabric is more stable and resistant to shrinkage. Wash in warm water and tumble dry on low.',
    fitTendency: 'true-to-size',
  },
  'poly-blend': {
    material: 'Polyester Blend',
    description: 'Polyester blend - Wrinkle-resistant and long-lasting',
    careNotes: 'Minimal shrinkage. Machine wash warm and tumble dry. Avoid high heat.',
    fitTendency: 'true-to-size',
  },
};

export const fitDescriptions = {
  Slim: 'Fitted close to the body for a modern, sleek silhouette',
  Regular: 'Classic fit that balances comfort and style',
  Oversized: 'Relaxed, spacious fit for a comfortable, contemporary look',
};

export const faqItems = [
  {
    question: 'How do I measure my size?',
    answer:
      'Use a soft measuring tape and wear fitted clothing. Chest: Measure around the fullest part of your chest. Waist: Measure at the narrowest part of your waist. Length: Measure from your shoulder to desired shirt length.',
  },
  {
    question: 'Do your items shrink?',
    answer:
      '100% cotton items may shrink 2-3% after the first wash. Blended fabrics are more stable. We recommend washing in cold water and air drying to minimize shrinkage.',
  },
  {
    question: 'Which fit should I choose?',
    answer:
      'Slim fits are great if you prefer a tailored look. Regular fits offer classic comfort and versatility. Oversized fits provide a relaxed, contemporary aesthetic.',
  },
  {
    question: 'Can I exchange for a different size?',
    answer:
      'Yes! We offer free exchanges within 30 days of purchase. Visit our Returns page for more details.',
  },
  {
    question: 'How long does it take to deliver?',
    answer:
      'Standard delivery takes 3-5 business days. Express delivery is available for an additional fee. See our Shipping page for details.',
  },
];

/**
 * Calculate size recommendation based on measurements
 * @param chest - Chest measurement in cm
 * @param waist - Waist measurement in cm
 * @param length - Desired length in cm
 * @returns Recommended size or null if no match
 */
export function getRecommendedSize(
  chest: number,
  waist: number,
  length: number,
): { size: Size; fit: string; reason: string } | null {
  const chart = sizeCharts.default;

  for (const sizeInfo of chart) {
    const chestRange = sizeInfo.chest.split('-');
    const waistRange = sizeInfo.waist.split('-');
    const lengthRange = sizeInfo.length.split('-');

    const chestMin = parseInt(chestRange[0]);
    const chestMax = parseInt(chestRange[1]);
    const waistMin = parseInt(waistRange[0]);
    const waistMax = parseInt(waistRange[1]);
    const lengthMin = parseInt(lengthRange[0]);
    const lengthMax = parseInt(lengthRange[1]);

    // Check if measurements fall within this size range
    if (
      chest >= chestMin &&
      chest <= chestMax &&
      waist >= waistMin &&
      waist <= waistMax &&
      length >= lengthMin &&
      length <= lengthMax
    ) {
      return {
        size: sizeInfo.size,
        fit: fitDescriptions[sizeInfo.fit],
        reason: `Your measurements match size ${sizeInfo.size} (${sizeInfo.fit} fit)`,
      };
    }
  }

  // Find closest size if no exact match
  let closestSize = chart[0];
  let minDifference = Infinity;

  for (const sizeInfo of chart) {
    const chestRange = sizeInfo.chest.split('-');
    const chestMid = (parseInt(chestRange[0]) + parseInt(chestRange[1])) / 2;
    const difference = Math.abs(chest - chestMid);

    if (difference < minDifference) {
      minDifference = difference;
      closestSize = sizeInfo;
    }
  }

  return {
    size: closestSize.size,
    fit: fitDescriptions[closestSize.fit],
    reason: `Size ${closestSize.size} is the closest match (${closestSize.fit} fit)`,
  };
}
