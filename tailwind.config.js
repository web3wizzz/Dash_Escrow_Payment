/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand tokens — mirror CSS vars
        ink:      '#0E1030',
        indigo:   '#1B1F4B',
        saffron:  '#F2A900',
        canvas:   '#F6F7FB',
        surface:  '#FFFFFF',
        muted:    '#69728F',
        subtle:   '#9BA3BE',
        success:  '#1A7F4E',
        danger:   '#B83248',
        // Legacy aliases
        navy:     '#0E1030',
        gold:     '#F2A900',
        paper:    '#F6F7FB',
        slate:    '#69728F',
        teal:     '#1A7F4E',
      },
      fontFamily: {
        display:   ['"Bricolage Grotesque"', 'sans-serif'],
        sans:      ['"Figtree"', 'sans-serif'],
        mono:      ['"JetBrains Mono"', 'Menlo', 'monospace'],
        bricolage: ['"Bricolage Grotesque"', 'sans-serif'],
        figtree:   ['"Figtree"', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'card':      '0 2px 12px rgba(14,16,48,0.05)',
        'card-md':   '0 4px 20px rgba(14,16,48,0.08)',
        'card-lg':   '0 8px 32px rgba(14,16,48,0.12)',
        'saffron':   '0 2px 10px rgba(242,169,0,0.30)',
        'navy':      '0 4px 20px rgba(14,16,48,0.22)',
      },
    },
  },
  plugins: [],
}
