import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Collection, Product } from '../types';
import { productService } from '../services/productService';
import { useSEO } from '../lib/seo';
import ProductCard from '../components/ProductCard';

export default function CollectionDetail() {
  const { id } = useParams();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: collection ? `${collection.name} | NERVE` : 'Collection | NERVE',
    description: collection?.description || collection?.tagline || 'Browse the NERVE collection.',
  });

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    Promise.all([productService.getCollection(id), productService.getProductsByCollection(id)])
      .then(([c, p]) => {
        if (!mounted) return;
        setCollection(c ?? null);
        setProducts(p);
        setLoading(false);
      })
      .catch(error => {
        if (!mounted) return;
        console.error('Failed to load collection:', error);
        setCollection(null);
        setProducts([]);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return <div className="bg-white min-h-screen pt-28 px-5 text-navy">Loading…</div>;
  }

  if (!collection) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 px-5 text-center">
        <h1 className="nv-heading text-4xl mb-4">Collection Not Found</h1>
        <Link to="/collections" className="nv-eyebrow underline">
          Back to Collections
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen">
      <div className="relative h-[50vh] min-h-[340px] mt-16 md:mt-20">
        <img
          src={collection.image}
          alt={collection.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-navy/50" />
        <div className="relative h-full flex flex-col justify-end px-5 md:px-8 pb-10 text-white">
          <p className="nv-eyebrow text-silver mb-2">{collection.tagline}</p>
          <h1 className="nv-heading text-5xl md:text-7xl">{collection.name}</h1>
        </div>
      </div>

      <div className="px-5 md:px-8 py-10">
        <p className="max-w-2xl text-navy/70 mb-12">{collection.description}</p>
        {products.length === 0 ? (
          <p className="text-navy/50">No products in this collection yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10 pb-16">
            {products.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
