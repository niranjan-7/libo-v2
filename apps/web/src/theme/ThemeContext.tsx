import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ThemeState,
  DEFAULT_THEME_STATE,
  THEME_PRESETS,
  COLOR_SWATCHES,
  ThemePresetId,
  DensityMode,
  FontSizeScale,
} from './tokens';

interface ThemeContextType {
  theme: ThemeState;
  setPreset: (presetId: ThemePresetId) => void;
  setAccent: (hex: string) => void;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  setDensity: (density: DensityMode) => void;
  setRadius: (radius: number) => void;
  setFontSize: (size: FontSizeScale) => void;
  resetDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'lib_platform_theme_v2';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_THEME_STATE;
  });

  // Apply theme variables directly to document DOM
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 1. Dark mode class
    if (theme.darkMode) {
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
    }

    // 2. Accent colors
    const swatch = COLOR_SWATCHES.find((s) => s.accent === theme.accent) || COLOR_SWATCHES[0];
    root.style.setProperty('--accent', swatch.accent);
    root.style.setProperty('--accent-strong', swatch.accentStrong);
    root.style.setProperty(
      '--accent-soft',
      theme.darkMode ? swatch.accentSoftDark : swatch.accentSoft,
    );

    // 3. Radius & Spacing
    root.style.setProperty('--radius', `${theme.radius}px`);
    const space = theme.density === 'compact' ? '13px' : '18px';
    root.style.setProperty('--space', space);

    // 4. Font scale
    root.style.setProperty('--font-size', theme.fontSize);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {}
  }, [theme]);

  const setPreset = (presetId: ThemePresetId) => {
    const preset = THEME_PRESETS[presetId];
    if (!preset) return;
    setTheme((prev) => ({
      ...prev,
      preset: presetId,
      radius: preset.radius,
      space: preset.space,
      density: preset.density,
      fontSize: preset.fontSize,
    }));
  };

  const setAccent = (hex: string) => {
    setTheme((prev) => ({ ...prev, accent: hex }));
  };

  const setDarkMode = (enabled: boolean) => {
    setTheme((prev) => ({ ...prev, darkMode: enabled }));
  };

  const toggleDarkMode = () => {
    setTheme((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  };

  const setDensity = (density: DensityMode) => {
    setTheme((prev) => ({ ...prev, density }));
  };

  const setRadius = (radius: number) => {
    setTheme((prev) => ({ ...prev, radius }));
  };

  const setFontSize = (fontSize: FontSizeScale) => {
    setTheme((prev) => ({ ...prev, fontSize }));
  };

  const resetDefaults = () => {
    setTheme(DEFAULT_THEME_STATE);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setPreset,
        setAccent,
        setDarkMode,
        toggleDarkMode,
        setDensity,
        setRadius,
        setFontSize,
        resetDefaults,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
