/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:    '#101934',
        gold:    '#F3B51C',
        paper:   '#F6F8FC',
        slate:   '#6675A0',
        teal:    '#18A58B',
        // legacy aliases kept for any existing usage
        ink:     '#101934',
        saffron: '#F3B51C',
        indigo:  '#080F22',
      },
      fontFamily: {
        display:   ['"Space Grotesk"', 'sans-serif'],
        sans:      ['"DM Sans"', 'sans-serif'],
        mono:      ['"JetBrains Mono"', 'Menlo', 'monospace'],
        bricolage: ['"Space Grotesk"', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(16, 25, 52, 0.07)',
        'card-hover': '0 8px 32px rgba(16, 25, 52, 0.12)',
        'btn': '0 2px 10px rgba(16,25,52,0.18)',
        'gold': '0 2px 12px rgba(243,181,28,0.35)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
}
