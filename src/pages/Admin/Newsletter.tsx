import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminService } from '../../services/adminService'
import { Loader2 } from 'lucide-react'

export default function Newsletter() {
  const [subs, setSubs] = useState<any[] | null>(null)

  useEffect(() => {
    adminService.listNewsletterSubscribers().then((d) => setSubs(d))
  }, [])

  if (!subs) return (
    <AdminLayout>
      <Loader2 className="animate-spin text-navy/40" size={20} />
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-6">Newsletter Subscribers</h1>
      {subs.length === 0 ? (
        <p className="text-navy/60">No subscribers</p>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <div key={s.email} className="border border-navy/10 p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{s.email}</div>
                <div className="text-xs text-navy/60">{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
