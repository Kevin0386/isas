/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
        },
        accent: 'var(--accent)',
        sky: {
          DEFAULT: 'var(--sky)',
          mid: 'var(--sky-mid)',
          deep: 'var(--sky-deep)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg-card)',
          sidebar: 'var(--bg-sidebar)',
        },
        border: {
          DEFAULT: 'var(--border)',
          red: 'var(--border-red)',
        },
        text: {
          dark: 'var(--text-primary)',    // primary text colour
          body: 'var(--text-secondary)',  // secondary text
          muted: 'var(--text-muted)',     // muted / placeholder text
        },
        green: {
          DEFAULT: '#4CAF50',
          bg: 'rgba(76,175,80,0.12)',
          light: 'rgba(76,175,80,0.08)',
        },
        yellow: {
          DEFAULT: '#FFB300',
          bg: 'rgba(255,179,0,0.12)',
          light: 'rgba(255,179,0,0.06)',
        },
        blue: {
          DEFAULT: '#5C9CE6',
          bg: 'rgba(92,156,230,0.1)',
        },
        red: {
          bg: 'rgba(229,57,53,0.1)',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Sora', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        xl: '18px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}