import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", 'system-ui', '-apple-system', 'sans-serif'],
        display: ["'Bricolage Grotesque Variable'", "'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#14201D', muted: '#4A5753', faint: '#76827E' },
        paper: { DEFAULT: '#F6F7F4', deep: '#ECEFEA' },
        line: '#DCE3DF',
        primary: { DEFAULT: '#0E6E63', dark: '#0A4F47', light: '#DDF0EA', soft: '#6FB8AE' },
        neg: { DEFAULT: '#B42318', light: '#FDECEA' },
        warn: { DEFAULT: '#8A6100', light: '#FFF4D6' },
        marker: '#F2E86D',
      },
      maxWidth: { prose: '68ch' },
      keyframes: {
        print: { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { print: 'print 380ms cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [],
} satisfies Config;
