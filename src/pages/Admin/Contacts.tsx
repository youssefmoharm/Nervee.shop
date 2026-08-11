import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminService } from '../../services/adminService'
import { Loader2 } from 'lucide-react'

export default function Contacts() {
  const [messages, setMessages] = useState<any[] | null>(null)

  const load = () => adminService.listContactMessages().then((d) => setMessages(d))

  useEffect(() => {
    load()
  }, [])

  const setStatus = async (id: string, status: string) => {
    await adminService.updateContactMessageStatus(id, status)
    load()
  }

  if (!messages) return (
    <AdminLayout>
      <Loader2 className="animate-spin text-navy/40" size={20} />
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="nv-heading text-4xl">Contact Messages</h1>
      </div>

      {messages.length === 0 ? (
        <p className="text-navy/60">No messages</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="border border-navy/10 p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{m.name} — {m.email}</div>
                  <div className="text-xs text-navy/60">{new Date(m.created_at).toLocaleString()}</div>
                </div>
                <div className="nv-eyebrow text-xs text-navy/60">{m.status}</div>
              </div>
              <p className="mt-3 text-sm text-navy/70">{m.message}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setStatus(m.id, 'read')} className="px-3 py-1 text-xs bg-mist">Mark Read</button>
                <button onClick={() => setStatus(m.id, 'replied')} className="px-3 py-1 text-xs bg-mist">Mark Replied</button>
                <button onClick={() => setStatus(m.id, 'archived')} className="px-3 py-1 text-xs bg-mist">Archive</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
