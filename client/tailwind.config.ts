import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sheen: {
          black: '#1A1A1A',
          cream: '#F5F0E8',
          brown: '#8B4513',
          gold: '#D4A843',
          white: '#FFFFFF',
          muted: '#A0785A',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
