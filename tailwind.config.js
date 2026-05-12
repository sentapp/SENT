/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F7F5F2',
        surface: '#FFFFFF',
        border: '#E5E2DD',
        ink: '#1C1917',
        muted: '#78716C',
        accent: '#185FA5',
        warm: '#C2410C',
        success: '#15803D',
        subtle: '#F3F2EF',
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
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
