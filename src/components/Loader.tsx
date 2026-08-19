import { useEffect, useState } from 'react';

export default function Loader({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'grid' | 'logo' | 'exit'>('grid');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('logo'), 350);
    const t2 = setTimeout(() => setPhase('exit'), 1250);
    const t3 = setTimeout(onDone, 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-navy flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        className={`nv-checker w-24 h-8 mb-6 transition-all duration-500 ${
          phase === 'grid' ? 'opacity-100 scale-100' : 'opacity-40 scale-90'
        }`}
      />
      <div
        className={`transition-all duration-700 ${
          phase !== 'grid' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <img
          src="/assets/images/nervee logo.png"
          alt="NERVE"
          className="h-16 md:h-20 w-auto mx-auto mb-4"
          onError={e => {
            // Fallback to text logo if image fails to load
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
            if (fallback) fallback.classList.remove('hidden');
          }}
        />
        <h1 className="nv-heading text-white text-5xl md:text-7xl tracking-wide text-center hidden">
          NERVE
        </h1>
      </div>
      <p
        className={`nv-eyebrow text-silver mt-3 transition-all duration-700 delay-100 ${
          phase !== 'grid' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Concept Store
      </p>
    </div>
  );
}
