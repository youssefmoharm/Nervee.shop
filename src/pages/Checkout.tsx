import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Loader2, Lock, Truck } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { orderService } from '../services/orderService'
import { EGYPT_GOVERNORATES } from '../data/governorates'
import { estimateShippingCost, getCheckoutSummary, getDeliveryEstimateLabel } from '../lib/checkout'

type Step = 1 | 2 | 3 | 4 | 5

const steps = ['Information', 'Shipping', 'Delivery', 'Payment', 'Confirmation']

interface FormState {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  governorate: string
  postal: string
  delivery: 'standard' | 'express'
  payment: 'cod' | 'card'
  discountCode: string
}

const initialForm: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  governorate: '',
  postal: '',
  delivery: 'standard',
  payment: 'cod',
  discountCode: '',
}

export default function Checkout() {
  const { lines, subtotal, clear } = useCart()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState('')

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email! }))
  }, [user])

  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const shippingCost = estimateShippingCost(subtotal, form.delivery)
  const { total } = getCheckoutSummary(subtotal, form.delivery)
  const deliveryEstimate = getDeliveryEstimateLabel(form.delivery, subtotal)

  const validateStep1 = () => {
    const e: typeof errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.'
    if (!form.firstName.trim()) e.firstName = 'Required.'
    if (!form.lastName.trim()) e.lastName = 'Required.'
    if (!/^[0-9+ ]{8,}$/.test(form.phone)) e.phone = 'Enter a valid phone number.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e: typeof errors = {}
    if (!form.address.trim()) e.address = 'Required.'
    if (!form.city.trim()) e.city = 'Required.'
    if (!form.governorate.trim()) e.governorate = 'Required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const placeOrder = async () => {
    setPlaceError(null)
    setPlacing(true)

    const { order, paymentUrl, error } = await orderService.placeOrder(
      {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        governorate: form.governorate,
        postalCode: form.postal || undefined,
        deliveryMethod: form.delivery,
        paymentMethod: form.payment,
        discountCode: form.discountCode || undefined,
      },
      lines
    )

    if (error || !order) {
      setPlacing(false)
      setPlaceError(error ?? 'We could not place your order. Please check your connection and try again.')
      return
    }

    if (form.payment === 'card' && paymentUrl) {
      // Hand off to Paymob's hosted card form — we never collect card
      // numbers ourselves. The Paymob webhook updates payment_status once
      // the transaction completes; the order is already reserved in "placed"
      // status so stock is held while the customer pays.
      window.location.href = paymentUrl
      return
    }

    setOrderNumber(order.order_number)
    setPlacing(false)
    setStep(5)
    clear()
  }

  const next = (e: FormEvent) => {
    e.preventDefault()
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step === 4) {
      void placeOrder()
      return
    }
    setErrors({})
    setStep((s) => (s + 1) as Step)
  }

  const back = () => setStep((s) => Math.max(1, s - 1) as Step)

  if (lines.length === 0 && step !== 5) {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 px-5 text-center">
        <h1 className="nv-heading text-4xl mb-4">Your bag is empty</h1>
        <Link to="/shop" className="nv-eyebrow underline">Continue Shopping</Link>
      </div>
    )
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8 pb-24">
      <div className="mx-auto max-w-5xl">
        {step !== 5 && (
          <>
            <Link to="/cart" className="inline-flex items-center gap-1 text-sm text-navy/50 hover:text-navy mb-6">
              <ChevronLeft size={16} /> Back to bag
            </Link>
            <div className="flex items-center gap-2 mb-10 overflow-x-auto">
              {steps.slice(0, 4).map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      step > i + 1 ? 'bg-navy text-white' : step === i + 1 ? 'border-2 border-navy' : 'border border-navy/20 text-navy/30'
                    }`}
                  >
                    {step > i + 1 ? <Check size={13} /> : i + 1}
                  </div>
                  <span className={`text-xs nv-eyebrow ${step === i + 1 ? 'text-navy' : 'text-navy/30'}`}>{label}</span>
                  {i < 3 && <div className="w-6 md:w-10 h-px bg-navy/15" />}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="grid md:grid-cols-3 gap-12">
          <form onSubmit={next} className="md:col-span-2">
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Customer Information</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  We keep your information secure and only use it to fulfill your order and send delivery updates.
                </div>
                <Field label="Email" error={errors.email}>
                  <input id="email" autoComplete="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls(!!errors.email)} placeholder="you@email.com" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" error={errors.firstName}>
                    <input id="firstName" autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls(!!errors.firstName)} />
                  </Field>
                  <Field label="Last Name" error={errors.lastName}>
                    <input id="lastName" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls(!!errors.lastName)} />
                  </Field>
                </div>
                <Field label="Phone" error={errors.phone}>
                  <input id="phone" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls(!!errors.phone)} placeholder="+20 1xx xxx xxxx" />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Shipping Address</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  We currently deliver across Egypt with the fastest available option for your governorate.
                </div>
                <Field label="Address" error={errors.address}>
                  <input id="address" autoComplete="street-address" value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls(!!errors.address)} placeholder="Street, building, apartment" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" error={errors.city}>
                    <input id="city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls(!!errors.city)} />
                  </Field>
                  <Field label="Governorate" error={errors.governorate}>
                    <select
                      id="governorate"
                      value={form.governorate}
                      onChange={(e) => set('governorate', e.target.value)}
                      className={inputCls(!!errors.governorate)}
                    >
                      <option value="">Select governorate</option>
                      {EGYPT_GOVERNORATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Postal Code (optional)">
                  <input id="postal" autoComplete="postal-code" value={form.postal} onChange={(e) => set('postal', e.target.value)} className={inputCls(false)} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="nv-heading text-3xl mb-4">Delivery Method</h2>
                <p className="text-sm text-navy/65">{deliveryEstimate}</p>
                {[
                  { id: 'standard', label: 'Standard Delivery', desc: '2–5 business days', price: subtotal > 2000 ? 0 : 100 },
                  { id: 'express', label: 'Express Delivery', desc: '1–2 business days', price: 200 },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center justify-between border p-5 cursor-pointer transition-colors ${
                      form.delivery === opt.id ? 'border-navy' : 'border-navy/15'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="radio"
                        name="delivery"
                        checked={form.delivery === opt.id}
                        onChange={() => set('delivery', opt.id)}
                        className="accent-navy w-4 h-4"
                      />
                      <div>
                        <p className="nv-edit font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs text-navy/50">{opt.desc}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{opt.price === 0 ? 'Free' : `EGP ${opt.price}`}</span>
                  </label>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Payment</h2>

                <label
                  className={`flex items-center justify-between border p-5 cursor-pointer transition-colors ${
                    form.payment === 'cod' ? 'border-navy' : 'border-navy/15'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input type="radio" name="payment" checked={form.payment === 'cod'} onChange={() => set('payment', 'cod')} className="accent-navy w-4 h-4" />
                    <div>
                      <p className="nv-edit font-semibold text-sm flex items-center gap-2"><Truck size={15} /> Cash on Delivery</p>
                      <p className="text-xs text-navy/50">Pay in cash when your order arrives.</p>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center justify-between border p-5 cursor-pointer transition-colors ${
                    form.payment === 'card' ? 'border-navy' : 'border-navy/15'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input type="radio" name="payment" checked={form.payment === 'card'} onChange={() => set('payment', 'card')} className="accent-navy w-4 h-4" />
                    <div>
                      <p className="nv-edit font-semibold text-sm flex items-center gap-2"><Lock size={13} /> Pay by Card</p>
                      <p className="text-xs text-navy/50">You&apos;ll be securely redirected to complete payment — we never see or store your card details.</p>
                    </div>
                  </div>
                </label>

                <Field label="Discount Code (optional)">
                  <input
                    id="discountCode"
                    value={form.discountCode}
                    onChange={(e) => set('discountCode', e.target.value.toUpperCase())}
                    className={inputCls(false)}
                    placeholder="NERVE10"
                  />
                </Field>
              </div>
            )}

            {step === 5 && orderNumber && (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-navy text-white flex items-center justify-center mx-auto mb-6">
                  <Check size={28} />
                </div>
                <h2 className="nv-heading text-4xl mb-3">Order Confirmed</h2>
                <p className="text-navy/60 mb-1">Thank you — your NERVE order is being prepared.</p>
                <p className="nv-eyebrow mt-4">Order #{orderNumber}</p>
                <Link
                  to="/shop"
                  className="inline-block mt-8 bg-navy text-white nv-eyebrow px-8 py-4 hover:bg-navy-2 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            )}

            {step !== 5 && (
              <div className="space-y-3 mt-8">
                {placeError && <p className="text-xs text-red-600" role="alert">{placeError}</p>}
                <div className="flex items-center gap-4">
                  {step > 1 && (
                    <button type="button" onClick={back} className="text-sm text-navy/50 hover:text-navy">
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={placing}
                    className="flex-1 bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {placing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Placing Order…
                      </>
                    ) : step === 4 ? (
                      'Place Order'
                    ) : (
                      'Continue'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {step !== 5 && (
            <div className="bg-mist/50 p-6 h-fit space-y-4 sticky top-24">
              <h3 className="nv-eyebrow">Order Summary</h3>
              <ul className="space-y-3 max-h-64 overflow-y-auto nv-scroll">
                {lines.map((l) => (
                  <li key={`${l.productId}-${l.color}-${l.size}`} className="flex gap-3 text-sm">
                    <div className="w-12 h-14 bg-mist flex-shrink-0 overflow-hidden relative">
                      <img src={l.image} alt={l.name} className="w-full h-full object-cover" />
                      <span className="absolute -top-1.5 -right-1.5 bg-navy text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                        {l.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase">{l.name}</p>
                      <p className="text-xs text-navy/50">{l.color} / {l.size}</p>
                    </div>
                    <span className="text-xs">EGP {(l.price * l.quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-navy/10 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-navy/60">Subtotal</span><span>EGP {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-navy/60">Shipping</span><span>{shippingCost === 0 ? 'Free' : `EGP ${shippingCost}`}</span></div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-navy/10"><span>Total</span><span>EGP {total.toLocaleString()}</span></div>
              </div>
              <p className="text-[11px] text-navy/40 pt-1">Final total (including any discount code) is confirmed by the server when your order is placed.</p>
              <div className="rounded-2xl border border-navy/10 bg-white p-3 text-[11px] text-navy/60">
                <div className="flex items-center gap-2"><Truck size={13} /> Fast delivery updates and secure payment protection.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full border ${hasError ? 'border-red-500' : 'border-navy/20'} px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors`
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy/60 mb-1.5 block">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  )
}
