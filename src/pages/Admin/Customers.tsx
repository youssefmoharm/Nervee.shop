import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

interface Customer {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null)

  useEffect(() => {
    adminService.listCustomers().then((data) => setCustomers(data as Customer[]))
  }, [])

  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-8">Customers</h1>

      {!customers ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : customers.length === 0 ? (
        <p className="text-navy/60">No customers yet.</p>
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Name</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Email</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Phone</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/admin/customers/${c.id}`} className="text-navy hover:underline">
                        {c.first_name || c.last_name ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy/70">{c.email}</td>
                    <td className="px-4 py-3 text-navy/70">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-navy/70">
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
