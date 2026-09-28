/** The five approved Tumblebase colours (TEM-114). */
export const tumblebasePalette = {
  gold: '#FFBC42',
  raspberry: '#D81159',
  plum: '#8F2D56',
  teal: '#218380',
  aqua: '#73D2DE',
} as const;

/** Semantic roles and legacy aliases consumed by Tailwind. */
export const brandColours = {
  // Aqua highlights and actions with dark text
  brand: {
    DEFAULT: tumblebasePalette.aqua,
    dark: '#55B8C5',
    light: '#BAE8EE',
    muted: 'rgba(115, 210, 222, 0.15)',
  },
  // Teal, with deeper shades for text and dark surfaces
  teal: {
    DEFAULT: tumblebasePalette.teal,
    light: '#399A97',
    dark: '#176562',
    darker: '#194148',
    deepest: '#122F35',
  },
  // Raspberry actions; plum is the darker hover state
  coral: {
    DEFAULT: tumblebasePalette.raspberry,
    hover: tumblebasePalette.plum,
    light: '#F6B8CE',
    dark: tumblebasePalette.plum,
    muted: 'rgba(216, 17, 89, 0.15)',
  },
  gold: {
    DEFAULT: tumblebasePalette.gold,
    light: '#FFF0D3',
    dark: '#926000',
  },
  plum: {
    DEFAULT: tumblebasePalette.plum,
    light: '#FBE7EE',
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
  // Dark teal surfaces
  dark: {
    primary: '#122F35',
    secondary: '#194148',
    tertiary: '#20515A',
    card: '#20515A',
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
  warning: tumblebasePalette.gold,
  danger: '#FF4D4D',
  info: tumblebasePalette.aqua,
  success: tumblebasePalette.aqua,
  // Legacy aliases (for gradual migration)
  sage: {
    light: '#FAF9F5',
    DEFAULT: '#F4F2EC',
    dark: '#E7E4DC',
  },
  lime: {
    light: '#FFF0D3',
    DEFAULT: tumblebasePalette.gold,
    dark: '#E3A42F',
  },
  text: {
    primary: '#39393A',
    secondary: '#666666',
    tertiary: '#999999',
  },
} as const;
