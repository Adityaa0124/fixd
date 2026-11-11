/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        sunken: c('sunken'),
        line: c('line'),
        'line-strong': c('line-strong'),
        tx: c('tx'),
        'tx-2': c('tx-2'),
        'tx-3': c('tx-3'),
        muted: c('tx-muted'),
        'on-pine': c('on-pine'),
        pine: { 50: c('pine-50'), 100: c('pine-100'), 500: c('pine-500'), 600: c('pine-600'), 700: c('pine-700') },
        warn: { 50: c('amber-50'), 100: c('amber-100'), 600: c('amber-600') },
        bad: { 50: c('red-50'), 100: c('red-100'), 600: c('red-600') },
        ok: { 50: c('green-50'), 100: c('green-100'), 600: c('green-600') },
        ai: { 50: c('violet-50'), 600: c('violet-600') },
      },
      borderRadius: { card: 'var(--radius-card)' },
      boxShadow: { ink: 'var(--shadow-ink)', float: 'var(--shadow-float)' },
      fontWeight: { body: '425', medium: '525' },
      transitionTimingFunction: { fx: 'var(--ease)' },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '17px'],
        sm: ['13.5px', '20px'],
        base: ['15px', '23px'],
      },
    },
  },
};
