/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F9F7F2',
        surface: '#FFFFFF',
        border: '#E2DAD0',
        ink: '#181208',
        muted: '#9C8C78',
        accent: '#181208',
        primary: '#181208',
        warm: '#C2410C',
        success: '#15803D',
        subtle: '#F2EDE4',
        sent: {
          bg: '#F9F7F2',
          surface: '#F9F7F2',
          card: '#FFFFFF',
          ink: '#181208',
          stone: '#9C8C78',
          border: '#E2DAD0',
          brown: '#6B5D50',
          nav: '#F2EDE4',
          tan: '#EAE3D8',
        },
        mission: {
          /** Legacy name — Theme 3 primary / ink (was blue #185FA5). */
          blue: '#181208',
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
        card: '12px',
        btn: '6px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
