/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        capsab: {
          green: {
            DEFAULT: '#4CAF50',
            hover: '#388E3C',
            dark: '#2E7D32',
            light: '#E8F5E9',
          },
          gray: {
            DEFAULT: '#949494',
            hover: '#bdbdbd',
            pressed: '#bdbdbd',
            bg: '#E0E0E0',
            active: '#D5D5D5',
            check: '#A0A0A0',
          },
          red: {
            DEFAULT: '#F44336',
            hover: '#EF5350',
            dark: '#D32F2F',
            light: '#FFEBEE',
          },
          orange: {
            DEFAULT: '#FF9800',
            hover: '#F57C00',
            dark: '#E65100',
            light: '#FFF3E0',
          },
          dark: {
            bg: '#0F172A',
            card: '#1E293B',
            text: '#F8FAFC',
          }
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
