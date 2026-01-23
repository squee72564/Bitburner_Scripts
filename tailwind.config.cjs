/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./bitburner/scripts/**/*.{ts,tsx}', './bitburner/ui/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
