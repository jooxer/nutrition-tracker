/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carb: '#3b82f6',
        protein: '#10b981',
        fat: '#f59e0b'
      }
    }
  },
  plugins: []
};
