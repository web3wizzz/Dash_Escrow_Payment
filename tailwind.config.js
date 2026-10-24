/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:     '#1B1F4B',
        saffron: '#F2A900',
        paper:   '#F5F7FB',
        indigo:  '#0E1030',
      },
      fontFamily: {
        bricolage: ['"Bricolage Grotesque"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
