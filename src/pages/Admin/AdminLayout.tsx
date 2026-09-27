import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSEO } from '../../hooks/useSEO';
import { Menu, X, Home } from 'lucide-react';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/returns', label: 'Returns' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/contacts', label: 'Contacts' },
  { to: '/admin/newsletter', label: 'Newsletter' },
  { to: '/admin/discounts', label: 'Discounts' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Admin routes must never be indexed and should not inherit the previous
  // page's title/canonical (AUDIT SEO-03).
  useSEO({
    title: 'Admin — NERVE',
    description: 'NERVE store administration.',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="bg-white text-navy min-h-screen">
      <header className="bg-navy text-white h-16 flex items-center px-4 md:px-6 justify-between md:justify-start md:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open admin menu"
          data-testid="admin-menu-button"
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>

        <Link to="/" className="flex items-center">
          <Home className="w-5 h-5 mr-2" />
          <span className="nv-heading text-xl tracking-wide">NERVE</span>
          <span className="nv-eyebrow text-silver ml-2 text-[10px]">ADMIN</span>
        </Link>
        <button
          onClick={() => signOut()}
          className="nv-eyebrow text-xs text-silver hover:text-white ml-auto md:ml-0"
        >
          Sign Out
        </button>
      </header>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsSidebarOpen(false);
            }
          }}
          role="presentation"
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <nav
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-navy/10 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-end mb-6 md:hidden">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-navy hover:bg-navy/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 space-y-1">
              {links.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  // Close the drawer on navigation: otherwise the fixed
                  // sidebar keeps covering the page the link just opened.
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `nv-eyebrow px-3 py-2.5 rounded-lg transition-colors ${
                      isActive ? 'bg-navy text-white' : 'text-navy/60 hover:bg-mist'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 md:p-10 p-6 min-w-0 min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
}
