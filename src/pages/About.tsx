import { Link } from 'react-router-dom';
import { useSEO } from '../lib/seo';
import { useI18n } from '../lib/i18n';

export function About() {
  const { t } = useI18n();
  useSEO({
    title: 'About NERVE | Contemporary Egyptian Streetwear',
    description:
      'NERVE is a contemporary Egyptian concept store. Cool but chic — pieces for the way you move through the world.',
  });

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="nv-heading text-5xl mb-12 text-center">{t('About NERVE')}</h1>

        <div className="max-w-none">
          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">{t('Who We Are')}</h2>
            <p className="text-xl leading-relaxed mb-6">
              NERVE is a contemporary Egyptian concept store based in Alexandria. We design
              streetwear and lifestyle pieces for the way you move through the world.
            </p>
            <p className="text-xl leading-relaxed">
              Fashion is how you show up. We keep the experience simple: clear product info, honest
              policies, and real people to talk to if something is off.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">{t('Shopping & Policies')}</h2>
            <p className="text-lg leading-relaxed mb-4">
              We ship across Egypt with cash on delivery — free standard shipping on orders over EGP
              2,000, Express 1–2 day delivery available. Returns within 7 days of delivery on unworn
              tagged items, with free size exchanges within 30 days.
            </p>
            <p className="text-lg leading-relaxed">
              {t('Questions?')}{' '}
              <Link to="/contact" className="underline hover:text-navy/80">
                {t('Contact us')}
              </Link>{' '}
              {t('or read the')}{' '}
              <Link to="/shipping" className="underline hover:text-navy/80">
                {t('Shipping')}
              </Link>{' '}
              {t('and')}{' '}
              <Link to="/returns" className="underline hover:text-navy/80">
                {t('Returns')}
              </Link>{' '}
              {t('policies.')}
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">{t('Our Story')}</h2>
            <p className="text-lg leading-relaxed mb-6">
              Started in 2026 in Alexandria, NERVE grew from a single question: why should Egyptian
              dressing today have to choose between global trends and local identity?
            </p>
            <p className="text-lg leading-relaxed">
              We design pieces that refuse the trade-off — heavyweight essentials worn every day,
              technical cuts built for the city&apos;s pace, and numbered releases for those who
              show up first. Cool but chic.
            </p>
          </section>

          <section className="mb-12 text-center">
            <h2 className="text-navy font-semibold text-2xl mb-6">{t('Get In Touch')}</h2>
            <p className="text-lg leading-relaxed mb-8">
              Have questions about sizing, an order, or returns? We&apos;d love to hear from you.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                className="inline-block bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors"
              >
                {t('Contact Us')}
              </Link>
              <Link
                to="/faq"
                className="inline-block border border-navy text-navy nv-eyebrow px-8 py-3.5 hover:bg-mist transition-colors"
              >
                {t('FAQ')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
