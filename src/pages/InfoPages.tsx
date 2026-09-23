import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { contactService } from '../services/contactService';
import { useSEO, getFAQSchema } from '../lib/seo';
import { useStructuredData } from '../hooks/useStructuredData';
import { faqItems } from '../data/sizingData';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com';

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
      'Got questions about sizing, your order, or just want to say hi? Reach NERVE via email or Instagram DM — we usually reply within 24 hours.',
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
    <Shell title="Contact Us">
      <p>Got Questions? We Don&apos;t Bite.</p>
      <p>
        Whether you need help with sizing, tracking your order, or just want to tell us how good you
        look in NERVE, we&apos;re here for it!
      </p>
      <p>
        Drop us a message below or hit us up on any of our channels—a real human (and a cool one)
        will get back to you as fast as possible.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-4">Get in Touch Directly</h2>

      <p>
        <strong>Email Us:</strong>{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy/80">
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="pl-4 text-navy/60 text-sm">
        For order inquiries, general questions, or love letters. We usually reply within 24 hours!
      </p>

      <p className="pt-2">
        <strong>Instagram DM:</strong>{' '}
        <a
          href="https://www.instagram.com/gotthenerve58/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-navy/80"
        >
          @gotthenerve58
        </a>
      </p>
      <p className="pl-4 text-navy/60 text-sm">
        Fastest way to reach us! Slide into our DMs for quick chats or sizing advice.
      </p>

      <p className="pt-4 text-navy/60 text-sm">Available Saturday to Thursday, 10 AM – 10 PM</p>

      <h2 className="text-navy font-semibold text-lg pt-6">Send Us a Message</h2>

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
      <p>To start a return, contact {SUPPORT_EMAIL} with your order number.</p>
      <p>Sale and limited/archive items are final sale unless faulty.</p>
    </Shell>
  );
}

const shopFaqs = [
  {
    question: 'How long does delivery take?',
    answer:
      'Standard delivery is 2–5 business days across Egypt (free over EGP 2,000). Express delivery is 1–2 business days for EGP 200. Orders process within 24 hours on business days.',
  },
  {
    question: 'Do you offer cash on delivery?',
    answer:
      'Yes. Cash on delivery is available across Egypt — payment is due to the courier when your order arrives. We never collect or store payment card details.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'Use the Track Order page with your order number, or check the tracking link emailed once your order ships. You can also email nerveey.shop@gmail.com.',
  },
  {
    question: 'Can I return or exchange an item?',
    answer:
      'Unworn items with tags can be returned within 14 days of delivery for a full refund. Free size exchanges are available within 30 days. Sale and limited items are final sale unless faulty.',
  },
  {
    question: 'How do I choose the right size?',
    answer:
      'Visit the Size Guide for measurements and fit notes. Slim fits run tailored, Regular is classic comfort, and Oversized is relaxed. Contact us if you are between sizes.',
  },
  {
    question: 'Where are you based?',
    answer:
      'NERVE is a contemporary Egyptian concept store based in Alexandria, Egypt. We ship nationwide.',
  },
  {
    question: 'How do I contact customer support?',
    answer:
      'Email nerveey.shop@gmail.com or DM @gotthenerve58 on Instagram. We usually reply within 24 hours, Saturday to Thursday 10 AM – 10 PM.',
  },
];

