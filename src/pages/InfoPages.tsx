import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { contactService } from '../services/contactService';
import { useSEO } from '../lib/seo';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="nv-heading text-5xl mb-8">{title}</h1>
        <div className="text-navy/70 leading-relaxed space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function Contact() {
  useSEO({
    title: 'Contact Us | NERVE',
    description:
      'Get in touch with NERVE. Questions about your order, shipping, or returns? Our team is here to help.',
  });
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const { error } = await contactService.send(form);
    if (error) {
      setStatus('error');
      return;
    }
    setStatus('success');
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <Shell title="Contact">
      <p>
        Have a question about an order, a product, or a collaboration? We&apos;d love to hear from
        you.
      </p>
      <p>Email: hello@nerve-store.com</p>
      <p>Instagram / TikTok: @nerve</p>
      <p>Customer care hours: Sunday – Thursday, 10:00 – 18:00 Cairo time.</p>

      {status === 'success' ? (
        <p className="nv-eyebrow text-navy pt-4">
          Message sent — we&apos;ll get back to you shortly.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4 pt-6 not-prose">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Name</span>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Subject</span>
            <input
              required
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">Message</span>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          {status === 'error' && (
            <p className="text-xs text-red-600">
              Something went wrong. Please try again or email us directly.
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            Send Message
          </button>
        </form>
      )}
    </Shell>
  );
}

export function Shipping() {
  useSEO({
    title: 'Shipping & Delivery | NERVE',
    description:
      'Standard and express delivery across Egypt. Free standard shipping on orders over EGP 2,000. Cash on delivery available.',
  });
  return (
    <Shell title="Shipping">
      <p>Standard delivery: 2–5 business days across Egypt. Free on orders over EGP 2,000.</p>
      <p>Express delivery: 1–2 business days, EGP 200.</p>
      <p>
        Orders are processed within 24 hours on business days. You&apos;ll receive a tracking link
        by email once your order ships.
      </p>
    </Shell>
  );
}

export function Returns() {
  useSEO({
    title: 'Returns & Exchanges | NERVE',
    description:
      'Unworn items with tags can be returned within 14 days of delivery for a full refund. See our returns policy.',
  });
  return (
    <Shell title="Returns">
      <p>
        Unworn items with tags attached can be returned within 14 days of delivery for a full
        refund.
      </p>
      <p>To start a return, contact hello@nerve-store.com with your order number.</p>
      <p>Sale and limited/archive items are final sale unless faulty.</p>
    </Shell>
  );
}

export function Privacy() {
  useSEO({
    title: 'Privacy Policy | NERVE',
    description:
      'How NERVE collects, uses, and protects your personal information. Read our privacy policy.',
  });
  return (
    <Shell title="Privacy Policy">
      <p>
        Last updated: 2026. NERVE (we, us) operates nerve-store.com. This page explains what we
        collect and why.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">What we collect</h2>
      <p>
        Account details (name, email, phone) when you register or check out; order and shipping
        information; and, if you contact us, whatever you share in that message. We accept Cash on
        Delivery, so we never collect or store payment card details.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">How we use it</h2>
      <p>
        To process and ship orders, provide customer support, send transactional emails (order
        confirmations, shipping updates), and, only if you opt in, send our newsletter. We
        don&apos;t sell your personal data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Who we share it with</h2>
      <p>
        Service providers who help us run the store: Supabase (hosting/database), Resend
        (transactional email), and delivery couriers, each only with what they need to do their job.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Your rights</h2>
      <p>
        You can view and edit your profile and addresses any time from your account, or email
        hello@nerve-store.com to request a copy or deletion of your data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Cookies</h2>
      <p>
        We use essential cookies/local storage to keep you signed in and remember your cart. We
        don&apos;t use third-party advertising trackers.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Contact</h2>
      <p>Questions about this policy: hello@nerve-store.com.</p>
    </Shell>
  );
}

export function Terms() {
  useSEO({
    title: 'Terms of Service | NERVE',
    description: 'The terms governing use of nerve-store.com and purchases from NERVE.',
  });
  return (
    <Shell title="Terms of Service">
      <p>
        Last updated: 2026. By using nerve-store.com or placing an order, you agree to these terms.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Orders & pricing</h2>
      <p>
        All prices are in EGP and include applicable taxes unless stated otherwise. We reserve the
        right to refuse or cancel an order — for example if an item is mispriced, out of stock, or
        we suspect fraud — in which case we&apos;ll notify you and refund any payment taken.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Payment</h2>
      <p>
        We accept Cash on Delivery. For Cash on Delivery, payment is due in full to the courier on
        delivery.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Shipping</h2>
      <p>
        See our{' '}
        <a href="/shipping" className="underline">
          Shipping
        </a>{' '}
        page for delivery times and costs. Delivery estimates are not guaranteed and may be affected
        by courier delays outside our control.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Returns & refunds</h2>
      <p>
        See our{' '}
        <a href="/returns" className="underline">
          Returns
        </a>{' '}
        page. Refunds are issued to the original payment method (or, for Cash on Delivery orders, by
        bank transfer) within a reasonable time after we receive and inspect the returned item.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Accounts</h2>
      <p>
        You&apos;re responsible for keeping your account credentials secure. Let us know immediately
        at hello@nerve-store.com if you believe your account has been compromised.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Intellectual property</h2>
      <p>
        All NERVE branding, product designs, photography, and site content are our property or used
        under license, and may not be reproduced without permission.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Liability</h2>
      <p>
        We aren&apos;t liable for indirect or consequential losses arising from use of the site or
        delays outside our reasonable control. Nothing here limits any rights you have under
        applicable consumer protection law.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Contact</h2>
      <p>hello@nerve-store.com</p>
    </Shell>
  );
}
