import { Link } from 'react-router-dom';
import type { Product } from '../types';

export default function HeroSection({ product }: { product: Product | null }) {
  if (!product) {
    return (
      <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-navy flex items-center justify-center">
        <div className="text-center px-5">
          <h1 className="nv-heading text-5xl md:text-8xl text-white mb-6 animate-fadeUp">
            NEW DROP
          </h1>
          <p className="nv-edit text-xl md:text-3xl text-white/70 mb-8 animate-fadeUp" style={{ animationDelay: '0.2s' }}>
            EST. 2026
          </p>
          <Link
            to="/shop"
            className="inline-block nv-eyebrow text-white border border-white/30 px-8 py-4 hover:bg-white hover:text-navy transition-all duration-300 animate-fadeUp"
            style={{ animationDelay: '0.4s' }}
          >
            SHOP NOW
          </Link>
        </div>
      </section>
    );
  }

  const color = product.colors[0];
  const price = `EGP ${product.price.toLocaleString()}`;

  return (
    <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-navy">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={color?.image}
          alt={product.name}
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/20" />
        <div className="absolute inset-0 bg-checker-light opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 w-full">
          <div className="max-w-2xl animate-fadeUp">
            <p className="nv-eyebrow text-white/80 mb-4 uppercase tracking-widest">
              New Arrivals
            </p>
            <h1 className="nv-heading text-5xl md:text-8xl text-white mb-6 leading-tight drop-shadow-lg">
              {product.name}
            </h1>
            <p className="nv-edit text-2xl md:text-4xl text-white/90 mb-8">
              {price}
            </p>
            <Link
              to={`/product/${product.slug}`}
              className="inline-block bg-white text-navy nv-eyebrow px-10 py-5 hover:bg-navy hover:text-white transition-all duration-300 transform hover:scale-105"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Brand Mark */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-16 md:h-24 bg-navy/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 flex items-center justify-between h-full">
          <div className="nv-checker-mini w-8 h-8" />
          <p className="text-xs md:text-sm text-white/50 uppercase tracking-widest">
            EST. 2026 • CAIRO
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/shop"
              className="text-xs md:text-sm text-white/60 hover:text-white transition-colors uppercase tracking-widest"
            >
              SHOP
            </Link>
            <Link
              to="/collections"
              className="text-xs md:text-sm text-white/60 hover:text-white transition-colors uppercase tracking-widest"
            >
              COLLECT
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
