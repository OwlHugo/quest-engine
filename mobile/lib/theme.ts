export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorPalette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;

  accent: string;
  accentDark: string;

  danger: string;
  dangerDark: string;

  info: string;
  infoDark: string;

  text: string;
  textMuted: string;
  textInverse: string;

  bg: string;
  bgMuted: string;
  border: string;
  borderStrong: string;

  cardBg: string;
  done: string;
  skipped: string;

  eventBg: string;

  surfaceInvert: string;
};

export type PaletteName = 'forest' | 'ocean' | 'plum' | 'sunset' | 'mono';

export type PaletteSet = {
  name: PaletteName;
  label: string;
  emoji: string;
  light: ColorPalette;
  dark: ColorPalette;
};

const forest: PaletteSet = {
  name: 'forest',
  label: 'Floresta',
  emoji: '🌲',
  light: {
    primary: '#3D6B4A', primaryDark: '#264D33', primaryLight: '#7AAB87',
    accent: '#D4A24C', accentDark: '#A07B33',
    danger: '#B8413C', dangerDark: '#852B27',
    info: '#467599', infoDark: '#2D5470',
    text: '#2A2D26', textMuted: '#5F6259', textInverse: '#FFFFFF',
    bg: '#FAF8F2', bgMuted: '#EFEDE3', border: '#DCD8C8', borderStrong: '#B8B49C',
    cardBg: '#FFFFFF', done: '#D4E9D7', skipped: '#F4D4D2', eventBg: '#E1E8EE',
    surfaceInvert: '#2A2D26',
  },
  dark: {
    primary: '#7AAB87', primaryDark: '#3D6B4A', primaryLight: '#A0C5A8',
    accent: '#E5BC65', accentDark: '#A07B33',
    danger: '#D66360', dangerDark: '#8E3A37',
    info: '#7CA8C9', infoDark: '#3F6987',
    text: '#E8E4D6', textMuted: '#A1A192', textInverse: '#15181A',
    bg: '#15181A', bgMuted: '#1F2326', border: '#33383C', borderStrong: '#4F5559',
    cardBg: '#1B1F22', done: '#2D4035', skipped: '#40292A', eventBg: '#1F2A33',
    surfaceInvert: '#E8E4D6',
  },
};

const ocean: PaletteSet = {
  name: 'ocean',
  label: 'Oceano',
  emoji: '🌊',
  light: {
    primary: '#1E5F8A', primaryDark: '#0F3F5C', primaryLight: '#5C95BC',
    accent: '#FF8A6C', accentDark: '#C45B3F',
    danger: '#C03A48', dangerDark: '#822530',
    info: '#3E92B5', infoDark: '#266581',
    text: '#152736', textMuted: '#536878', textInverse: '#FFFFFF',
    bg: '#F4F7FA', bgMuted: '#E5ECF2', border: '#CFD8E0', borderStrong: '#9DAAB8',
    cardBg: '#FFFFFF', done: '#D4E5F0', skipped: '#F4D4D2', eventBg: '#FFE4D9',
    surfaceInvert: '#152736',
  },
  dark: {
    primary: '#6FA8D3', primaryDark: '#3E739A', primaryLight: '#9BC4E0',
    accent: '#FFB199', accentDark: '#C76C50',
    danger: '#D66874', dangerDark: '#8E3942',
    info: '#86B8D1', infoDark: '#4978A0',
    text: '#E0E8F0', textMuted: '#90A0B0', textInverse: '#0F1620',
    bg: '#0F1620', bgMuted: '#18222E', border: '#2D3A4A', borderStrong: '#48576B',
    cardBg: '#141D29', done: '#1E3344', skipped: '#3D2228', eventBg: '#3A2A21',
    surfaceInvert: '#E0E8F0',
  },
};

