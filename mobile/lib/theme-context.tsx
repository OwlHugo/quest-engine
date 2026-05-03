import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  ColorPalette,
  PaletteName,
  PaletteSet,
  ThemeMode,
  palettes,
} from './theme';

const MODE_KEY = 'qe_theme_mode';
const PALETTE_KEY = 'qe_theme_palette';

type ThemeState = {
  mode: ThemeMode;
  isDark: boolean;
  paletteName: PaletteName;
  palette: PaletteSet;
  colors: ColorPalette;
  setMode: (m: ThemeMode) => void;
  setPalette: (p: PaletteName) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

function isPaletteName(v: unknown): v is PaletteName {
  return v === 'forest' || v === 'ocean' || v === 'plum' || v === 'sunset' || v === 'mono';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [paletteName, setPaletteNameState] = useState<PaletteName>('forest');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedMode, storedPalette] = await Promise.all([
        SecureStore.getItemAsync(MODE_KEY),
        SecureStore.getItemAsync(PALETTE_KEY),
      ]);
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode);
      }
      if (isPaletteName(storedPalette)) {
        setPaletteNameState(storedPalette);
      }
      setHydrated(true);
    })();
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const palette = palettes[paletteName];
  const colors = isDark ? palette.dark : palette.light;

  function setMode(m: ThemeMode) {
    setModeState(m);
    void SecureStore.setItemAsync(MODE_KEY, m);
  }

  function setPalette(p: PaletteName) {
    setPaletteNameState(p);
    void SecureStore.setItemAsync(PALETTE_KEY, p);
  }

  const value = useMemo<ThemeState>(
    () => ({ mode, isDark, paletteName, palette, colors, setMode, setPalette }),
    [mode, isDark, paletteName, palette, colors],
  );

  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
