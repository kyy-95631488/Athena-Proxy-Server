/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f8f5',
          100: '#e9ede7',
          200: '#d4ded1',
          300: '#b4c4af',
          400: '#8ea687',
          500: '#6d8a65',
          600: '#556f4d',
          700: '#43583d',
          800: '#384733',
          900: '#2f3c2c',
          950: '#171e15'
        },
        accent: {
          DEFAULT: '#d8f36a',
          hover: '#c8e555'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
