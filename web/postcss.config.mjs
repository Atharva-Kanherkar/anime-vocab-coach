// Tailwind v4 runs as a PostCSS plugin. Utilities are opt-in per stylesheet:
// only `src/app/app/app.css` imports Tailwind, and it omits preflight so the
// marketing pages' own reset in globals.css is left completely untouched.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
