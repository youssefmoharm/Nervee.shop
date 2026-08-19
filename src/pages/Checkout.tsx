import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, Truck, DollarSign, CreditCard, Package } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { discountService, type DiscountCode } from '../services/discountService';
import { useSEO } from '../lib/seo';
import { useToast } from '../context/ToastContext';
import { EGYPT_GOVERNORATES } from '../data/governorates';
import { estimateShippingCost, getCheckoutSummary } from '../lib/checkout';

type Step = 1 | 2 | 3 | 4 | 5;

const steps = ['Information', 'Shipping', 'Delivery', 'Payment', 'Confirmation'];

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
  paymentMethod: 'cod' | 'card';
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
  paymentMethod: 'cod',
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
  const { showToast } = useToast();
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discount: DiscountCode;
  } | null>(null);

  useEffect(() => {
    if (user?.email) setForm(f => ({ ...f, email: user.email! }));
  }, [user]);

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }));

  const shippingCost = estimateShippingCost(subtotal, form.delivery);
  const { total } = getCheckoutSummary(subtotal, form.delivery);

  // Calculate final amount with discount
  const discountAmount = appliedDiscount
    ? discountService.calculateDiscount(appliedDiscount.discount, subtotal)
    : 0;
  const finalTotal = total - discountAmount;

  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.firstName.trim()) e.firstName = 'Required.';
    if (!form.lastName.trim()) e.lastName = 'Required.';
    // Validate Egyptian phone numbers: +201xxxxxxxxx or 01xxxxxxxxx (11 digits total)
    const phoneRegex = /^(\+20)?01[0-9]{9}$/;
    if (!phoneRegex.test(form.phone.replace(/\s/g, '')))
      e.phone = 'Enter a valid Egyptian phone number (e.g., 01012345678).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleApplyDiscount = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.discountCode.trim()) {
      showToast('Please enter a discount code', 'error', 3000);
      return;
    }

    const result = await discountService.validate(form.discountCode.trim(), subtotal);

    if (!result.valid || !result.discount) {
      showToast(result.error || 'Please check your code and try again', 'error', 3000);
      setAppliedDiscount(null);
      return;
    }

    setAppliedDiscount({
      code: result.discount.code,
      discount: result.discount,
    });
    showToast(`You saved ${discountAmount / 100} EGP`, 'success', 3000);
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setForm(f => ({ ...f, discountCode: '' }));
    showToast('Order total has been updated', 'success', 3000);
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
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
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
    setStep(5);
    clear();
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      setErrors({});
      setStep(4);
      return;
    }
    if (step === 4) {
      void placeOrder();
      return;
    }
    setErrors({});
    setStep(s => (s + 1) as Step);
  };

  const back = () => setStep(s => Math.max(1, s - 1) as Step);

  if (lines.length === 0 && step !== 5) {
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
              {steps.slice(0, 4).map((label, i) => (
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
                  {i < 3 && <div className="w-6 md:w-10 h-px bg-navy/15" />}
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

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Delivery & Payment</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  Choose your delivery speed and preferred payment method. We deliver across Egypt
                  with the fastest available option for your governorate.
                </div>

                <div>
                  <h3 className="text-sm font-medium text-navy mb-3">Delivery Method</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-4 border border-navy/20 rounded-lg hover:border-navy/50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="delivery"
                        value="standard"
                        checked={form.delivery === 'standard'}
                        onChange={e => set('delivery', e.target.value as 'standard' | 'express')}
                        className="w-4 h-4 text-navy"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-navy">Standard Delivery</p>
                        <p className="text-xs text-navy/60">3-5 business days</p>
                      </div>
                      <span className="text-sm font-semibold text-navy">
                        EGP {estimateShippingCost(subtotal, 'standard')}
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-4 border border-navy/20 rounded-lg hover:border-navy/50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="delivery"
                        value="express"
                        checked={form.delivery === 'express'}
                        onChange={e => set('delivery', e.target.value as 'standard' | 'express')}
                        className="w-4 h-4 text-navy"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-navy">Express Delivery</p>
                        <p className="text-xs text-navy/60">1-2 business days</p>
                      </div>
                      <span className="text-sm font-semibold text-navy">
                        EGP {estimateShippingCost(subtotal, 'express')}
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-navy mb-3">Payment Method</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-4 border-2 border-navy/20 rounded-lg hover:border-navy/50 cursor-pointer transition-colors has-[:checked]:border-navy has-[:checked]:bg-mist/30">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={form.paymentMethod === 'cod'}
                        onChange={e => set('paymentMethod', e.target.value as 'cod' | 'card')}
                        className="w-4 h-4 text-navy"
                      />
                      <div className="flex-1 flex items-start gap-3">
                        <DollarSign size={18} className="text-navy mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-navy">Cash on Delivery</p>
                          <p className="text-xs text-navy/60">
                            Pay to the courier when your order arrives
                          </p>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 border-2 border-navy/20 rounded-lg hover:border-navy/50 cursor-pointer transition-colors opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        disabled
                        className="w-4 h-4 text-navy"
                      />
                      <div className="flex-1 flex items-start gap-3">
                        <CreditCard size={18} className="text-navy/40 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-navy/40">Card Payment</p>
                          <p className="text-xs text-navy/40">Coming soon</p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">✓ Order Protected</span> — Your order is secured
                    with our buyer protection guarantee.
                  </p>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="nv-heading text-3xl mb-4">Review Your Order</h2>
                <div className="rounded-2xl border border-navy/10 bg-mist/20 p-4 text-sm text-navy/70">
                  Please review all details before placing your order. You can go back to make any
                  changes.
                </div>

                <div className="space-y-4">
                  <div className="p-4 border border-navy/10 rounded-lg">
                    <h3 className="text-sm font-medium text-navy/60 mb-2">Contact Information</h3>
                    <p className="text-sm text-navy">
                      {form.firstName} {form.lastName}
                    </p>
                    <p className="text-sm text-navy/60">{form.email}</p>
                    <p className="text-sm text-navy/60">{form.phone}</p>
                  </div>

                  <div className="p-4 border border-navy/10 rounded-lg">
                    <h3 className="text-sm font-medium text-navy/60 mb-2">Shipping Address</h3>
                    <p className="text-sm text-navy">{form.address}</p>
                    <p className="text-sm text-navy/60">
                      {form.city}, {form.governorate}
                    </p>
                    {form.postal && (
                      <p className="text-sm text-navy/60">Postal Code: {form.postal}</p>
                    )}
                  </div>

                  <div className="p-4 border border-navy/10 rounded-lg">
                    <h3 className="text-sm font-medium text-navy/60 mb-3">Delivery & Payment</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-navy" />
                        <span className="text-navy">
                          {form.delivery === 'standard' ? 'Standard' : 'Express'} Delivery
                        </span>
                        <span className="ml-auto text-navy/60">
                          EGP {estimateShippingCost(subtotal, form.delivery)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-navy" />
                        <span className="text-navy">Cash on Delivery</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && orderNumber && (
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

            {step !== 5 && (
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
                    ) : step === 4 ? (
                      'Place Order'
                    ) : (
                      'Continue to Next Step'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {step !== 5 && (
            <div className="bg-white border border-navy/10 rounded-2xl h-fit sticky top-24 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-gradient-to-r from-navy to-navy-2 px-6 py-4">
                <h3 className="text-white nv-eyebrow flex items-center gap-2">
                  <Package size={16} />
                  Order Summary
                </h3>
              </div>

              {/* Items */}
              <div className="p-6 space-y-4">
                <ul className="space-y-3 max-h-64 overflow-y-auto nv-scroll">
                  {lines.map(l => (
                    <li
                      key={`${l.productId}-${l.color}-${l.size}`}
                      className="flex gap-3 pb-3 border-b border-navy/5 last:border-0"
                    >
                      <div className="w-14 h-16 bg-mist flex-shrink-0 overflow-hidden rounded-lg relative">
                        <img src={l.image} alt={l.name} className="w-full h-full object-cover" />
                        <span className="absolute -top-2 -right-2 bg-navy text-white text-[10px] font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                          {l.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold uppercase text-navy truncate">
                          {l.name}
                        </p>
                        <p className="text-xs text-navy/50 mt-0.5">
                          {l.color} / {l.size}
                        </p>
                        <p className="text-xs text-navy/40 mt-1">
                          EGP {l.price.toLocaleString()} × {l.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-navy whitespace-nowrap">
                        EGP {(l.price * l.quantity).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Divider */}
              <div className="mx-6 border-t border-navy/10" />

              {/* Pricing */}
              <div className="px-6 py-4 space-y-3 text-sm">
                <div className="flex justify-between items-center text-navy/60">
                  <span>Subtotal</span>
                  <span className="font-medium text-navy">EGP {subtotal.toLocaleString()}</span>
                </div>

                {appliedDiscount && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Discount ({appliedDiscount.code})</span>
                    <span className="font-medium">-EGP {discountAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-navy/60">
                  <span>Shipping</span>
                  <span className="font-medium text-navy">
                    {shippingCost === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      `EGP ${shippingCost}`
                    )}
                  </span>
                </div>

                {/* Total */}
                <div className="pt-3 border-t border-navy/10 flex justify-between items-center">
                  <span className="font-semibold text-navy">Total</span>
                  <span className="text-lg font-bold text-navy">
                    EGP {finalTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Discount Code Section */}
              <div className="mx-6 mb-6">
                <div className="rounded-lg border border-navy/10 bg-mist/30 p-4">
                  <p className="text-[11px] font-semibold text-navy/70 mb-3 uppercase tracking-wide">
                    Discount Code
                  </p>
                  {appliedDiscount ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium bg-green-50 text-green-700 px-3 py-2 rounded border border-green-200">
                        {appliedDiscount.code}
                      </span>
                      <button
                        onClick={handleRemoveDiscount}
                        className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyDiscount} className="flex gap-2">
                      <input
                        type="text"
                        value={form.discountCode}
                        onChange={e => setForm(f => ({ ...f, discountCode: e.target.value }))}
                        placeholder="Enter code"
                        className="flex-1 border border-navy/20 px-3 py-2 text-xs rounded focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/20 transition-colors"
                      />
                      <button
                        type="submit"
                        className="bg-navy text-white px-4 py-2 text-xs font-medium rounded hover:bg-navy-2 transition-colors"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-mist/30 border-t border-navy/10 px-6 py-3 text-[11px] text-navy/60 flex items-start gap-2">
                <Truck size={14} className="flex-shrink-0 mt-0.5 text-navy/50" />
                <span>
                  <span className="font-semibold text-navy/80">Fast delivery updates</span> and
                  secure payment protection.
                </span>
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
