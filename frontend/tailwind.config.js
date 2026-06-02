/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0059bb', // Industrial Blue
          light: '#0070ea',
        },
        secondary: {
          DEFAULT: '#006a6a', // Precision Teal
        },
        danger: {
          DEFAULT: '#ba1a1a', // Error
        },
        surface: {
          DEFAULT: '#f9f9ff', // Light gray background
        },
        border: {
          DEFAULT: '#c1c6d7', // Hairline borders
        },
        text: {
          primary: '#181c23',
          secondary: '#414754'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '0.75rem',
      }
    },
  },
  plugins: [],
}
