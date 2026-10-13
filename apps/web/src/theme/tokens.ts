/**
 * Design Tokens & Theme Specification
 * Recreating modern UI language from design-reference/library_platform_interactive_prototype_v2.html
 */

export interface ColorSwatch {
  id: string;
  name: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSoftDark: string;
}

export const COLOR_SWATCHES: ColorSwatch[] = [
  {
    id: 'forest',
    name: 'Forest green',
    accent: '#235640',
    accentStrong: '#173e2d',
    accentSoft: '#e8f2eb',
    accentSoftDark: '#162e22',
  },
  {
    id: 'blue',
    name: 'Ocean blue',
    accent: '#315a8a',
    accentStrong: '#1e3f68',
    accentSoft: '#e8f0fc',
    accentSoftDark: '#233952',
  },
  {
    id: 'purple',
    name: 'Royal purple',
    accent: '#7a4b85',
    accentStrong: '#582f62',
    accentSoft: '#f3e8f7',
    accentSoftDark: '#3b2540',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    accent: '#b36a35',
    accentStrong: '#844b20',
    accentSoft: '#fbf0e8',
    accentSoftDark: '#4a301d',
  },
  {
    id: 'teal',
    name: 'Deep teal',
    accent: '#236b72',
    accentStrong: '#154e54',
    accentSoft: '#e6f5f6',
    accentSoftDark: '#1c3e42',
  },
  {
    id: 'berry',
    name: 'Wild berry',
    accent: '#9a4561',
    accentStrong: '#702e42',
    accentSoft: '#faeaf0',
    accentSoftDark: '#4a2431',
  },
];

export type ThemePresetId = 'editorial' | 'soft' | 'crisp';
export type DensityMode = 'comfortable' | 'compact';
export type FontSizeScale = '13px' | '14px' | '15px' | '16px';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  tagline: string;
  radius: number;
  space: number;
  fontSize: FontSizeScale;
  density: DensityMode;
  serifCover: boolean;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    tagline: 'Warm & refined',
    radius: 16,
    space: 18,
    fontSize: '14px',
    density: 'comfortable',
    serifCover: true,
  },
  soft: {
    id: 'soft',
    name: 'Soft cards',
    tagline: 'Friendly & rounded',
    radius: 20,
    space: 20,
    fontSize: '14px',
    density: 'comfortable',
    serifCover: true,
  },
  crisp: {
    id: 'crisp',
    name: 'Crisp',
    tagline: 'Clean & compact',
    radius: 8,
    space: 13,
    fontSize: '13px',
    density: 'compact',
    serifCover: false,
  },
};

export interface ThemeState {
  preset: ThemePresetId;
  accent: string;
  darkMode: boolean;
  density: DensityMode;
  radius: number;
  fontSize: FontSizeScale;
}

export const DEFAULT_THEME_STATE: ThemeState = {
  preset: 'editorial',
  accent: '#235640',
  darkMode: false,
  density: 'comfortable',
  radius: 16,
  fontSize: '14px',
};
