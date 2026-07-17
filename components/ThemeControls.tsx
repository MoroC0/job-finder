'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type AccentTone = 'amber' | 'blue' | 'emerald' | 'rose' | 'violet' | 'slate';

const ACCENT_OPTIONS: Array<{ label: string; value: AccentTone }> = [
  { label: 'Amber', value: 'amber' },
  { label: 'Blue', value: 'blue' },
  { label: 'Emerald', value: 'emerald' },
  { label: 'Rose', value: 'rose' },
  { label: 'Violet', value: 'violet' },
  { label: 'Slate', value: 'slate' },
];

const STORAGE_KEYS = {
  theme: 'job-finder-theme',
  accent: 'job-finder-accent',
} as const;

export function ThemeControls() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState<AccentTone>('amber');

  useEffect(() => {
    const storedTheme = readStoredTheme();
    const storedAccent = readStoredAccent();

    setTheme(storedTheme);
    setAccent(storedAccent);
    applyTheme(storedTheme, storedAccent);
  }, []);

  function handleThemeChange(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme, accent);
    window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  }

  function handleAccentChange(nextAccent: AccentTone) {
    setAccent(nextAccent);
    applyTheme(theme, nextAccent);
    window.localStorage.setItem(STORAGE_KEYS.accent, nextAccent);
  }

  return (
    <div className="theme-controls" aria-label="Display settings">
      <div className="theme-toggle" role="tablist" aria-label="Theme mode">
        <button
          type="button"
          className={theme === 'light' ? 'theme-toggle-button is-active' : 'theme-toggle-button'}
          onClick={() => handleThemeChange('light')}
          role="tab"
          aria-selected={theme === 'light'}
        >
          Light
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'theme-toggle-button is-active' : 'theme-toggle-button'}
          onClick={() => handleThemeChange('dark')}
          role="tab"
          aria-selected={theme === 'dark'}
        >
          Dark
        </button>
      </div>
      <label className="accent-picker">
        <span>Accent</span>
        <select value={accent} onChange={(event) => handleAccentChange(event.target.value as AccentTone)}>
          {ACCENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function applyTheme(theme: ThemeMode, accent: AccentTone) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
}

function readStoredTheme(): ThemeMode {
  const storedValue = window.localStorage.getItem(STORAGE_KEYS.theme);
  return storedValue === 'dark' ? 'dark' : 'light';
}

function readStoredAccent(): AccentTone {
  const storedValue = window.localStorage.getItem(STORAGE_KEYS.accent);
  return ACCENT_OPTIONS.some((option) => option.value === storedValue) ? (storedValue as AccentTone) : 'amber';
}
