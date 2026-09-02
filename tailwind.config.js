/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#d8415f',
          hover: '#c43754',
          active: '#b0304a',
          soft: '#f07188',
        },
        surface: {
          DEFAULT: '#1e1e1e',
          input: '#141414',
        },
        border: {
          DEFAULT: '#2a2a2a',
          input: '#333333',
        },
        muted: '#9a9a9a',
      },
    },
  },
  plugins: [],
};
