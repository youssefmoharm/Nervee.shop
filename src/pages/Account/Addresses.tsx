import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Star, Trash2 } from 'lucide-react'
import { addressService, type Address } from '../../services/addressService'
import { EGYPT_GOVERNORATES } from '../../data/governorates'
import AccountLayout from './AccountLayout'

const emptyForm = { label: '', address: '', city: '', governorate: '', postal_code: '', is_default: false }

export default function Addresses() {
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => addressService.list().then(setAddresses)

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await addressService.create(form)
    setSaving(false)
    if (error) {
      setError(error)
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    load()
  }

  const remove = async (id: string) => {
    await addressService.remove(id)
    load()
  }

  const setDefault = async (id: string) => {
    await addressService.setDefault(id)
    load()
  }

  return (
    <AccountLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="nv-heading text-3xl">Addresses</h2>
        <button onClick={() => setShowForm((s) => !s)} className="nv-eyebrow underline text-sm">
          {showForm ? 'Cancel' : '+ Add Address'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-4 max-w-md mb-10 border border-navy/10 p-5">
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Label (e.g. Home, Work)</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Address</span>
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">City</span>
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Governorate</span>
              <select
                required
                value={form.governorate}
                onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              >
                <option value="">Select governorate</option>
                {EGYPT_GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Postal Code (optional)</span>
            <input
              value={form.postal_code}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Address'}
          </button>
        </form>
      )}

      {!addresses ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : addresses.length === 0 && !showForm ? (
        <p className="text-navy/60">No saved addresses yet.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between border border-navy/10 p-4">
              <div>
                <p className="nv-edit font-semibold text-sm flex items-center gap-2">
                  {a.label || 'Address'}
                  {a.is_default && <span className="nv-eyebrow text-[10px] text-navy/50">Default</span>}
                </p>
                <p className="text-sm text-navy/70 mt-1">{a.address}</p>
                <p className="text-sm text-navy/70">{a.city}, {a.governorate} {a.postal_code}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {!a.is_default && (
                  <button aria-label="Set as default" onClick={() => setDefault(a.id)} className="text-navy/40 hover:text-navy">
                    <Star size={16} />
                  </button>
                )}
                <button aria-label="Delete address" onClick={() => remove(a.id)} className="text-navy/40 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}
