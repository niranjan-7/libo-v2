import React from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { COLOR_SWATCHES, THEME_PRESETS, ThemePresetId, DensityMode, FontSizeScale } from '../../theme/tokens';
import { Drawer } from '../ui/Drawer';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface AppearanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceDrawer: React.FC<AppearanceDrawerProps> = ({ isOpen, onClose }) => {
  const {
    theme,
    setPreset,
    setAccent,
    setDarkMode,
    setDensity,
    setRadius,
    setFontSize,
    resetDefaults,
  } = useTheme();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="PERSONALIZE YOUR SPACE"
      title="Appearance"
      description="Tune the library to your taste."
      icon={<Sparkles size={20} />}
    >
      {/* 1. Visual Theme Presets */}
      <div className="style-section" style={{ paddingTop: 0 }}>
        <div className="style-section-title">Visual theme</div>
        <div className="theme-presets">
          {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
            const p = THEME_PRESETS[presetKey];
            const isSelected = theme.preset === presetKey;
            const previewClasses = {
              editorial: 'editorial-preview',
              soft: 'soft-preview',
              crisp: 'crisp-preview',
            };

            return (
              <button
                key={presetKey}
                type="button"
                className={`theme-preset ${isSelected ? 'selected' : ''}`}
                onClick={() => setPreset(presetKey)}
              >
                <span className={`theme-preview ${previewClasses[presetKey]}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Accent Color Swatches */}
      <div className="style-section">
        <div className="style-section-title">Accent color</div>
        <div className="swatches">
          {COLOR_SWATCHES.map((swatch) => {
            const isSelected = theme.accent === swatch.accent;
            return (
              <button
                key={swatch.id}
                type="button"
                className={`swatch ${isSelected ? 'selected' : ''}`}
                style={{ background: swatch.accent }}
                aria-label={swatch.name}
                title={swatch.name}
                onClick={() => setAccent(swatch.accent)}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Layout & Typography */}
      <div className="style-section">
        <div className="style-section-title">Layout & typography</div>

        <div className="field">
          <label htmlFor="densitySelect">Content density</label>
          <select
            id="densitySelect"
            value={theme.density}
            onChange={(e) => setDensity(e.target.value as DensityMode)}
            className="field-select"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label htmlFor="radiusRange" style={{ margin: 0 }}>Corner roundness</label>
            <output style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 750 }}>
              {theme.radius} px
            </output>
          </div>
          <input
            id="radiusRange"
            type="range"
            min={8}
            max={24}
            value={theme.radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="field">
          <label htmlFor="fontSizeSelect">Text scale</label>
          <select
            id="fontSizeSelect"
            value={theme.fontSize}
            onChange={(e) => setFontSize(e.target.value as FontSizeScale)}
            className="field-select"
          >
            <option value="13px">Small (13px)</option>
            <option value="14px">Default (14px)</option>
            <option value="15px">Large (15px)</option>
            <option value="16px">Extra large (16px)</option>
          </select>
        </div>
      </div>

      {/* 4. Dark Appearance Mode */}
      <div className="style-section" style={{ borderBottom: 'none' }}>
        <Switch
          checked={theme.darkMode}
          onChange={setDarkMode}
          label="Dark appearance"
          description="Easy on the eyes, day or night."
        />
      </div>

      {/* 5. Footer Actions */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <Button variant="secondary" onClick={resetDefaults}>
          Reset
        </Button>
        <Button
          variant="primary"
          onClick={onClose}
          style={{ flex: 1 }}
          iconRight={<ArrowRight size={14} />}
        >
          Apply appearance
        </Button>
      </div>

      <p style={{ marginTop: '16px', color: 'var(--muted)', fontSize: '11px', lineHeight: 1.5 }}>
        Settings apply instantly to CSS custom properties and are preserved locally.
      </p>
    </Drawer>
  );
};
