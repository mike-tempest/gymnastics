import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        // Brand palette - Mint
        brand: {
          DEFAULT: '#85FFC7',
          dark: '#5CEFAA',
          light: '#B2FFE0',
          muted: 'rgba(133, 255, 199, 0.15)',
        },
        // Deep Teal (navigation, headers, dark surfaces)
        teal: {
          DEFAULT: '#297373',
          light: '#3A9E9E',
          dark: '#1E5555',
          darker: '#163F3F',
          deepest: '#0F2D2D',
        },
        // Coral (CTA accent, highlights, attention)
        coral: {
          DEFAULT: '#FF8552',
          hover: '#FF6B33',
          light: '#FFB899',
          dark: '#E66A35',
          muted: 'rgba(255, 133, 82, 0.15)',
        },
        // Canvas and surfaces (Light Grey based)
        canvas: {
          DEFAULT: '#E6E6E6',
          light: '#F0F0F0',
          dark: '#D9D9D9',
        },
        surface: {
          DEFAULT: '#F0F0F0',
          hover: '#E6E6E6',
        },
        // Dark palette (Deep Teal derived)
        dark: {
          primary: '#0F2D2D',
          secondary: '#163F3F',
          tertiary: '#1E5555',
          card: '#1E5555',
        },
        // Grey system (no pure white/black)
        grey: {
          50: '#F0F0F0',
          100: '#E6E6E6',
          200: '#CCCCCC',
          300: '#B3B3B3',
          400: '#999999',
          500: '#808080',
          600: '#666666',
          700: '#4D4D4D',
          800: '#39393A',
          900: '#2A2A2B',
        },
        // Semantic colours
        warning: '#FFB020',
        danger: '#FF4D4D',
        info: '#4D9FFF',
        success: '#85FFC7',
        // Legacy aliases (for gradual migration)
        sage: {
          light: '#F0F0F0',
          DEFAULT: '#E6E6E6',
          dark: '#D9D9D9',
        },
        lime: {
          light: '#B2FFE0',
          DEFAULT: '#85FFC7',
          dark: '#5CEFAA',
        },
        text: {
          primary: '#39393A',
          secondary: '#666666',
          tertiary: '#999999',
        },
        card: {
          light: '#F0F0F0',
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      boxShadow: {
        glow: '0 0 30px rgba(133, 255, 199, 0.2)',
        'glow-sm': '0 0 15px rgba(133, 255, 199, 0.15)',
        card: '0 1px 3px rgba(57, 57, 58, 0.08), 0 1px 2px rgba(57, 57, 58, 0.06)',
        'card-hover': '0 4px 12px rgba(57, 57, 58, 0.12), 0 2px 4px rgba(57, 57, 58, 0.08)',
        soft: '0 1px 2px rgba(57, 57, 58, 0.06)',
      },
      borderRadius: {
        card: '20px',
        button: '12px',
        xl: '16px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
