import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", 'system-ui', '-apple-system', 'sans-serif'],
        display: ["'Bricolage Grotesque Variable'", "'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#101D1A',
          soft: '#243530',
          muted: '#4A5B56',
          faint: '#758580',
        },
        paper: {
          DEFAULT: '#F7F6F2',
          warm: '#F1EFE8',
          deep: '#E7E5DC',
        },
        line: {
          DEFAULT: '#DDDCD3',
          strong: '#C5C4B9',
        },
        primary: {
          DEFAULT: '#0B6B58',
          dark: '#074D3F',
          deeper: '#05352B',
          light: '#DDF2EC',
          pale: '#EEF8F5',
          soft: '#68B6A5',
        },
        terra: {
          DEFAULT: '#B94E18',
          dark: '#8E3B10',
          light: '#FBECE3',
          pale: '#FDF6F2',
        },
        neg: {
          DEFAULT: '#B42318',
          dark: '#8A1A11',
          light: '#FDECEA',
        },
        warn: {
          DEFAULT: '#8A5B00',
          light: '#FFF3D4',
        },
        ok: {
          DEFAULT: '#0E734A',
          light: '#E1F5EC',
        },
        marker: '#F2E86D',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 29, 26, 0.04), 0 6px 18px -6px rgba(16, 29, 26, 0.05)',
        ticket: '0 2px 6px rgba(16, 29, 26, 0.05), 0 18px 40px -12px rgba(11, 107, 88, 0.12)',
        float: '0 10px 30px -8px rgba(16, 29, 26, 0.14), 0 2px 6px rgba(16, 29, 26, 0.06)',
      },
      maxWidth: { prose: '68ch' },
      keyframes: {
        print: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        print: 'print 380ms cubic-bezier(.2,.7,.2,1) both',
        rise: 'rise 420ms cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
