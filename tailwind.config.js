/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hyper: {
          900: '#090d16',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
          accent: '#00f0ff',
          brand: '#ff2a5f',
          success: '#10b981',
          warning: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
