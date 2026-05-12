/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mission: {
          blue: '#185FA5',
          green: '#15803D',
          amber: '#A16207',
          canvas: 'var(--color-bg)',
          muted: 'var(--color-muted)',
          line: 'var(--color-border)',
          purple: '#7C3AED',
          danger: '#DC2626',
          ink: 'var(--color-text)',
          warm: 'var(--color-warm)',
          surface: 'var(--color-surface)',
        },
      },
      maxWidth: {
        mobile: '390px',
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