const plum: PaletteSet = {
  name: 'plum',
  label: 'Ameixa',
  emoji: '🍇',
  light: {
    primary: '#6B2D5C', primaryDark: '#3F1A36', primaryLight: '#A06490',
    accent: '#8AA89C', accentDark: '#54716A',
    danger: '#B23A48', dangerDark: '#7A2630',
    info: '#5C6B8A', infoDark: '#3A4760',
    text: '#2A1424', textMuted: '#665062', textInverse: '#FFFFFF',
    bg: '#FBF7F4', bgMuted: '#EFE7EA', border: '#DACDD3', borderStrong: '#A89AA0',
    cardBg: '#FFFFFF', done: '#D9E4DD', skipped: '#F4D4D8', eventBg: '#E0E2EC',
    surfaceInvert: '#2A1424',
  },
  dark: {
    primary: '#B07399', primaryDark: '#6B3F58', primaryLight: '#C99CB7',
    accent: '#A0BFB2', accentDark: '#5C7A6F',
    danger: '#D2666F', dangerDark: '#883C44',
    info: '#8694B0', infoDark: '#505D78',
    text: '#E8DCE5', textMuted: '#A496A0', textInverse: '#1A0E18',
    bg: '#1A0E18', bgMuted: '#241620', border: '#3A2A35', borderStrong: '#564555',
    cardBg: '#1F121C', done: '#2A3A35', skipped: '#3F222A', eventBg: '#252836',
    surfaceInvert: '#E8DCE5',
  },
};

const sunset: PaletteSet = {
  name: 'sunset',
  label: 'Pôr do Sol',
  emoji: '🌅',
  light: {
    primary: '#C04E1F', primaryDark: '#852F0E', primaryLight: '#E08560',
    accent: '#6B3FA0', accentDark: '#3F1F6B',
    danger: '#A03030', dangerDark: '#6E1F1F',
    info: '#4A6A8C', infoDark: '#2E465E',
    text: '#2D1810', textMuted: '#6B524A', textInverse: '#FFFFFF',
    bg: '#FFF7F0', bgMuted: '#F5EAE0', border: '#E5D4C5', borderStrong: '#B89E88',
    cardBg: '#FFFFFF', done: '#F0E2D2', skipped: '#F4D4D2', eventBg: '#E0D8EC',
    surfaceInvert: '#2D1810',
  },
  dark: {
    primary: '#FF8A4F', primaryDark: '#C45A26', primaryLight: '#FFB082',
    accent: '#9B6FCC', accentDark: '#5C3D8E',
    danger: '#D66060', dangerDark: '#8C3838',
    info: '#7E9DBE', infoDark: '#48638A',
    text: '#F0E4D6', textMuted: '#B0978A', textInverse: '#1A100A',
    bg: '#1A100A', bgMuted: '#241810', border: '#3D2C1F', borderStrong: '#5C4533',
    cardBg: '#1F1410', done: '#3F2A18', skipped: '#3F1F22', eventBg: '#2A2438',
    surfaceInvert: '#F0E4D6',
  },
};

const mono: PaletteSet = {
  name: 'mono',
  label: 'Mono',
  emoji: '⚪',
  light: {
    primary: '#1A1A1A', primaryDark: '#000000', primaryLight: '#4A4A4A',
    accent: '#707070', accentDark: '#3A3A3A',
    danger: '#9F1F1F', dangerDark: '#6E1313',
    info: '#404040', infoDark: '#1A1A1A',
    text: '#0A0A0A', textMuted: '#5C5C5C', textInverse: '#FFFFFF',
    bg: '#FFFFFF', bgMuted: '#F2F2F2', border: '#D6D6D6', borderStrong: '#A3A3A3',
    cardBg: '#FFFFFF', done: '#E0E0E0', skipped: '#EFD9D9', eventBg: '#E8E8E8',
    surfaceInvert: '#0A0A0A',
  },
  dark: {
    primary: '#F0F0F0', primaryDark: '#A8A8A8', primaryLight: '#FFFFFF',
    accent: '#A8A8A8', accentDark: '#707070',
    danger: '#D66060', dangerDark: '#8C3838',
    info: '#C0C0C0', infoDark: '#707070',
    text: '#F2F2F2', textMuted: '#9A9A9A', textInverse: '#0A0A0A',
    bg: '#0A0A0A', bgMuted: '#171717', border: '#2E2E2E', borderStrong: '#494949',
    cardBg: '#121212', done: '#262626', skipped: '#3D2222', eventBg: '#1F1F1F',
    surfaceInvert: '#F2F2F2',
  },
};

export const palettes: Record<PaletteName, PaletteSet> = {
  forest, ocean, plum, sunset, mono,
};

export const paletteOrder: PaletteName[] = ['forest', 'ocean', 'plum', 'sunset', 'mono'];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const font = {
  size: {
    xs: 12,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28,
  },
  weight: {
    regular: '500' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const lightColors = forest.light;
export const darkColors = forest.dark;
export const colors = lightColors;
