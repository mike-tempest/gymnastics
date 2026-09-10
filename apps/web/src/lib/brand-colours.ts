/** Tumblebase palette. Legacy aliases keep existing components consistent. */
export const brandColours = {
  // Brand palette: sage
  brand: {
    DEFAULT: '#B9D8CB',
    dark: '#A5CABB',
    light: '#D9E9E0',
    muted: 'rgba(185, 216, 203, 0.15)',
  },
  // Forest (navigation, headers, dark surfaces)
  teal: {
    DEFAULT: '#365E54',
    light: '#4E786C',
    dark: '#2D4A42',
    darker: '#243C35',
    deepest: '#1C302A',
  },
  // Terracotta (CTA accent, highlights, attention)
  coral: {
    DEFAULT: '#A44932',
    hover: '#893B2A',
    light: '#E6C7BC',
    dark: '#893B2A',
    muted: 'rgba(164, 73, 50, 0.15)',
  },
  // Canvas and surfaces (warm chalk)
  canvas: {
    DEFAULT: '#F4F2EC',
    light: '#FAF9F5',
    dark: '#E7E4DC',
  },
  surface: {
    DEFAULT: '#FAF9F5',
    hover: '#F4F2EC',
  },
  // Dark palette (Forest derived)
  dark: {
    primary: '#1C302A',
    secondary: '#243C35',
    tertiary: '#2D4A42',
    card: '#2D4A42',
  },
  // Grey system (no pure white/black)
  grey: {
    50: '#FAF9F5',
    100: '#F4F2EC',
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
  success: '#B9D8CB',
  // Legacy aliases (for gradual migration)
  sage: {
    light: '#FAF9F5',
    DEFAULT: '#F4F2EC',
    dark: '#E7E4DC',
  },
  lime: {
    light: '#D9E9E0',
    DEFAULT: '#B9D8CB',
    dark: '#A5CABB',
  },
  text: {
    primary: '#39393A',
    secondary: '#666666',
    tertiary: '#999999',
  },
} as const;
