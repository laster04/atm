/** @type {import('tailwindcss').Config} */

// Every colour token is an "R G B" triple in src/index.css, so each one is
// wrapped here in rgb(var(--x) / <alpha-value>). That wrapper is what makes
// opacity modifiers work — `bg-primary/90` on a token holding a finished
// colour emits no rule at all, and fails silently.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        brand: {
          DEFAULT: token('brand'),
          ink: token('brand-ink'),
          text: token('brand-text'),
        },
        navy: token('navy'),
        ice: token('ice'),
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        subtle: {
          foreground: token('subtle-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
          soft: token('success-soft'),
          strong: token('success-strong'),
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          soft: token('warning-soft'),
          strong: token('warning-strong'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
          soft: token('destructive-soft'),
          strong: token('destructive-strong'),
        },
        border: {
          DEFAULT: token('border'),
          subtle: token('border-subtle'),
        },
        input: {
          DEFAULT: token('input'),
          background: token('input-background'),
        },
        'switch-background': token('switch-background'),
        ring: token('ring'),
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          primary: token('sidebar-primary'),
          'primary-foreground': token('sidebar-primary-foreground'),
          accent: token('sidebar-accent'),
          'accent-foreground': token('sidebar-accent-foreground'),
          border: token('sidebar-border'),
          ring: token('sidebar-ring'),
        },
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
        },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 12px)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
