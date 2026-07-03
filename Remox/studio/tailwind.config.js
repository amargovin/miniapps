/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark studio theme
        studio: {
          bg: '#1a1a1f',
          surface: '#22222a',
          border: '#2e2e38',
          hover: '#2a2a35',
          active: '#32323f',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
