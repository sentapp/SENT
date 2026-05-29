const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#FAFAFA',
        ink: '#111111',
        muted: '#888888',
        border: '#EEEEEE',
        green: {
          ...colors.green,
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
          border: 'var(--accent-border)',
          dark: 'var(--accent-dark)',
          bright: 'var(--accent-bright)',
        },
        rose: {
          ...colors.rose,
          DEFAULT: '#C43D5E',
          light: '#FDE8EE',
          border: '#F5C4D4',
        },
        background: '#FFFFFF',
        accent: 'var(--accent)',
        'accent-bright': 'var(--accent-bright)',
        primary: '#111111',
        warm: '#C17A00',
        success: 'var(--accent)',
        subtle: '#FAFAFA',
        sent: {
          bg: '#FFFFFF',
          surface: '#FAFAFA',
          card: '#FFFFFF',
          ink: '#111111',
          stone: '#888888',
          border: '#EEEEEE',
          brown: '#888888',
          nav: '#FAFAFA',
          tan: '#FAFAFA',
        },
        mission: {
          /** Legacy name — Garden primary accent (was Theme 3 ink / blue). */
          blue: 'var(--accent)',
          green: 'var(--accent)',
          amber: '#C17A00',
          canvas: 'var(--color-bg)',
          muted: 'var(--color-muted)',
          line: 'var(--color-border)',
          purple: '#6040B0',
          danger: '#E05050',
          ink: 'var(--color-text)',
          warm: 'var(--color-warm)',
          surface: 'var(--color-surface)',
        },
      },
      maxWidth: {
        mobile: '390px',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
