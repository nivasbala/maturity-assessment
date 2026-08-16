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
        navy: {
          DEFAULT: '#1B2B4B',
          50: '#E8EDF5',
          100: '#C5D0E4',
          900: '#1B2B4B',
        },
        brand: {
          DEFAULT: '#2563EB',
        },
        ink: {
          DEFAULT: '#12192B',
        },
        // "Noise → clear signal" maturity gradient — used for the signal meter, maturity
        // level colors, and report score bars. Distinct from `brand` (the app's primary
        // interactive blue, used for buttons/links throughout per CLAUDE.md).
        signal: {
          static: '#8C7B63',
          amber: '#D98A3D',
          teal: '#2E8B78',
          clear: '#1FA8E0',
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
