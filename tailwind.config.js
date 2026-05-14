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
          DEFAULT: '#2A9A58',
          light: '#E8F5ED',
          border: '#B8E0C8',
        },
        rose: {
          ...colors.rose,
          DEFAULT: '#C43D5E',
          light: '#FDE8EE',
          border: '#F5C4D4',
        },
        background: '#FFFFFF',
        accent: '#2A9A58',
        primary: '#2A9A58',
        warm: '#C17A00',
        success: '#2A9A58',
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
          blue: '#2A9A58',
          green: '#2A9A58',
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
      },
    },
  },
  plugins: [],
};
