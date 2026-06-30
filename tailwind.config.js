/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        science: {
          light: '#f0f9ff',
          DEFAULT: '#3b82f6',
          dark: '#1e3a8a',
        },
        tech: {
          light: '#f5f5f5',
          DEFAULT: '#6b7280',
          dark: '#374151',
        },
      },
      fontFamily: {
        'comic': ['"Comic Sans MS"', 'cursive'],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};