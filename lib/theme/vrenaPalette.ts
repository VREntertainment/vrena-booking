export const vrenaPalette = {
  white: '#ffffff',
  purple: {
    50: '#edf2ff',
    100: '#dde6ff',
    200: '#c2d0ff',
    300: '#9eb2ff',
    400: '#7788ff',
    500: '#525bfd',
    600: '#3d38f3',
    700: '#332cd6',
    800: '#2a26ad',
    900: '#272788',
    950: '#19174f',
  },
  cyan: {
    50: '#ebfffd',
    100: '#cefffd',
    200: '#a2fffd',
    300: '#63fdfb',
    400: '#1cf3f4',
    500: '#00e9ed',
    600: '#03abb7',
    700: '#0a8894',
    800: '#126d78',
    900: '#145965',
    950: '#063c46',
  },
  orange: {
    50: '#fff7ec',
    100: '#ffecd3',
    200: '#ffd6a6',
    300: '#ffb96d',
    400: '#ff9033',
    500: '#ff710b',
    600: '#fd5901',
    700: '#cb3f03',
    800: '#a1320b',
    900: '#812b0d',
    950: '#461304',
  },
  yellow: {
    50: '#fffdea',
    100: '#fff9c5',
    200: '#fff285',
    300: '#ffe546',
    400: '#ffd51b',
    500: '#ffb800',
    600: '#e28e00',
    700: '#bb6302',
    800: '#984c08',
    900: '#7c3e0b',
    950: '#482000',
  },
  green: {
    50: '#f4fef6',
    100: '#eafdef',
    200: '#d6fce2',
    300: '#b9facf',
    400: '#87f8b9',
    500: '#49f59f',
    600: '#16d07b',
    700: '#12b469',
    800: '#0d9458',
    900: '#097f4e',
    950: '#0d4f34',
  },
  blue: {
    50: '#f0f8fe',
    100: '#e2f1fd',
    200: '#cae4fd',
    300: '#a8d4fc',
    400: '#7cbdfd',
    500: '#47a8fc',
    600: '#0d8ce1',
    700: '#0979c2',
    800: '#0663a2',
    900: '#1b5486',
    950: '#173251',
  },
  red: {
    50: '#fff1f0',
    100: '#ffe4e3',
    200: '#feccc9',
    300: '#feaba6',
    400: '#fc7c75',
    500: '#f5454a',
    600: '#dc0e31',
    700: '#be0a29',
    800: '#9d071f',
    900: '#82181c',
    950: '#4d120e',
  },
  neutral: {
    50: '#fafbfb',
    100: '#f5f7f7',
    200: '#eeeeee',
    300: '#d8dede',
    400: '#b8c3c3',
    500: '#879595',
    600: '#5f6d6d',
    700: '#3b4a4a',
    800: '#1b2929',
    900: '#0b1717',
    950: '#020e0e',
  },
} as const

export const vrenaSemanticColors = {
  dayPrimary: vrenaPalette.purple[500],
  dayPrimaryHover: vrenaPalette.purple[600],
  darkPrimary: vrenaPalette.orange[600],
  darkPrimaryHover: vrenaPalette.orange[500],
  secondary: vrenaPalette.cyan[500],
  warning: vrenaPalette.yellow[500],
  success: vrenaPalette.green[500],
  info: vrenaPalette.blue[500],
  danger: vrenaPalette.red[500],
  ink: vrenaPalette.neutral[950],
  muted: vrenaPalette.neutral[600],
  surface: vrenaPalette.white,
} as const

export const vrenaLogoGradients = {
  cool: ['#525bfd', '#00ffe5'],
  warm: ['#ff3c00', '#ffb800'],
} as const

export const vrenaCtaGradients = {
  day: ['#00ffea', '#109fff'],
  dark: ['#ffb800', '#fd5901'],
} as const

export const vrenaCtaHierarchy = {
  day: {
    primary: {
      gradient: vrenaCtaGradients.day,
      ink: vrenaPalette.neutral[950],
      disabledBackground: vrenaPalette.neutral[200],
      disabledInk: vrenaPalette.neutral[500],
    },
    secondary: {
      background: vrenaPalette.white,
      border: vrenaPalette.purple[500],
      ink: vrenaPalette.purple[600],
      hoverBackground: vrenaPalette.purple[50],
      hoverBorder: vrenaPalette.purple[500],
      hoverInk: vrenaPalette.purple[600],
      pressedBackground: vrenaPalette.purple[100],
      pressedBorder: vrenaPalette.purple[500],
      pressedInk: vrenaPalette.purple[600],
    },
    tertiary: {
      ink: vrenaPalette.purple[600],
      hoverBackground: vrenaPalette.purple[50],
      pressedBackground: vrenaPalette.purple[100],
    },
    focus: {
      inner: vrenaPalette.neutral[50],
      halo: vrenaPalette.cyan[700],
    },
  },
  dark: {
    primary: {
      gradient: vrenaCtaGradients.dark,
      ink: vrenaPalette.neutral[950],
      disabledBackground: vrenaPalette.neutral[800],
      disabledInk: vrenaPalette.neutral[600],
    },
    secondary: {
      background: vrenaPalette.neutral[900],
      border: vrenaPalette.orange[400],
      ink: vrenaPalette.orange[400],
      hoverBackground: vrenaPalette.neutral[800],
      hoverBorder: vrenaPalette.orange[300],
      hoverInk: vrenaPalette.orange[300],
      pressedBackground: vrenaPalette.orange[950],
      pressedBorder: vrenaPalette.orange[200],
      pressedInk: vrenaPalette.orange[200],
    },
    tertiary: {
      ink: vrenaPalette.orange[300],
      hoverBackground: vrenaPalette.neutral[800],
      pressedBackground: vrenaPalette.neutral[900],
    },
    focus: {
      inner: vrenaPalette.neutral[950],
      halo: vrenaPalette.cyan[300],
    },
  },
} as const

export const vrenaUiSemantics = {
  day: {
    accent: vrenaPalette.purple[500],
    accentInk: vrenaPalette.purple[700],
    accentSoft: vrenaPalette.purple[50],
    accentBorder: vrenaPalette.purple[200],
    selection: {
      background: vrenaPalette.purple[50],
      border: vrenaPalette.purple[200],
      ink: vrenaPalette.purple[700],
      indicator: vrenaPalette.purple[500],
    },
  },
  dark: {
    accent: vrenaPalette.orange[400],
    accentInk: vrenaPalette.orange[300],
    accentSoft: vrenaPalette.neutral[800],
    accentBorder: vrenaPalette.orange[400],
    selection: {
      background: vrenaPalette.neutral[800],
      border: vrenaPalette.orange[400],
      ink: vrenaPalette.orange[300],
      indicator: vrenaPalette.orange[400],
    },
  },
  status: {
    success: vrenaPalette.green,
    info: vrenaPalette.blue,
    warning: vrenaPalette.yellow,
    danger: vrenaPalette.red,
  },
} as const

export const vrenaAvatarColors = [
  vrenaPalette.purple[500],
  vrenaPalette.cyan[500],
  vrenaPalette.green[500],
  vrenaPalette.yellow[500],
  vrenaPalette.red[500],
  vrenaPalette.blue[500],
  vrenaPalette.orange[600],
  vrenaPalette.neutral[950],
] as const

export const vrenaAvatarTextColors = [
  vrenaPalette.white,
  vrenaPalette.neutral[950],
  vrenaPalette.yellow[100],
  vrenaPalette.cyan[100],
  vrenaPalette.red[100],
  vrenaPalette.green[100],
] as const

export function vrenaRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