export function Faq() {
  useSEO({
    title: 'FAQ | NERVE — Shipping, Returns & Sizing',
    description:
      'Answers about NERVE shipping, cash on delivery, returns, exchanges, sizing, and how to reach us. Free standard shipping over EGP 2,000.',
  });
  useStructuredData({
    '@context': 'https://schema.org',
    ...getFAQSchema([...faqItems, ...shopFaqs]),
  });
  return (
    <Shell title="FAQ">
      <p>
        Quick answers on shipping, returns, sizing, and orders. Still stuck? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy/80">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <h2 className="text-navy font-semibold text-lg pt-4">Orders &amp; Delivery</h2>
      {shopFaqs.slice(0, 3).map(faq => (
        <div key={faq.question} className="pt-3">
          <h3 className="font-semibold text-navy">{faq.question}</h3>
          <p>{faq.answer}</p>
        </div>
      ))}
      <h2 className="text-navy font-semibold text-lg pt-4">Returns &amp; Sizing</h2>
      {shopFaqs
        .slice(3, 5)
        .concat(faqItems.slice(0, 3))
        .map(faq => (
          <div key={faq.question} className="pt-3">
            <h3 className="font-semibold text-navy">{faq.question}</h3>
            <p>{faq.answer}</p>
          </div>
        ))}
      <h2 className="text-navy font-semibold text-lg pt-4">More Questions</h2>
      {shopFaqs.slice(5).map(faq => (
        <div key={faq.question} className="pt-3">
          <h3 className="font-semibold text-navy">{faq.question}</h3>
          <p>{faq.answer}</p>
        </div>
      ))}
      <p className="pt-6">
        <Link to="/contact" className="underline hover:text-navy/80">
          Contact us
        </Link>{' '}
        or visit{' '}
        <Link to="/shipping" className="underline hover:text-navy/80">
          Shipping
        </Link>{' '}
        and{' '}
        <Link to="/returns" className="underline hover:text-navy/80">
          Returns
        </Link>{' '}
        for full policies.
      </p>
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
        Last updated: August 30, 2026. NERVE (we, us) operates www.nerveey.shop. This page explains
        what we collect and why.
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
        {SUPPORT_EMAIL} to request a copy or deletion of your data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Cookies</h2>
      <p>
        We use essential cookies/local storage to keep you signed in and remember your cart. We
        don&apos;t use third-party advertising trackers.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Contact</h2>
      <p>Questions about this policy: {SUPPORT_EMAIL}</p>
    </Shell>
  );
}

export function Terms() {
  useSEO({
    title: 'Terms of Service | NERVE',
    description: 'The terms governing use of nerveey.shop and purchases from NERVE.',
  });
  return (
    <Shell title="Terms & Conditions">
      <p>
        Welcome to NERVE! By browsing, clicking, or buying from our site, you&apos;re agreeing to
        the terms below. Don&apos;t worry, we kept the boring legalese to a minimum.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">1. The Basics</h2>
      <p>
        By placing an order, you confirm that you&apos;re at least 18 years old (or using the site
        with a parent&apos;s card and approval—we see you!).
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">2. Prices &amp; Currency</h2>
      <p>
        All prices are listed in EGP (Egyptian Pounds). We reserve the right to change prices or
        drop surprise discounts whenever we want, but the price you checkout with is always locked
        in for your order.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">3. Stock &amp; Orders</h2>
      <p>
        Placing an item in your shopping cart does not reserve it. An order is only confirmed once
        you complete the checkout process and receive an order confirmation email/SMS.
      </p>
      <p className="pt-2">
        In the rare event that an item becomes out of stock after an order is placed, we will notify
        you immediately and issue a full refund or exchange option.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">
        4. Don&apos;t Steal Our Vibe (Intellectual Property)
      </h2>
      <p>
        All designs, photos, logos, and copy on this website belong strictly to NERVE. Please
        don&apos;t copy our designs or use our photos without asking—it took a lot of coffee and
        sleepless nights to create them!
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">5. Colors &amp; Reality</h2>
      <p>
        We do our absolute best to show colors accurately. However, every phone and monitor screen
        displays colors slightly differently, so the real-life item might look 5% different under
        natural light.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">6. Policy Updates</h2>
      <p>
        We reserve the right to update or modify these Terms &amp; Conditions at any time. Any
        changes will be published directly on this page.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">Contact</h2>
      <p>{SUPPORT_EMAIL}</p>
    </Shell>
  );
}
