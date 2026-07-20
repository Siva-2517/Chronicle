/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soil: '#12100E',
        'soil-dark': '#0D0B0A',
        surface: '#1D1A16',
        ochre: '#C9A227',
        teal: '#4FB0A5',
        rust: '#C1502E',
        parchment: '#EDE6D6',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        'sediment-build': 'sediment-build 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        'sediment-build': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.9' },
        },
        'scan': {
          '0%': { left: '-20%' },
          '100%': { left: '120%' },
        }
      }
    },
  },
  plugins: [],
}
