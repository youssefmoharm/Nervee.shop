import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const links = [
  { to: '/account', label: 'Profile', end: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/wishlist', label: 'Wishlist' },
]

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8 pb-24">
      <div className="mx-auto max-w-5xl grid md:grid-cols-[200px_1fr] gap-10">
        <aside>
          <h1 className="nv-heading text-3xl mb-6">Account</h1>
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {links.map((l) => (
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
            <button
              onClick={() => signOut()}
              className="nv-eyebrow px-3 py-2.5 text-left text-navy/60 hover:bg-mist transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
