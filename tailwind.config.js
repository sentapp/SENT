/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mission: {
          blue: '#185FA5',
          green: '#0F6E56',
          amber: '#854F0B',
          canvas: '#F8F8F6',
          muted: '#6B7280',
          line: '#E8E8E6',
          purple: '#7C3AED',
          danger: '#DC2626',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
      maxWidth: {
        mobile: '390px',
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
      fontFamily: {
        sans: [
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
