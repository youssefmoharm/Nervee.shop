import { Link } from 'react-router-dom'
import Checkerboard from './Checkerboard'

export default function Footer() {
  return (
    <footer className="bg-navy pt-16 md:pt-20">
      <div className="mx-auto max-w-[1600px] px-5 md:px-8 grid grid-cols-2 md:grid-cols-5 gap-10 pb-14">
        <div className="col-span-2">
          <span className="nv-heading text-4xl md:text-5xl">NERVE</span>
          <p className="nv-eyebrow text-silver mt-3">Cool but Chic</p>
          <p className="text-sm text-silver/80 mt-6 max-w-xs leading-relaxed">
            A contemporary concept store built around individuality, movement, and the pieces
            that become part of your everyday identity.
          </p>
        </div>

        <div>
          <h4 className="nv-eyebrow text-silver mb-4">Shop</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/shop" className="hover:text-silver transition-colors">Shop All</Link></li>
            <li><Link to="/shop?category=New%20Arrivals" className="hover:text-silver transition-colors">New Drop</Link></li>
            <li><Link to="/collections" className="hover:text-silver transition-colors">Collections</Link></li>
            <li><Link to="/about" className="hover:text-silver transition-colors">About</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="nv-eyebrow text-silver mb-4">Customer Care</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/contact" className="hover:text-silver transition-colors">Contact</Link></li>
            <li><Link to="/shipping" className="hover:text-silver transition-colors">Shipping</Link></li>
            <li><Link to="/returns" className="hover:text-silver transition-colors">Returns</Link></li>
            <li><Link to="/privacy" className="hover:text-silver transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-silver transition-colors">Terms of Service</Link></li>
            <li><Link to="/cart" className="hover:text-silver transition-colors">My Bag</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="nv-eyebrow text-silver mb-4">Follow</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="hover:text-silver transition-colors">Instagram</a></li>
            <li><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" className="hover:text-silver transition-colors">TikTok</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="mx-auto max-w-[1600px] px-5 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-silver/70">
          <span>&copy; {new Date().getFullYear()} NERVE Concept Store — EST 2026</span>
          <span>Based in everyone&apos;s closet.</span>
        </div>
      </div>
      <Checkerboard height={10} />
    </footer>
  )
}
