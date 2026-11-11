/** @type {import('tailwindcss').Config} */
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
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        sunken: 'var(--sunken)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        tx: 'var(--tx)',
        'tx-2': 'var(--tx-2)',
        'tx-3': 'var(--tx-3)',
        muted: 'var(--tx-muted)',
        pine: {
          50: 'var(--pine-50)',
          100: 'var(--pine-100)',
          500: 'var(--pine-500)',
          600: 'var(--pine-600)',
          700: 'var(--pine-700)',
        },
        amber: {
          50: 'var(--amber-50)',
          600: 'var(--amber-600)',
        },
        bad: {
          50: 'var(--red-50)',
          600: 'var(--red-600)',
        },
        ok: {
          50: 'var(--green-50)',
          600: 'var(--green-600)',
        },
        ai: {
          50: 'var(--violet-50)',
          600: 'var(--violet-600)',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      fontWeight: {
        body: '425',
        medium: '525',
      },
      transitionTimingFunction: {
        fx: 'var(--ease)',
      },
    },
  },
};

