import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import FocusTrap from 'focus-trap-react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/shop?category=New%20Arrivals', label: 'New Drop' },
  { to: '/collections', label: 'Collections' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Header({ onSearch }: { onSearch: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, openCart } = useCart();
  const { user } = useAuth();
  const { t } = useI18n();
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

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const solid = scrolled || !isHome;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          solid ? 'bg-navy/95 backdrop-blur-md border-b border-white/10' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto max-w-[1600px] px-5 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center">
              <img
                decoding="async"
                src="/assets/images/nerve-final-logo.png"
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
                      isActive
                        ? 'text-white underline underline-offset-8 decoration-2'
                        : 'text-white/70'
                    }`
                  }
                >
                  {t(l.label)}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                aria-label={t('Search')}
                data-testid="search-button"
                onClick={onSearch}
                className="w-11 h-11 flex items-center justify-center hover:bg-mist rounded transition-colors"
              >
                <Search size={20} strokeWidth={1.75} />
              </button>
              <Link
                to={user ? '/account' : '/login'}
                aria-label={t('Account')}
                data-testid="account-link"
                className="flex w-11 h-11 items-center justify-center hover:bg-mist rounded transition-colors"
              >
                <User size={20} strokeWidth={1.75} />
              </Link>
              <button
                aria-label={`${t('Bag')}, ${count} ${t('items')}`}
                data-testid="bag-button"
                onClick={openCart}
                className="relative w-11 h-11 flex items-center justify-center hover:bg-mist rounded transition-colors"
              >
                <ShoppingBag size={20} strokeWidth={1.75} />
                {count > 0 && (
                  <span
                    data-testid="cart-count"
                    className="absolute -top-0.5 -end-0.5 bg-white text-navy text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {count}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label={t('Menu')}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu-panel"
                data-testid="menu-button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-11 h-11 flex items-center justify-center hover:bg-mist rounded transition-colors"
              >
                <Menu size={24} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile full-screen drawer */}
      <FocusTrap
        active={mobileOpen}
        focusTrapOptions={{ escapeDeactivates: false, returnFocusOnDeactivate: true }}
      >
        <div className="contents">
          <div
            id="mobile-menu-panel"
            data-testid="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('Menu')}
            aria-hidden={!mobileOpen}
            tabIndex={-1}
            ref={node => {
              if (node) {
                if (!mobileOpen) node.setAttribute('inert', '');
                else node.removeAttribute('inert');
              }
            }}
            className={`fixed inset-0 z-50 bg-navy transition-transform duration-300 lg:hidden ${
              mobileOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{
              transitionDuration: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? '0ms'
                : '300ms',
            }}
          >
            <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
              <div className="flex items-center">
                <img
                  decoding="async"
                  src="/assets/images/nerve-final-logo.png"
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
              <button
                type="button"
                aria-label={t('Close menu')}
                onClick={() => setMobileOpen(false)}
                className="w-11 h-11 flex items-center justify-center"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex flex-col px-6 py-10 gap-1 overflow-y-auto max-h-[calc(100dvh-4rem)]">
              {links.map((l, i) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="nv-heading text-[clamp(1.75rem,11vw,3rem)] leading-none py-3 border-b border-white/10 transition-opacity duration-300 opacity-0 animate-fadeUp break-words"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    animationFillMode: 'forwards',
                    ...(matchMedia('(prefers-reduced-motion: reduce)').matches && {
                      animation: 'none',
                      opacity: 1,
                    }),
                  }}
                >
                  {t(l.label)}
                </Link>
              ))}
            </nav>
            <div className="px-6 mt-4 flex flex-wrap items-center gap-4 nv-eyebrow text-silver safe-pb">
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
        </div>
      </FocusTrap>
    </>
  );
}
