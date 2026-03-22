/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0369A1', // sky-700
          light: '#38BDF8', // sky-400
        },
        secondary: '#38BDF8',
        cta: '#22C55E', // green-500
        background: '#F0F9FF', // sky-50
        text: '#0C4A6E', // sky-900
      },
      fontFamily: {
        lora: ['Lora', 'serif'],
        raleway: ['Raleway', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
