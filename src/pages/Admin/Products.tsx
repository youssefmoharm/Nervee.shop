import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { adminService } from '../../services/adminService'
import AdminLayout from './AdminLayout'

interface ProductRow {
  id: string
  name: string
  slug: string
  category: string
  price: number
  is_active: boolean
  is_best_seller: boolean
  product_inventory: { size: string; stock_quantity: number }[]
}

export default function Products() {
  const [products, setProducts] = useState<ProductRow[] | null>(null)

  const load = () => adminService.listProducts().then((data) => setProducts(data as ProductRow[]))

  useEffect(() => {
    load()
  }, [])

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return
    await adminService.deleteProduct(id)
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="nv-heading text-4xl">Products</h1>
        <Link to="/admin/products/new" className="bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors">
          + New Product
        </Link>
      </div>

      {!products ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Name</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Category</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Price</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Total Stock</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {products.map((p) => {
                const totalStock = (p.product_inventory ?? []).reduce((sum, i) => sum + i.stock_quantity, 0)
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-navy/70">{p.category}</td>
                    <td className="px-4 py-3">EGP {p.price.toLocaleString()}</td>
                    <td className={`px-4 py-3 ${totalStock <= 10 ? 'text-red-600' : 'text-navy/70'}`}>{totalStock}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <Link to={`/admin/products/${p.id}`} aria-label="Edit" className="text-navy/50 hover:text-navy">
                          <Pencil size={15} />
                        </Link>
                        <button aria-label="Delete" onClick={() => remove(p.id, p.name)} className="text-navy/50 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
