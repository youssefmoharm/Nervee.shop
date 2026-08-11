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
        // Semantic colors for errors, success, warnings
        'error': '#DC2626',
        'success': '#16A34A',
        'warning': '#EA580C',
        'info': '#2563EB',
      },
      fontFamily: {
        display: ['"Anton"', 'sans-serif'],
        edit: ['"Archivo Narrow"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.28em',
      },
      backgroundImage: {
        checker: `repeating-conic-gradient(#061735 0% 25%, transparent 0% 50%)`,
        'checker-light': `repeating-conic-gradient(#E5E5E5 0% 25%, transparent 0% 50%)`,
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
      },
      animation: {
        reveal: 'reveal 0.7s cubic-bezier(.65,0,.35,1) forwards',
        fadeUp: 'fadeUp 0.6s ease forwards',
        marquee: 'marquee 22s linear infinite',
      },
    },
  },
  plugins: [],
}
