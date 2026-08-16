/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Color-theme tokens — every value below reads from a CSS variable
        // (see index.css `[data-color-theme]` blocks) so the whole app's
        // accent, hero, and blue-scale palette can be swapped at runtime via
        // the Settings page theme picker, without touching any component.
        // `gray` and the semantic `signal.static/amber/teal` maturity colors
        // stay fixed across themes — they're shared neutrals / domain
        // semantics, not brand identity.
        navy: {
          DEFAULT: 'rgb(var(--color-navy) / <alpha-value>)',
          50: 'rgb(var(--color-navy-50) / <alpha-value>)',
          100: 'rgb(var(--color-navy-100) / <alpha-value>)',
          900: 'rgb(var(--color-navy) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
        },
        silver: {
          DEFAULT: 'rgb(var(--color-silver) / <alpha-value>)',
        },
        blue: {
          50: 'rgb(var(--color-blue-50) / <alpha-value>)',
          100: 'rgb(var(--color-blue-100) / <alpha-value>)',
          200: 'rgb(var(--color-blue-200) / <alpha-value>)',
          300: 'rgb(var(--color-blue-300) / <alpha-value>)',
          400: 'rgb(var(--color-blue-400) / <alpha-value>)',
          500: 'rgb(var(--color-blue-500) / <alpha-value>)',
          600: 'rgb(var(--color-blue-600) / <alpha-value>)',
          700: 'rgb(var(--color-blue-700) / <alpha-value>)',
          800: 'rgb(var(--color-blue-800) / <alpha-value>)',
          900: 'rgb(var(--color-blue-900) / <alpha-value>)',
          950: 'rgb(var(--color-blue-950) / <alpha-value>)',
        },
        // Steel-navy neutrals — overrides Tailwind's built-in `gray` scale so
        // every card, border, and body-text color across the app (which is
        // almost entirely written as `bg-white dark:bg-gray-800`,
        // `border-gray-200 dark:border-gray-700`, etc.) is tinted toward a
        // consistent cool steel hue instead of a generic neutral grey.
        // Fixed across all color themes on purpose — see the note above.
        gray: {
          50: '#F1F4F8',
          100: '#E4E9F0',
          200: '#CBD4E0',
          300: '#A8B4C4',
          400: '#7C8AA0',
          500: '#5C6A80',
          600: '#465268',
          700: '#313C52',
          800: '#1F2738',
          900: '#151B28',
          950: '#0D1119',
        },
        // "Noise → clear signal" maturity gradient — used for the signal meter, maturity
        // level colors, and report score bars. `static`/`amber`/`teal` are fixed domain
        // semantics (Initial/Developing/Defined) shared across every color theme.
        // `clear` (the "Optimized" end of the gradient) tracks the active theme's
        // accent instead, since it's the color that carries the palette's identity
        // on marketing surfaces like the homepage hero.
        signal: {
          static: '#8C7B63',
          amber: '#D98A3D',
          teal: '#2E8B78',
          clear: 'rgb(var(--color-signal-clear) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        'signal-scan': {
          '0%': { left: '0%', opacity: '0' },
          '8%': { opacity: '1' },
          '45%': { left: 'calc(100% - 3px)', opacity: '1' },
          '55%': { left: 'calc(100% - 3px)', opacity: '1' },
          '92%': { opacity: '1' },
          '100%': { left: '0%', opacity: '0' },
        },
      },
      animation: {
        'signal-scan': 'signal-scan 3.2s cubic-bezier(.65,0,.35,1) infinite',
      },
    },
  },
  plugins: [],
}
