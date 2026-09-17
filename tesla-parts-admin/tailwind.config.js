/** Tailwind збирається на білді (PostCSS), а не CDN-скриптом у браузері:
 *  без попередження «should not be used in production», швидший перший рендер. */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './AuthContext.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './constants.ts',
    './types.ts',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        'tesla-red': '#E82127',
        'tesla-dark': '#171A20',
      },
      fontFamily: {
        manrope: ['Manrope', 'Inter', 'sans-serif'],
        montserrat: ['Montserrat', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
