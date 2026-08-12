import { type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/contacts', label: 'Contacts' },
  { to: '/admin/newsletter', label: 'Newsletter' },
  { to: '/admin/discounts', label: 'Discounts' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="bg-white text-navy min-h-screen">
      <header className="bg-navy text-white h-16 flex items-center px-6 justify-between">
        <Link to="/" className="nv-heading text-xl tracking-wide">
          NERVE <span className="nv-eyebrow text-silver ml-2 text-[10px]">ADMIN</span>
        </Link>
        <button
          onClick={() => signOut()}
          className="nv-eyebrow text-xs text-silver hover:text-white"
        >
          Sign Out
        </button>
      </header>
      <div className="grid md:grid-cols-[200px_1fr] min-h-[calc(100vh-64px)]">
        <nav className="border-r border-navy/10 p-4 flex md:flex-col gap-1 overflow-x-auto">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `nv-eyebrow px-3 py-2.5 whitespace-nowrap transition-colors ${
                  isActive ? 'bg-navy text-white' : 'text-navy/60 hover:bg-mist'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <main className="p-6 md:p-10 min-w-0">{children}</main>
      </div>
    </div>
  );
}
