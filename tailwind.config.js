/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#061735',
        'navy-2': '#0B2249',
        silver: '#888888', // Increased contrast: was #A7A7A7
        mist: '#E5E5E5',
        ink: '#000000',
        paper: '#FFFFFF',
        // New premium colors
        charcoal: '#1A1A1A',
        'warm-gray': '#F5F5F4',
        cream: '#FAFAF9',
        gold: '#D4AF37',
        terracotta: '#E89679',
        // Semantic colors for errors, success, warnings
        'error': '#DC2626',
        'success': '#16A34A',
        'success-light': '#DCFAE6',
        'warning': '#EA580C',
        'info': '#2563EB',
      },
      fontFamily: {
        display: ['"Anton"', 'sans-serif'],
        edit: ['"Archivo Narrow"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
        'sm': ['0.875rem', { lineHeight: '1.7', letterSpacing: '0em' }],
        'base': ['1rem', { lineHeight: '1.6', letterSpacing: '0em' }],
        'lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
        '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
        '6xl': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        '7xl': ['5rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        '8xl': ['6rem', { lineHeight: '1.1', letterSpacing: '-0.05em' }],
        '9xl': ['8rem', { lineHeight: '1.1', letterSpacing: '-0.05em' }],
      },
      letterSpacing: {
        widest2: '0.28em',
      },
      backgroundImage: {
        checker: `repeating-conic-gradient(#061735 0% 25%, transparent 0% 50%)`,
        'checker-light': `repeating-conic-gradient(#E5E5E5 0% 25%, transparent 0% 50%)`,
        'paper-grain': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
      },
      keyframes: {
        reveal: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0%)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
      animation: {
        reveal: 'reveal 0.7s cubic-bezier(.65,0,.35,1) forwards',
        fadeUp: 'fadeUp 0.6s ease forwards',
        marquee: 'marquee 22s linear infinite',
        fadeIn: 'fadeIn 0.5s ease forwards',
        slideIn: 'slideIn 0.4s cubic-bezier(.65,0,.35,1) forwards',
        zoomIn: 'zoomIn 0.3s ease forwards',
      },
    },
  },
  plugins: [],
}
