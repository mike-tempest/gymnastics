import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E8DDD3',
          light: '#F5F0EB',
        },
        accent: {
          coral: '#E97458',
          orange: '#F5A962',
        },
        text: {
          dark: '#2D2D2D',
          light: '#8B8B8B',
        },
        card: {
          DEFAULT: '#FFFFFF',
          secondary: '#F9E5DB',
        },
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        card: '16px',
        button: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
