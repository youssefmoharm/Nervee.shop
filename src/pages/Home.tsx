import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO, seoHelpers } from '../lib/seo';
import Newsletter from '../components/Newsletter';

const categoryTiles = [
  { name: 'T-Shirts', seed: 'cat-tees' },
  { name: 'Hoodies', seed: 'cat-hoodies' },
  { name: 'Denim', seed: 'cat-denim' },
  { name: 'Jackets', seed: 'cat-jackets' },
  { name: 'Caps', seed: 'cat-caps' },
  { name: 'Accessories', seed: 'cat-acc' },
];

export default function Home() {
  useSEO(seoHelpers.home());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <>
      {/* SHOP BY CATEGORY */}
      <section className="bg-white text-navy py-16 md:py-24 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column - Category List */}
            <div className="flex flex-col justify-start">
              <h2 className="nv-heading text-4xl md:text-5xl mb-10">Shop by Category</h2>
              <div className="space-y-3">
                {categoryTiles.map(c => (
                  <Link
                    key={c.name}
                    to={`/shop?category=${encodeURIComponent(c.name)}`}
                    className="text-sm md:text-base text-navy/70 hover:text-navy transition-colors uppercase tracking-widest"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Column - Large Images Grid */}
            <div className="md:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                {categoryTiles.map((c, idx) => (
                  <Link
                    key={c.name}
                    to={`/shop?category=${encodeURIComponent(c.name)}`}
                    className={`group relative overflow-hidden block ${
                      idx === 0 ? 'md:col-span-2 md:row-span-2' : ''
                    }`}
                    style={idx === 0 ? { aspectRatio: '1 / 1' } : { aspectRatio: '3/4' }}
                  >
                    <img
                      src={`https://picsum.photos/seed/${c.seed}/500/650`}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/20 transition-colors" />
                    <span className="absolute bottom-3 left-3 text-white nv-edit text-sm font-semibold uppercase tracking-wide drop-shadow">
                      {c.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS - NEW SECTION */}
      {!loading && (
        <section className="bg-mist py-16 md:py-24 px-5 md:px-8">
          <div className="mx-auto max-w-[1600px]">
            <div className="text-center mb-12">
              <p className="nv-eyebrow text-navy/60 mb-2">TESTIMONIALS</p>
              <h2 className="nv-heading text-4xl md:text-6xl">What They Say</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: 'Ahmed M.',
                  text: 'The quality is unmatched. Best streetwear I have found in Egypt.',
                  role: 'Style Enthusiast',
                },
                {
                  name: 'Sarah K.',
                  text: 'Finally a local brand that understands modern minimalism. Highly recommend!',
                  role: 'Fashion Blogger',
                },
                {
                  name: 'Omar R.',
                  text: 'Fast delivery and incredible customer service. The New Drop collection is amazing.',
                  role: 'Regular Customer',
                },
              ].map((t, i) => (
                <div key={i} className="bg-white p-8 shadow-sm">
                  <div className="flex gap-1 text-amber-500 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-navy/70 mb-6 italic">&ldquo;{t.text}&rdquo;</p>
                  <div>
                    <p className="font-semibold text-navy">{t.name}</p>
                    <p className="text-xs text-navy/50 uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Newsletter />
    </>
  );
}
