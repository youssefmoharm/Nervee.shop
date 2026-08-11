import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CartLine } from '../types'
import { useAuth } from './AuthContext'
import { cartService } from '../services/cartService'

interface CartContextValue {
  lines: CartLine[]
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addLine: (line: CartLine) => void
  removeLine: (productId: string, color: string, size: string) => void
  updateQuantity: (productId: string, color: string, size: string, quantity: number) => void
  clear: () => void
  subtotal: number
  count: number
  lastAdded: CartLine | null
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'nerve.cart'

function readGuestCart(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

/**
 * Guests: cart lives in sessionStorage only.
 * Signed-in customers: cart is mirrored to the `carts`/`cart_items` tables so
 * it survives across devices/sessions. The moment someone logs in, whatever
 * was sitting in their guest (sessionStorage) cart is merged into their DB
 * cart exactly once, then sessionStorage is cleared and the DB becomes the
 * source of truth for the rest of the session.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [lines, setLines] = useState<CartLine[]>(() => readGuestCart())
  const [isOpen, setIsOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<CartLine | null>(null)
  const mergedForUser = useRef<string | null>(null)

  // Persist guest cart to sessionStorage whenever it changes (skipped once
  // a user is signed in — DB is the source of truth then).
  useEffect(() => {
    if (user) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [lines, user])

  // On sign-in: merge the guest cart into the DB cart once, then load the
  // authoritative DB cart. On sign-out: fall back to (now-empty) guest cart.
  useEffect(() => {
    if (!user) {
      mergedForUser.current = null
      return
    }
    if (mergedForUser.current === user.id) return
    mergedForUser.current = user.id

    const guestLines = readGuestCart()

    ;(async () => {
      if (guestLines.length > 0) {
        await cartService.mergeGuestCart(guestLines)
        sessionStorage.removeItem(STORAGE_KEY)
      }
      const dbLines = await cartService.fetchMine()
      setLines(dbLines)
    })()
  }, [user])

  const addLine = (line: CartLine) => {
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.productId === line.productId && l.color === line.color && l.size === line.size
      )
      if (idx > -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity }
        return next
      }
      return [...prev, line]
    })
    setLastAdded(line)
    setIsOpen(true)
    if (user) void cartService.upsertLine(line)
  }

  const removeLine = (productId: string, color: string, size: string) => {
    setLines((prev) =>
      prev.filter((l) => !(l.productId === productId && l.color === color && l.size === size))
    )
    if (user) void cartService.removeLine(productId, color, size)
  }

  const updateQuantity = (productId: string, color: string, size: string, quantity: number) => {
    const safeQuantity = Math.max(1, quantity)
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId && l.color === color && l.size === size
          ? { ...l, quantity: safeQuantity }
          : l
      )
    )
    if (user) void cartService.updateQuantity(productId, color, size, safeQuantity)
  }

  const clear = () => {
    setLines([])
    if (user) void cartService.clear()
    else sessionStorage.removeItem(STORAGE_KEY)
  }

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.quantity, 0), [lines])
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines])

  return (
    <CartContext.Provider
      value={{
        lines,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addLine,
        removeLine,
        updateQuantity,
        clear,
        subtotal,
        count,
        lastAdded,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
