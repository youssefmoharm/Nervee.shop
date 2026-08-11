import { Link } from 'react-router-dom'
import { collections } from '../data/products'

export default function Collections() {
  return (
    <div className="bg-navy min-h-screen pt-24 md:pt-28">
      <div className="px-5 md:px-8 py-10 md:py-16">
        <p className="nv-eyebrow text-silver mb-2">Curated Edits</p>
        <h1 className="nv-heading text-5xl md:text-8xl">Collections</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-1 px-1 pb-1">
        {collections.map((c) => (
          <Link key={c.id} to={`/collections/${c.id}`} className="group relative aspect-[3/4] overflow-hidden block">
            <img src={c.image} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/10 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <p className="nv-eyebrow text-silver mb-1">{c.tagline}</p>
              <h2 className="nv-heading text-3xl mb-3">{c.name}</h2>
              <span className="text-xs font-semibold uppercase tracking-widest2 underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity">
                Shop Now
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
