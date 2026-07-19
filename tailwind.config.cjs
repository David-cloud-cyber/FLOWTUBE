/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  prefix: 'af-',
  corePlugins: { preflight: false },
  theme: { extend: { transitionTimingFunction: { flow: 'cubic-bezier(.22,1,.36,1)' } } },
};
