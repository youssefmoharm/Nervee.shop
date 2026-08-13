import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { useSEO } from '../lib/seo';
import { EGYPT_GOVERNORATES } from '../data/governorates';
import { estimateShippingCost, getCheckoutSummary } from '../lib/checkout';

type Step = 1 | 2 | 3 | 4;

const steps = ['Information', 'Shipping', 'Delivery', 'Confirmation'];

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postal: string;
  delivery: 'standard' | 'express';
  discountCode: string;
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
  discountCode: '',
};

export default function Checkout() {
  useSEO({
    title: 'Checkout | NERVE',
    description:
      'Complete your NERVE order. Cash on delivery across Egypt — payment is due to the courier when your order arrives.',
  });
  const { lines, subtotal, clear } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState('');

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email! }));
  }, [user]);

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }));

  const shippingCost = estimateShippingCost(subtotal, form.delivery);
  const { total } = getCheckoutSummary(subtotal, form.delivery);

  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.firstName.trim()) e.firstName = 'Required.';
    if (!form.lastName.trim()) e.lastName = 'Required.';
    if (!/^[0-9+ ]{8,}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: typeof errors = {};
    if (!form.address.trim()) e.address = 'Required.';
    if (!form.city.trim()) e.city = 'Required.';
    if (!form.governorate.trim()) e.governorate = 'Required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    setPlaceError(null);
    setPlacing(true);

    const { order, error } = await orderService.placeOrder(
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
        paymentMethod: 'cod',
        discountCode: form.discountCode || undefined,
      },
      lines,
    );

    if (error || !order) {
      setPlacing(false);
      setPlaceError(
        error ?? 'We could not place your order. Please check your connection and try again.',
      );
      return;
    }

    setOrderNumber(order.order_number);
    setPlacing(false);
    setStep(4);
    clear();
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      void placeOrder();
      return;
    }
    setErrors({});
    setStep(s => (s + 1) as Step);
  };

  const back = () => setStep(s => Math.max(1, s - 1) as Step);

  if (lines.length === 0 && step !== 4) {
    return (
      <div
        className="bg-white text-navy min-h-screen pt-32 px-5 text-center"
        data-testid="empty-cart"
      >
        <h1 className="nv-heading text-4xl mb-4">Your bag is empty</h1>
        <Link to="/shop" className="nv-eyebrow underline">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-24 md:pt-28 px-5 md:px-8 pb-24">
      <div className="mx-auto max-w-5xl">
        {step !== 4 && (
          <>
            <Link
              to="/cart"
              className="inline-flex items-center gap-1 text-sm text-navy/50 hover:text-navy mb-6"
            >
              <ChevronLeft size={16} /> Back to bag
            </Link>
            <div className="flex items-center gap-2 mb-10 overflow-x-auto">
              {steps.slice(0, 3).map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      step > i + 1
                        ? 'bg-navy text-white'
                        : step === i + 1
                        ? 'border-2 border-navy'
                        : 'border border-navy/20 text-navy/30'
                    }`}
                  >
                    {step > i + 1 ? <Check size={13} /> : i + 1}
                  </div>
                  <span
                    className={`text-xs nv-eyebrow ${
                      step === i + 1 ? 'text-navy' : 'text-navy/30'
                    }`}
                  >
                    {label}
                  </span>
                  {i < 2 && <div className="w-6 md:w-10 h-px bg-navy/15" />}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="grid md:grid-cols-3 gap-12">
          <form onSubmit={next} className="md:col-span-2" data-testid="checkout-form">
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Customer Information</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  We keep your information secure and only use it to fulfill your order and send
                  delivery updates.
                </div>
                <Field label="Email" error={errors.email}>
                  <input
                    id="email"
                    autoComplete="email"
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    className={inputCls(!!errors.email)}
                    placeholder="you@email.com"
                    data-testid="email-input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" error={errors.firstName}>
                    <input
                      id="firstName"
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      className={inputCls(!!errors.firstName)}
                      data-testid="firstName-input"
                    />
                  </Field>
                  <Field label="Last Name" error={errors.lastName}>
                    <input
                      id="lastName"
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={e => set('lastName', e.target.value)}
                      className={inputCls(!!errors.lastName)}
                      data-testid="lastName-input"
                    />
                  </Field>
                </div>
                <Field label="Phone" error={errors.phone}>
                  <input
                    id="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    className={inputCls(!!errors.phone)}
                    placeholder="+20 1xx xxx xxxx"
                    data-testid="phone-input"
                  />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Shipping Address</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  We currently deliver across Egypt with the fastest available option for your
                  governorate.
                </div>
                <Field label="Address" error={errors.address}>
                  <input
                    id="address"
                    autoComplete="street-address"
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    className={inputCls(!!errors.address)}
                    placeholder="Street, building, apartment"
                    data-testid="address-input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" error={errors.city}>
                    <input
                      id="city"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className={inputCls(!!errors.city)}
                      data-testid="city-input"
                    />
                  </Field>
                  <Field label="Governorate" error={errors.governorate}>
                    <select
                      id="governorate"
                      data-testid="governorate-select"
                      value={form.governorate}
                      onChange={e => set('governorate', e.target.value)}
                      className={inputCls(!!errors.governorate)}
                    >
                      <option value="">Select governorate</option>
                      {EGYPT_GOVERNORATES.map(g => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Postal Code (optional)">
                  <input
                    id="postal"
                    autoComplete="postal-code"
                    value={form.postal}
                    onChange={e => set('postal', e.target.value)}
                    className={inputCls(false)}
                    data-testid="postal-input"
                  />
                </Field>
              </div>
            )}

            {step === 4 && orderNumber && (
              <div className="text-center py-10" data-testid="order-success">
                <div className="w-16 h-16 rounded-full bg-navy text-white flex items-center justify-center mx-auto mb-6">
                  <Check size={28} />
                </div>
                <h2 className="nv-heading text-4xl mb-3">Order Confirmed</h2>
                <p className="text-navy/60 mb-1">Thank you — your NERVE order is being prepared.</p>
                <p data-testid="order-number" className="nv-eyebrow mt-4">
                  Order #{orderNumber}
                </p>
                <Link
                  to="/shop"
                  className="inline-block mt-8 bg-navy text-white nv-eyebrow px-8 py-4 hover:bg-navy-2 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            )}

            {step !== 4 && (
              <div className="space-y-3 mt-8">
                {placeError && (
                  <p className="text-xs text-red-600" role="alert">
                    {placeError}
                  </p>
                )}
                <div className="flex items-center gap-4">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={back}
                      className="text-sm text-navy/50 hover:text-navy"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    data-testid="place-order-button"
                    disabled={placing}
                    className="flex-1 bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {placing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Placing Order…
                      </>
                    ) : (
                      'Place Order'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {step !== 4 && (
            <div className="bg-mist/50 p-6 h-fit space-y-4 sticky top-24">
              <h3 className="nv-eyebrow">Order Summary</h3>
              <ul className="space-y-3 max-h-64 overflow-y-auto nv-scroll">
                {lines.map(l => (
                  <li key={`${l.productId}-${l.color}-${l.size}`} className="flex gap-3 text-sm">
                    <div className="w-12 h-14 bg-mist flex-shrink-0 overflow-hidden relative">
                      <img src={l.image} alt={l.name} className="w-full h-full object-cover" />
                      <span className="absolute -top-1.5 -right-1.5 bg-navy text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                        {l.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase">{l.name}</p>
                      <p className="text-xs text-navy/50">
                        {l.color} / {l.size}
                      </p>
                    </div>
                    <span className="text-xs">EGP {(l.price * l.quantity).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-navy/10 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-navy/60">Subtotal</span>
                  <span>EGP {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy/60">Shipping</span>
                  <span>{shippingCost === 0 ? 'Free' : `EGP ${shippingCost}`}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-navy/10">
                  <span>Total</span>
                  <span>EGP {total.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[11px] text-navy/40 pt-1">
                Final total (including any discount code) is confirmed by the server when your order
                is placed.
              </p>
              <div className="rounded-2xl border border-navy/10 bg-white p-3 text-[11px] text-navy/60">
                <div className="flex items-center gap-2">
                  <Truck size={13} /> Fast delivery updates and secure payment protection.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full border ${
    hasError ? 'border-red-500' : 'border-navy/20'
  } px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy/60 mb-1.5 block">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}
