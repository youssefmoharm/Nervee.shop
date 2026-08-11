import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

interface Discount {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  minimum_purchase: number | null
  usage_limit: number | null
  usage_count: number
  valid_until: string | null
  is_active: boolean
}

const emptyForm = {
  code: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '',
  minimum_purchase: '',
  usage_limit: '',
  valid_until: '',
}

export default function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => adminService.listDiscounts().then((data) => setDiscounts(data as Discount[]))

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await adminService.createDiscount({
      code: form.code,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      minimum_purchase: form.minimum_purchase ? Number(form.minimum_purchase) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      is_active: true,
    })
    setSaving(false)
    if (error) {
      setError(error)
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  const toggleActive = async (d: Discount) => {
    await adminService.updateDiscount(d.id, { is_active: !d.is_active })
    load()
  }

  const remove = async (id: string, code: string) => {
    if (!confirm(`Delete code "${code}"?`)) return
    await adminService.deleteDiscount(id)
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="nv-heading text-4xl">Discount Codes</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 max-w-lg mb-10 border border-navy/10 p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Code</span>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="NERVE10"
                className="w-full border border-navy/20 px-4 py-3 text-sm uppercase focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Type</span>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off (EGP)</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">
              {form.discount_type === 'percentage' ? 'Percentage (e.g. 15)' : 'Amount off (EGP)'}
            </span>
            <input
              required
              type="number"
              min={1}
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Description (internal note)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Min. Purchase (optional)</span>
              <input
                type="number"
                min={0}
                value={form.minimum_purchase}
                onChange={(e) => setForm({ ...form, minimum_purchase: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Usage Limit (optional)</span>
              <input
                type="number"
                min={1}
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Expires (optional)</span>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Create Code
          </button>
        </form>
      )}

      {!discounts ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : discounts.length === 0 ? (
        <p className="text-navy/60">No discount codes yet.</p>
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Code</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Discount</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Uses</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Expires</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Active</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono font-medium">{d.code}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {d.discount_type === 'percentage' ? `${d.discount_value}%` : `EGP ${d.discount_value}`}
                    {d.minimum_purchase ? ` (min EGP ${d.minimum_purchase})` : ''}
                  </td>
                  <td className="px-4 py-3 text-navy/70">
                    {d.usage_count}
                    {d.usage_limit ? ` / ${d.usage_limit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-navy/70">
                    {d.valid_until ? new Date(d.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(d)}
                      className={`nv-eyebrow text-[10px] px-2.5 py-1 ${d.is_active ? 'bg-navy text-white' : 'bg-mist text-navy/50'}`}
                    >
                      {d.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button aria-label="Delete" onClick={() => remove(d.id, d.code)} className="text-navy/40 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
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
