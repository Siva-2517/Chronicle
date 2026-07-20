/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
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
      }
    },
  },
  plugins: [],
}
