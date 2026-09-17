/** Tailwind збирається на етапі білда (PostCSS), а не CDN-скриптом у браузері.
 *  Це прибирає попередження «should not be used in production», прискорює
 *  перший рендер і робить CSS детермінованим.
 */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './constants.ts',
    './types.ts',
  ],
  future: {
    // hover-стилі лише там, де є справжній курсор: на тачскріні вони «залипали»
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        tesla: ['TESLA', 'sans-serif'],
      },
      colors: {
        tesla: {
          red: '#e82127',
          dark: '#171a20',
          gray: '#393c41',
          light: '#f4f4f4',
        },
      },
    },
  },
  plugins: [],
};
