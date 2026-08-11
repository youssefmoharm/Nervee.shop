import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

const CATEGORIES = ['T-Shirts', 'Hoodies', 'Pants', 'Denim', 'Tops', 'Jackets', 'Caps', 'Accessories']
const BADGES = ['', 'NEW', 'BEST SELLER', 'LIMITED', 'SALE', 'RESTOCKED']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

interface ColorRow {
  name: string
  hex: string
  image: string
  hover_image: string
}

interface Collection {
  id: string
  name: string
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ProductForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [collectionId, setCollectionId] = useState('')
  const [price, setPrice] = useState('')
  const [compareAtPrice, setCompareAtPrice] = useState('')
  const [badge, setBadge] = useState('')
  const [isBestSeller, setIsBestSeller] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState('')
  const [material, setMaterial] = useState('')
  const [care, setCare] = useState('')
  const [colors, setColors] = useState<ColorRow[]>([{ name: '', hex: '#061735', image: '', hover_image: '' }])
  const [inventory, setInventory] = useState<Record<string, number>>(
    Object.fromEntries(SIZES.map((s) => [s, 0]))
  )
  const [initialInventory, setInitialInventory] = useState<Record<string, number>>(
    Object.fromEntries(SIZES.map((s) => [s, 0]))
  )

  useEffect(() => {
    supabase
      .from('collections')
      .select('id, name')
      .then(({ data }) => setCollections(data ?? []))
  }, [])

  useEffect(() => {
    if (isNew || !id) return
    supabase
      .from('products')
      .select('*, product_colors(*), product_inventory(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) {
          setLoading(false)
          return
        }
        setName(data.name)
        setCategory(data.category)
        setCollectionId(data.collection_id ?? '')
        setPrice(String(data.price))
        setCompareAtPrice(data.compare_at_price ? String(data.compare_at_price) : '')
        setBadge(data.badge ?? '')
        setIsBestSeller(!!data.is_best_seller)
        setIsActive(data.is_active !== false)
        setDescription(data.description)
        setMaterial(data.material)
        setCare((data.care ?? []).join('\n'))
        if (data.product_colors?.length) {
          setColors(
            data.product_colors.map((c: any) => ({
              name: c.name,
              hex: c.hex,
              image: c.image,
              hover_image: c.hover_image ?? '',
            }))
          )
        }
        const inv: Record<string, number> = Object.fromEntries(SIZES.map((s) => [s, 0]))
        for (const row of data.product_inventory ?? []) inv[row.size] = row.stock_quantity
        setInventory(inv)
        setInitialInventory(inv)
        setLoading(false)
      })
  }, [id, isNew])

  const updateColor = (i: number, patch: Partial<ColorRow>) =>
    setColors((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const productId = isNew ? slugify(name) : id!
    const productPayload = {
      id: productId,
      slug: slugify(name),
      name,
      category,
      collection_id: collectionId || null,
      price: Number(price),
      compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
      currency: 'EGP',
      badge: badge || null,
      is_best_seller: isBestSeller,
      is_active: isActive,
      description,
      material,
      care: care.split('\n').map((s) => s.trim()).filter(Boolean),
    }

    const result = isNew
      ? await adminService.createProduct(productPayload)
      : await adminService.updateProduct(productId, productPayload)

    if (result.error) {
      setSaving(false)
      setError(result.error)
      return
    }

    // Replace colors
    await supabase.from('product_colors').delete().eq('product_id', productId)
    const validColors = colors.filter((c) => c.name && c.image)
    if (validColors.length) {
      await supabase.from('product_colors').insert(
        validColors.map((c, i) => ({
          product_id: productId,
          name: c.name,
          hex: c.hex,
          image: c.image,
          hover_image: c.hover_image || null,
          sort_order: i,
        }))
      )
    }

    // Upsert inventory rows for every size
    await supabase.from('product_inventory').upsert(
      SIZES.map((size) => ({
        product_id: productId,
        size,
        stock_quantity: inventory[size] ?? 0,
        in_stock: (inventory[size] ?? 0) > 0,
      })),
      { onConflict: 'product_id,size' }
    )

    // Notify anyone waiting on a size that just came back into stock.
    for (const size of SIZES) {
      const wasOut = (initialInventory[size] ?? 0) <= 0
      const nowIn = (inventory[size] ?? 0) > 0
      if (wasOut && nowIn) void adminService.triggerRestockCheck(productId, size)
    }

    setSaving(false)
    navigate('/admin/products')
  }

  if (loading) {
    return (
      <AdminLayout>
        <Loader2 className="animate-spin text-navy/40" size={20} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-8">{isNew ? 'New Product' : 'Edit Product'}</h1>

      <form onSubmit={onSubmit} className="space-y-8 max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Collection</span>
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            >
              <option value="">None</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Badge</span>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            >
              {BADGES.map((b) => (
                <option key={b} value={b}>
                  {b || 'None'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Price (EGP)</span>
            <input
              required
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Compare-at Price (optional)</span>
            <input
              type="number"
              min={0}
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} className="accent-navy" />
            Best Seller
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-navy" />
            Published (visible on the storefront)
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-navy/60 mb-1.5 block">Description</span>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-navy/60 mb-1.5 block">Material</span>
          <input
            required
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-navy/60 mb-1.5 block">Care Instructions (one per line)</span>
          <textarea
            rows={3}
            value={care}
            onChange={(e) => setCare(e.target.value)}
            className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
          />
        </label>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="nv-eyebrow text-xs text-navy/50">Colors</span>
            <button
              type="button"
              onClick={() => setColors((prev) => [...prev, { name: '', hex: '#061735', image: '', hover_image: '' }])}
              className="text-navy/60 hover:text-navy flex items-center gap-1 text-xs"
            >
              <Plus size={14} /> Add color
            </button>
          </div>
          <div className="space-y-3">
            {colors.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_2fr_2fr_auto] gap-2 items-center">
                <input
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => updateColor(i, { name: e.target.value })}
                  className="border border-navy/20 px-2 py-2 text-xs"
                />
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => updateColor(i, { hex: e.target.value })}
                  className="border border-navy/20 h-9 w-full"
                />
                <input
                  placeholder="Image URL"
                  value={c.image}
                  onChange={(e) => updateColor(i, { image: e.target.value })}
                  className="border border-navy/20 px-2 py-2 text-xs"
                />
                <input
                  placeholder="Hover image URL (optional)"
                  value={c.hover_image}
                  onChange={(e) => updateColor(i, { hover_image: e.target.value })}
                  className="border border-navy/20 px-2 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setColors((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-navy/40 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-navy/40 mt-2">
            Upload images to the <code>product-images</code> Supabase Storage bucket first, then paste the public URL
            here (path convention: <code>products/&#123;slug&#125;/&#123;color&#125;/01-front.jpg</code>).
          </p>
        </div>

        <div>
          <span className="nv-eyebrow text-xs text-navy/50 mb-3 block">Inventory by Size</span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {SIZES.map((size) => (
              <label key={size} className="block">
                <span className="text-xs text-navy/60 mb-1 block">{size}</span>
                <input
                  type="number"
                  min={0}
                  value={inventory[size]}
                  onChange={(e) => setInventory((prev) => ({ ...prev, [size]: Number(e.target.value) }))}
                  className="w-full border border-navy/20 px-2 py-2 text-sm focus:outline-none focus:border-navy"
                />
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Product'}
        </button>
      </form>
    </AdminLayout>
  )
}
