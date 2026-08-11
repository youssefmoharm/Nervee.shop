import Checkerboard from '../components/Checkerboard'
import Newsletter from '../components/Newsletter'

export default function About() {
  return (
    <div className="bg-navy">
      <section className="pt-32 md:pt-44 pb-16 px-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="nv-eyebrow text-silver mb-4">Our Story — EST 2026</p>
          <h1 className="nv-heading text-[15vw] sm:text-[10vw] md:text-8xl leading-[0.88]">
            COOL BUT
            <br />
            CHIC.
          </h1>
        </div>
      </section>

      <div className="grid md:grid-cols-2">
        <div className="aspect-[4/3] md:aspect-auto">
          <img src="https://picsum.photos/seed/nerve-about-1/1000/1200" alt="NERVE campaign" className="w-full h-full object-cover" />
        </div>
        <div className="bg-white text-navy flex items-center px-5 md:px-16 py-16">
          <p className="nv-heading text-2xl md:text-4xl leading-tight max-w-lg">
            NERVE is a contemporary concept store built around individuality, movement, and the
            pieces that become part of your everyday identity.
          </p>
        </div>
      </div>

      <Checkerboard />

      <section className="px-5 md:px-8 py-20 md:py-28">
        <div className="mx-auto max-w-4xl grid md:grid-cols-2 gap-10 md:gap-16">
          <div>
            <span className="nv-eyebrow text-silver">01 — Philosophy</span>
            <p className="nv-edit text-lg md:text-xl mt-4 leading-relaxed">
              Based in everyone&apos;s closet — NERVE was built on the idea that the best pieces
              aren&apos;t the loudest. They&apos;re the ones you reach for without thinking, that move the
              way you move, and still look sharp doing it.
            </p>
          </div>
          <div>
            <span className="nv-eyebrow text-silver">02 — Approach</span>
            <p className="nv-edit text-lg md:text-xl mt-4 leading-relaxed">
              Every drop is small, considered, and made to last past the season. We design at the
              intersection of streetwear energy and chic, curated fashion — cool without trying,
              chic without apology.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 px-1">
        {['nerve-about-2', 'nerve-about-3', 'nerve-about-4', 'nerve-about-5', 'nerve-about-6', 'nerve-about-7'].map((s) => (
          <div key={s} className="aspect-square overflow-hidden">
            <img src={`https://picsum.photos/seed/${s}/700/700`} alt="NERVE editorial" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      <Checkerboard invert />

      <section className="px-5 md:px-8 py-20 md:py-28 text-center">
        <p className="nv-eyebrow text-silver mb-4">Est. 2026 — Alexandria</p>
        <h2 className="nv-heading text-4xl md:text-6xl max-w-3xl mx-auto">
          A concept store for the ones who wear it their own way.
        </h2>
      </section>

      <Newsletter />
    </div>
  )
}
