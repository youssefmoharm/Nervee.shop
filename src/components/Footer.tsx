import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@nerveey.shop';

const NAV_LINKS = [
  { name: 'Shop', href: '/shop' },
  { name: 'Collections', href: '/collections' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'Newsletter', href: '/newsletter' },
];

const INFO_LINKS = [
  { name: 'Shipping', href: '/shipping' },
  { name: 'Returns', href: '/returns' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-navy/10">
      <div className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img
                src="/assets/images/nervee logo.png"
                alt="NERVE"
                className="h-8 w-auto"
                onError={e => {
                  // Fallback to text logo if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <h2 className="nv-heading text-2xl text-navy hidden">NERVE</h2>
            </div>
            <p className="text-sm text-navy/60">
              Premium streetwear for the bold and the beautiful. Egyptian design, global standards.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/in/nerve-shop-b67623429"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy/60 hover:text-navy transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://www.tiktok.com/@user795916160817"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy/60 hover:text-navy transition-colors"
                aria-label="TikTok"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/gotthenerve58/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-navy/60 hover:text-navy transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="nv-heading text-lg mb-4">Shop</h3>
            <ul className="space-y-2 text-sm text-navy/60">
              {NAV_LINKS.map(link => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-navy transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="nv-heading text-lg mb-4">Help</h3>
            <ul className="space-y-2 text-sm text-navy/60">
              {INFO_LINKS.map(link => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-navy transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="nv-heading text-lg mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-navy/60">
              <li className="flex items-center gap-2">
                <Mail size={16} />
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-navy transition-colors">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} />
                <span>+20 100 000 0000</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={16} />
                <span>Cairo, Egypt</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navy/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-navy/40">
            © {new Date().getFullYear()} NERVE. All rights reserved.
          </p>
          <p className="text-sm text-navy/60">
            Made with{' '}
            <a
              href="https://youssefmoharmportfolio.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy transition-colors underline"
            >
              moharm
            </a>{' '}
            in Egypt
          </p>
        </div>
      </div>
    </footer>
  );
}
