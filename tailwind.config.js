/** Tailwind config for EmpowerFit.
 *  Mirrors the theme the site used when Tailwind ran from the CDN.
 *  Regenerate the stylesheet after editing index.html:  npm run css
 */
module.exports = {
  darkMode: 'class',
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Nunito', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background-hsl))',
        foreground: 'hsl(var(--foreground-hsl))',
        card: 'hsl(var(--card-hsl))',
        primary: {
          DEFAULT: 'hsl(var(--primary-hsl))',
          foreground: 'hsl(var(--primary-foreground-hsl))'
        },
        secondary: { DEFAULT: 'hsl(var(--secondary-hsl))' },
        muted: { foreground: 'hsl(var(--muted-foreground-hsl))' },
        accent: 'hsl(var(--accent-hsl))',
        border: 'hsl(var(--border-hsl))'
      }
    }
  },
  plugins: []
};
