import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const CartContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const key = `${action.item.id}-${action.item.size}-${action.item.color}`
      const existing = state.items.find((i) => i.key === key)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.key === key ? { ...i, qty: i.qty + action.item.qty } : i
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.item, key }] }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.key !== action.key) }
    case 'QTY':
      return {
        ...state,
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, qty: Math.max(1, action.qty) } : i
        ),
      }
    case 'CLEAR':
      return { ...state, items: [] }
    case 'OPEN':
      return { ...state, open: true }
    case 'CLOSE':
      return { ...state, open: false }
    case 'TOGGLE':
      return { ...state, open: !state.open }
    default:
      return state
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem('nerve-cart')
    if (!raw) return { items: [], open: false }
    const parsed = JSON.parse(raw)
    return { items: Array.isArray(parsed.items) ? parsed.items : [], open: false }
  } catch {
    return { items: [], open: false }
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadCart)

  useEffect(() => {
    localStorage.setItem('nerve-cart', JSON.stringify({ items: state.items }))
  }, [state.items])

  const value = useMemo(() => {
    const count = state.items.reduce((n, i) => n + i.qty, 0)
    const subtotal = state.items.reduce((n, i) => n + i.price * i.qty, 0)
    return {
      items: state.items,
      open: state.open,
      count,
      subtotal,
      add: (item) => dispatch({ type: 'ADD', item }),
      remove: (key) => dispatch({ type: 'REMOVE', key }),
      setQty: (key, qty) => dispatch({ type: 'QTY', key, qty }),
      clear: () => dispatch({ type: 'CLEAR' }),
      openCart: () => dispatch({ type: 'OPEN' }),
      closeCart: () => dispatch({ type: 'CLOSE' }),
      toggleCart: () => dispatch({ type: 'TOGGLE' }),
    }
  }, [state])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
