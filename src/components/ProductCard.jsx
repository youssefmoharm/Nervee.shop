import { Link } from 'react-router-dom'

export default function ProductCard({ product }) {
  return (
    <Link to={`/product/${product.slug}`} className="card">
      <div className="card-media">
        <img src={product.images[0]} alt={product.name} loading="lazy" />
        {product.tag && <span className="card-tag">{product.tag}</span>}
      </div>
      <div className="card-body">
        <h3>{product.name}</h3>
        <div className="card-meta">
          <span>{product.category}</span>
          <span>${product.price}</span>
        </div>
      </div>
    </Link>
  )
}
