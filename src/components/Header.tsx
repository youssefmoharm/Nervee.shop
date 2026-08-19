import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/shop?category=New%20Arrivals', label: 'New Drop' },
  { to: '/collections', label: 'Collections' },
  { to: '/about', label: 'About' },
];

export default function Header({ onSearch }: { onSearch: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, openCart } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const solid = scrolled || !isHome;

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main"
        className="absolute left-0 top-0 z-[100] -translate-x-full px-4 py-2 bg-white text-navy nv-eyebrow focus:translate-x-0"
      >
        Skip to main content
      </a>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          solid ? 'bg-navy/95 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto max-w-[1600px] px-5 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center">
              <img
                src="/assets/images/nervee logo.png"
                alt="NERVE"
                className="h-8 md:h-10 w-auto brightness-0 invert"
                onError={e => {
                  // Fallback to text logo if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <span className="nv-heading text-2xl md:text-3xl tracking-wide hidden">NERVE</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-10">
              {links.map(l => (
                <NavLink
                  key={l.label}
                  to={l.to}
                  data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className={({ isActive }) =>
                    `nv-eyebrow transition-colors hover:text-white ${
                      isActive ? 'text-white' : 'text-silver'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-4 md:gap-5">
              <button
                aria-label="Search"
                data-testid="search-button"
                onClick={onSearch}
                className="p-2 hover:opacity-60 transition-opacity"
              >
                <Search size={19} strokeWidth={1.75} />
              </button>
              <Link
                to={user ? '/account' : '/login'}
                aria-label="Account"
                data-testid="account-link"
                className="hidden sm:block p-2 hover:opacity-60 transition-opacity"
              >
                <User size={19} strokeWidth={1.75} />
              </Link>
              <button
                aria-label={`Bag, ${count} items`}
                data-testid="bag-button"
                onClick={openCart}
                className="relative p-2 hover:opacity-60 transition-opacity"
              >
                <ShoppingBag size={19} strokeWidth={1.75} />
                {count > 0 && (
                  <span
                    data-testid="cart-count"
                    className="absolute -top-0.5 -right-0.5 bg-white text-navy text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {count}
                  </span>
                )}
              </button>
              <button
                aria-label="Menu"
                data-testid="menu-button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2"
              >
                <Menu size={22} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile full-screen drawer */}
      <div
        data-testid="mobile-menu"
        className={`fixed inset-0 z-50 bg-navy transition-transform duration-500 ease-[cubic-bezier(.65,0,.35,1)] lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <div className="flex items-center">
            <img
              src="/assets/images/nervee logo.png"
              alt="NERVE"
              className="h-6 w-auto brightness-0 invert"
              onError={e => {
                // Fallback to text logo if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="nv-heading text-2xl hidden">NERVE</span>
          </div>
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="p-2">
            <X size={24} />
          </button>
        </div>
        <nav className="flex flex-col px-6 py-10 gap-1">
          {links.map((l, i) => (
            <Link
              key={l.label}
              to={l.to}
              className="nv-heading text-[13vw] leading-none py-3 border-b border-white/10 opacity-0 animate-fadeUp"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 mt-4 flex gap-6 nv-eyebrow text-silver">
          <a
            href="https://www.instagram.com/gotthenerve58/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Instagram
          </a>
          <a
            href="https://www.tiktok.com/@user795916160817"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            TikTok
          </a>
          <a
            href="https://www.linkedin.com/in/nerve-shop-b67623429"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </>
  );
}
