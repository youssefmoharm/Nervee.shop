import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { contactService } from '../services/contactService';
import { useSEO, getFAQSchema } from '../lib/seo';
import { useStructuredData } from '../hooks/useStructuredData';
import { faqItems } from '../data/sizingData';
import {
  EXPRESS_SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_COST,
} from '../lib/storeConfig';
import { formatEGP } from '../lib/format';
import { useI18n } from '../lib/i18n';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'nerveey.shop@gmail.com';

function Shell({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className={wide ? 'mx-auto max-w-3xl' : 'mx-auto max-w-2xl'}>
        <h1 className="nv-heading text-5xl mb-8">{t(title)}</h1>
        <div className="text-navy/70 leading-relaxed space-y-4">{children}</div>
      </div>
    </div>
  );
}

function PolicyNav({ current }: { current: 'shipping' | 'returns' | 'faq' }) {
  const { t } = useI18n();
  const links = [
    { id: 'shipping' as const, to: '/shipping', label: t('Shipping') },
    { id: 'returns' as const, to: '/returns', label: t('Returns & Exchanges') },
    { id: 'faq' as const, to: '/faq', label: t('FAQ') },
    { id: 'contact' as const, to: '/contact', label: t('Contact') },
  ];
  return (
    <nav
      aria-label={t('Policy pages')}
      className="flex flex-wrap gap-x-5 gap-y-2 text-xs nv-eyebrow pb-6 mb-2 border-b border-navy/10"
    >
      {links.map(l => (
        <Link
          key={l.id}
          to={l.to}
          className={
            l.id === current
              ? 'text-navy underline underline-offset-4'
              : 'text-navy/60 hover:text-navy transition-colors'
          }
          aria-current={l.id === current ? 'page' : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function Contact() {
  const { t } = useI18n();
  useSEO({
    title: 'Contact Us | NERVE',
    description:
      'Got questions about sizing, your order, or just want to say hi? Reach NERVE via email or Instagram DM — we usually reply within 24 hours.',
  });
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
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
    setForm({ name: '', email: '', subject: '', message: '', website: '' });
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

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Get in Touch Directly')}</h2>

      <p>
        <strong>Email Us:</strong>{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy/80">
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="ps-4 text-navy/60 text-sm">
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
      <p className="ps-4 text-navy/60 text-sm">
        Fastest way to reach us! Slide into our DMs for quick chats or sizing advice.
      </p>

      <p className="pt-4 text-navy/60 text-sm">Available Saturday to Thursday, 10 AM – 10 PM</p>

      <h2 className="text-navy font-semibold text-lg pt-6">{t('Send Us a Message')}</h2>

      {status === 'success' ? (
        <p className="nv-eyebrow text-navy pt-4">
          {t("Message sent — we'll get back to you shortly.")}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4 pt-6 not-prose">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Name')}</span>
              <input
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Email')}</span>
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
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Subject')}</span>
            <input
              required
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Message')}</span>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
            />
          </label>
          {/* Honeypot — hidden from humans, bots fill it and get silently dropped */}
          <div
            className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden"
            aria-hidden="true"
          >
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
              />
            </label>
          </div>
          {status === 'error' && (
            <p className="text-xs text-red-600">
              {t('Something went wrong. Please try again or email us directly.')}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {t('Send Message')}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function Shipping() {
  const { t } = useI18n();
  useSEO({
    title: 'Shipping & Delivery | NERVE',
    description: `Standard delivery ${formatEGP(STANDARD_SHIPPING_COST)} (free over ${formatEGP(
      FREE_SHIPPING_THRESHOLD,
    )}) in 2–5 business days across Egypt. Express ${formatEGP(
      EXPRESS_SHIPPING_COST,
    )} in 1–2 business days. Cash on delivery available.`,
  });
  return (
    <Shell title="Shipping" wide>
      <PolicyNav current="shipping" />
      <p>
        We deliver across Egypt with cash on delivery. Shipping is calculated at checkout from your
        order subtotal and the delivery speed you choose.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Delivery options')}</h2>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm border border-navy/10 rounded-lg overflow-hidden">
          <thead className="bg-mist/60 text-navy">
            <tr>
              <th scope="col" className="text-start font-semibold px-3 py-2.5">
                {t('Option')}
              </th>
              <th scope="col" className="text-start font-semibold px-3 py-2.5">
                {t('Timeline')}
              </th>
              <th scope="col" className="text-start font-semibold px-3 py-2.5">
                {t('Cost')}
              </th>
            </tr>
          </thead>
          <tbody className="text-navy/70 divide-y divide-navy/10">
            <tr>
              <td className="px-3 py-2.5 font-medium text-navy">{t('Standard')}</td>
              <td className="px-3 py-2.5">{t('2–5 business days')}</td>
              <td className="px-3 py-2.5">
                {formatEGP(STANDARD_SHIPPING_COST)}
                {' — '}
                {t('free over')} {formatEGP(FREE_SHIPPING_THRESHOLD)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 font-medium text-navy">{t('Express')}</td>
              <td className="px-3 py-2.5">{t('1–2 business days')}</td>
              <td className="px-3 py-2.5">{formatEGP(EXPRESS_SHIPPING_COST)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-navy/60">
        {t('Timelines are estimates after the order ships and may vary by governorate or courier')}.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Where we deliver')}</h2>
      <p>{t('We deliver nationwide across Egypt with cash on delivery.')}</p>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Payment on delivery')}</h2>
      <p>
        {t(
          'Cash on delivery is available across Egypt — payment is due to the courier when your order arrives. We never collect or store payment card details.',
        )}
      </p>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('What happens after you order')}</h2>
      <ol className="list-decimal ps-5 space-y-2">
        <li>{t('You receive an order confirmation by email.')}</li>
        <li>{t('We process your order within 24 hours on business days.')}</li>
        <li>{t("You'll receive a tracking link by email once your order ships.")}</li>
        <li>{t('The courier delivers to your address; you pay cash on arrival.')}</li>
      </ol>
      <p className="text-sm text-navy/60">
        {t('Track anytime on the')}{' '}
        <Link to="/track-order" className="underline hover:text-navy/80">
          {t('Track Order')}
        </Link>{' '}
        {t('page')}.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Also helpful')}</h2>
      <p className="text-sm">
        <Link to="/returns" className="underline hover:text-navy/80">
          {t('Returns & Exchanges')}
        </Link>
        {' · '}
        <Link to="/faq" className="underline hover:text-navy/80">
          {t('FAQ')}
        </Link>
        {' · '}
        <Link to="/contact" className="underline hover:text-navy/80">
          {t('Contact')}
        </Link>
      </p>
    </Shell>
  );
}

export function Returns() {
  const { t } = useI18n();
  useSEO({
    title: 'Returns & Exchanges | NERVE',
    description:
      'Return unworn tagged items within 14 days of delivery. Free size exchanges within 30 days. Cancel within 2 hours while the order is still processing. Cash on delivery store in Egypt.',
  });
  return (
    <Shell title="Returns & Exchanges" wide>
      <PolicyNav current="returns" />

      <h2 className="text-navy font-semibold text-lg">{t('Returns (refund)')}</h2>
      <ul className="list-disc ps-5 space-y-1.5">
        <li>{t('Window: 14 days from delivery (orders must be marked delivered).')}</li>
        <li>{t('Condition: unworn, unwashed, with tags attached.')}</li>
        <li>{t('Outcome: full refund of the item price for accepted returns.')}</li>
        <li>
          {t('Exclusions:')} {t('Sale and limited/archive items are final sale unless faulty.')}
        </li>
        <li>{t('One return request per order.')}</li>
      </ul>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Exchanges')}</h2>
      <ul className="list-disc ps-5 space-y-1.5">
        <li>{t('Free size exchanges within 30 days.')}</li>
        <li>{t('Same item in a different size, subject to stock.')}</li>
        <li>{t('Items must be unworn with tags attached.')}</li>
      </ul>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('Cancellations')}</h2>
      <ul className="list-disc ps-5 space-y-1.5">
        <li>{t('Orders can be cancelled within 2 hours while status is placed or processing.')}</li>
        <li>{t('After that, use a return once the order is delivered (14-day window).')}</li>
      </ul>

      <h2 className="text-navy font-semibold text-lg pt-4">{t('How to start')}</h2>
      <ol className="list-decimal ps-5 space-y-2">
        <li>
          {t('Sign in and open your order under')}{' '}
          <Link to="/account/orders" className="underline hover:text-navy/80">
            {t('Account → Orders')}
          </Link>
          {t(', or email us with your order number.')}
        </li>
        <li>{t('Tell us whether you need a return, size exchange, or cancellation.')}</li>
        <li>{t('We review requests within 24 hours and reply with next steps.')}</li>
      </ol>
      <p className="text-sm">
        {t('Email')}{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy/80">
          {SUPPORT_EMAIL}
        </a>
        {t(' or see the')}{' '}
        <Link to="/faq" className="underline hover:text-navy/80">
          {t('FAQ')}
        </Link>
        .
      </p>

      <div className="rounded-xl border border-navy/10 bg-mist/40 p-4 text-sm text-navy/65 space-y-1">
        <p className="font-medium text-navy">{t('Good to know')}</p>
        <p>
          {t(
            'Return shipping cost, pickup options, and how COD refunds are paid out are confirmed in our reply when we review your request.',
          )}
        </p>
        <p>{t('Questions before you order? See Shipping or contact us.')}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/shipping" className="underline hover:text-navy/80">
            {t('Shipping')}
          </Link>
          <Link to="/contact" className="underline hover:text-navy/80">
            {t('Contact')}
          </Link>
        </p>
      </div>
    </Shell>
  );
}

const shopFaqs = [
  {
    question: 'How long does delivery take?',
    answer: `Standard delivery is 2–5 business days across Egypt (free over ${formatEGP(
      FREE_SHIPPING_THRESHOLD,
    )}, otherwise ${formatEGP(
      STANDARD_SHIPPING_COST,
    )}). Express delivery is 1–2 business days for ${formatEGP(
      EXPRESS_SHIPPING_COST,
    )}. Orders process within 24 hours on business days.`,
  },
  {
    question: 'How much does shipping cost?',
    answer: `Standard shipping is ${formatEGP(
      STANDARD_SHIPPING_COST,
    )} and free when your order subtotal is ${formatEGP(
      FREE_SHIPPING_THRESHOLD,
    )} or more. Express shipping is always ${formatEGP(
      EXPRESS_SHIPPING_COST,
    )}. Final shipping is shown at checkout.`,
  },
  {
    question: 'Where do you deliver?',
    answer:
      'We deliver nationwide across Egypt. Delivery speed depends on the option you choose at checkout and courier coverage for your area.',
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
    question: 'Can I cancel my order?',
    answer:
      'Yes — you can cancel within 2 hours while the order is still placed or processing. After delivery, use our 14-day return window instead.',
  },
  {
    question: 'Can I return or exchange an item?',
    answer:
      'Unworn items with tags can be returned within 14 days of delivery for a full refund. Free size exchanges are available within 30 days. Sale and limited items are final sale unless faulty. One return request per order.',
  },
  {
    question: 'How are refunds handled?',
    answer:
      'Accepted returns are refunded for the item price. For cash-on-delivery orders, we confirm the refund method (and any timing) in our reply when we review your return request — email us with your order number to start.',
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
  const { t } = useI18n();
  useSEO({
    title: 'FAQ | NERVE — Shipping, Returns & Sizing',
    description: `Answers about NERVE shipping costs, delivery times, cash on delivery, returns, exchanges, sizing, and how to reach us. Free standard shipping over ${formatEGP(
      FREE_SHIPPING_THRESHOLD,
    )}.`,
  });
  useStructuredData({
    '@context': 'https://schema.org',
    ...getFAQSchema([...faqItems, ...shopFaqs]),
  });
  const deliveryFaqs = shopFaqs.slice(0, 6); // timing, cost, where, COD, track, cancel
  const returnFaqs = shopFaqs.slice(6, 9); // returns, refunds, size
  const moreFaqs = shopFaqs.slice(9); // based, contact
  return (
    <Shell title="FAQ" wide>
      <PolicyNav current="faq" />
      <p>
        Quick answers on shipping, returns, sizing, and orders. Still stuck? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-navy/80">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <h2 className="text-navy font-semibold text-lg pt-4">{t('Orders & Delivery')}</h2>
      {deliveryFaqs.map(faq => (
        <div key={faq.question} className="pt-3">
          <h3 className="font-semibold text-navy">{faq.question}</h3>
          <p>{faq.answer}</p>
        </div>
      ))}
      <h2 className="text-navy font-semibold text-lg pt-4">{t('Returns & Sizing')}</h2>
      {returnFaqs.concat(faqItems.slice(0, 3)).map(faq => (
        <div key={faq.question} className="pt-3">
          <h3 className="font-semibold text-navy">{faq.question}</h3>
          <p>{faq.answer}</p>
        </div>
      ))}
      <h2 className="text-navy font-semibold text-lg pt-4">{t('More Questions')}</h2>
      {moreFaqs.map(faq => (
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
  const { t } = useI18n();
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

      <h2 className="text-navy font-semibold text-lg pt-2">{t('What we collect')}</h2>
      <p>
        Account details (name, email, phone) when you register or check out; order and shipping
        information; and, if you contact us, whatever you share in that message. We accept Cash on
        Delivery, so we never collect or store payment card details.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('How we use it')}</h2>
      <p>
        To process and ship orders, provide customer support, send transactional emails (order
        confirmations, shipping updates), and, only if you opt in, send our newsletter. We
        don&apos;t sell your personal data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('Who we share it with')}</h2>
      <p>
        Service providers who help us run the store, each only with what they need for their job:
        Supabase (hosting, database and sign-in), Resend (transactional email), delivery couriers
        (to ship your order), Google Analytics (site usage statistics), Meta (measuring our ad
        campaigns), Crisp (live chat support) and Sentry (error monitoring). Analytics and ad
        measurement only run if you accept the analytics cookies described below. We don&apos;t sell
        your personal data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('Your rights')}</h2>
      <p>
        You can view and edit your profile and addresses any time from your account, or email
        {SUPPORT_EMAIL} to request a copy or deletion of your data.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('Cookies')}</h2>
      <p>
        We use essential cookies and local storage to keep you signed in, remember your cart and
        keep checkout working — these are always on. If you accept in the cookie banner, we also
        load two analytics tools: Google Analytics (how the site is used) and Meta Pixel (whether
        our ads lead to orders). If you choose &quot;Essential only&quot;, neither is loaded. You
        can change your choice at any time by clearing this site&apos;s data in your browser
        settings — the banner will ask again on your next visit.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('Contact')}</h2>
      <p>Questions about this policy: {SUPPORT_EMAIL}</p>
    </Shell>
  );
}

export function Terms() {
  const { t } = useI18n();
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

      <h2 className="text-navy font-semibold text-lg pt-2">{t('1. The Basics')}</h2>
      <p>
        By placing an order, you confirm that you&apos;re at least 18 years old (or using the site
        with a parent&apos;s card and approval—we see you!).
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('2. Prices & Currency')}</h2>
      <p>
        All prices are listed in EGP (Egyptian Pounds). We reserve the right to change prices or
        drop surprise discounts whenever we want, but the price you checkout with is always locked
        in for your order.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('3. Stock & Orders')}</h2>
      <p>
        Placing an item in your shopping cart does not reserve it. An order is only confirmed once
        you complete the checkout process and receive an order confirmation email/SMS.
      </p>
      <p className="pt-2">
        In the rare event that an item becomes out of stock after an order is placed, we will notify
        you immediately and issue a full refund or exchange option.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">
        {t("4. Don't Steal Our Vibe (Intellectual Property)")}
      </h2>
      <p>
        All designs, photos, logos, and copy on this website belong strictly to NERVE. Please
        don&apos;t copy our designs or use our photos without asking—it took a lot of coffee and
        sleepless nights to create them!
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('5. Colors & Reality')}</h2>
      <p>
        We do our absolute best to show colors accurately. However, every phone and monitor screen
        displays colors slightly differently, so the real-life item might look 5% different under
        natural light.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('6. Policy Updates')}</h2>
      <p>
        We reserve the right to update or modify these Terms &amp; Conditions at any time. Any
        changes will be published directly on this page.
      </p>

      <h2 className="text-navy font-semibold text-lg pt-2">{t('Contact')}</h2>
      <p>{SUPPORT_EMAIL}</p>
    </Shell>
  );
}
