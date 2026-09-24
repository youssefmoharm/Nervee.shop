import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="wrap empty">
      <h1>Page not found</h1>
      <p>That route is not in the drop.</p>
      <Link className="btn btn-primary" to="/shop" style={{ marginTop: 16 }}>
        Back to shop
      </Link>
    </div>
  )
}
