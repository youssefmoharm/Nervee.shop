import { useSEO } from '../lib/seo';

export function About() {
  useSEO({
    title: 'About Us | NERVE',
    description:
      'Learn about NERVE - your premier destination for premium streetwear and fashion in Egypt.',
  });

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="nv-heading text-5xl mb-12 text-center">About NERVE</h1>

        <div className="prose prose-navy max-w-none">
          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">Who We Are</h2>
            <p className="text-xl leading-relaxed mb-6">
              NERVE is Egypt&apos;s premier destination for premium streetwear and contemporary
              fashion. Founded with a passion for quality, design, and authenticity, we&apos;re
              committed to delivering exceptional products and experiences to our customers.
            </p>
            <p className="text-xl leading-relaxed">
              We believe that fashion is more than just clothing—it&apos;s a form of
              self-expression, a way to connect with others, and a statement about who you are.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">What We Do</h2>
            <p className="text-lg leading-relaxed mb-6">
              We curate a collection of high-quality streetwear, casual essentials, and premium
              accessories that blend contemporary design with Egyptian craftsmanship.
            </p>
            <p className="text-lg leading-relaxed">
              From limited edition drops to timeless essentials, every piece in our collection is
              designed to make a statement and stand the test of time.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">Our Mission</h2>
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="font-semibold text-lg mb-3 text-navy/80">Quality First</h3>
                <p className="text-navy/70">
                  We source only the finest materials and work with trusted manufacturers who share
                  our commitment to quality.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-navy/80">Customer Focus</h3>
                <p className="text-navy/70">
                  Your satisfaction is our priority. We&apos;re here to help with any questions,
                  concerns, or feedback you might have.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-navy/80">Authenticity</h3>
                <p className="text-navy/70">
                  We stay true to our roots and values, creating products that reflect our heritage
                  while embracing contemporary trends.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-navy/80">Sustainability</h3>
                <p className="text-navy/70">
                  We&apos;re committed to reducing our environmental impact and supporting ethical
                  manufacturing practices.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-navy font-semibold text-2xl mb-6">Our Story</h2>
            <p className="text-lg leading-relaxed mb-6">
              Started in 2024, NERVE was born from a simple idea: to create a fashion brand that
              combines international trends with local craftsmanship, offering Egyptian customers
              premium streetwear that reflects their identity.
            </p>
            <p className="text-lg leading-relaxed">
              Today, we&apos;re proud to serve thousands of satisfied customers across Egypt and the
              Middle East, with a growing community of fashion enthusiasts who share our passion for
              quality and style.
            </p>
          </section>

          <section className="mb-12 text-center">
            <h2 className="text-navy font-semibold text-2xl mb-6">Get In Touch</h2>
            <p className="text-lg leading-relaxed mb-8">
              Have questions, suggestions, or want to collaborate? We&apos;d love to hear from you.
            </p>
            <a
              href="/contact"
              className="inline-block bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors"
            >
              Contact Us
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
