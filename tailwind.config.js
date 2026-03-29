/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./apps/views/**/*.ejs",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: "#3182CE",
        secondary: "#2F855A",
        background: "#F8FAFC",
        surface: "#FFFFFF",
        "on-surface": "#1A202C",
        "on-surface-variant": "#64748B",
        outline: "#E2E8F0",
        error: "#E53E3E",
        warning: "#DD6B20"
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
