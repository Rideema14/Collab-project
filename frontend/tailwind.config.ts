import type { Config } from 'tailwindcss';

/**
 * Tailwind is wired to the SEMANTIC token layer only (see globals.css).
 * There is deliberately no `blue-500` or `slate-800` exposed here — a component
 * literally cannot reach for a raw palette value, which is what makes the
 * dark theme a token swap instead of a rebuild.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // Replace (not extend) the palette so raw Tailwind colours are unavailable.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      bg: 'var(--color-bg)',
      surface: 'var(--color-surface)',
      'surface-muted': 'var(--color-surface-muted)',
      'surface-raised': 'var(--color-surface-raised)',
      elevated: 'var(--color-elevated)',
      glass: 'var(--glass-bg)',
      'glass-strong': 'var(--glass-bg-strong)',

      border: 'var(--color-border)',
      'border-strong': 'var(--color-border-strong)',
      'glass-border': 'var(--glass-border)',

      text: 'var(--color-text)',
      'text-muted': 'var(--color-text-muted)',
      'text-subtle': 'var(--color-text-subtle)',
      'text-inverse': 'var(--color-text-inverse)',

      primary: 'var(--color-primary)',
      'primary-hover': 'var(--color-primary-hover)',
      'primary-soft': 'var(--color-primary-soft)',
      'primary-fg': 'var(--color-primary-fg)',
      'primary-on-soft': 'var(--color-primary-on-soft)',

      accent: 'var(--color-accent)',
      'accent-soft': 'var(--color-accent-soft)',
      'accent-fg': 'var(--color-accent-fg)',

      success: 'var(--color-success)',
      'success-soft': 'var(--color-success-soft)',
      'success-fg': 'var(--color-success-fg)',

      warning: 'var(--color-warning)',
      'warning-soft': 'var(--color-warning-soft)',
      'warning-fg': 'var(--color-warning-fg)',

      danger: 'var(--color-danger)',
      'danger-hover': 'var(--color-danger-hover)',
      'danger-soft': 'var(--color-danger-soft)',
      'danger-fg': 'var(--color-danger-fg)',

      focus: 'var(--color-focus)',
      overlay: 'var(--color-overlay)',
      skeleton: 'var(--color-skeleton)',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glass: 'var(--shadow-glass)',
        glow: 'var(--shadow-glow)',
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
        'gradient-brand-soft': 'var(--gradient-brand-soft)',
        'gradient-surface': 'var(--gradient-surface)',
      },
      backdropBlur: {
        glass: 'var(--blur-glass)',
      },
      transitionTimingFunction: {
        premium: 'var(--ease-out)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulse: {
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 160ms ease-out',
        pulse: 'pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
