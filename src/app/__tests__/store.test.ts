import { describe, expect, it } from 'vitest';
import { THEMES, useApp } from '../store.js';

describe('app store', () => {
  it('cycles through the three themes and back', () => {
    useApp.getState().setTheme('light');
    const seen = [useApp.getState().theme];
    for (let i = 0; i < THEMES.length; i++) {
      useApp.getState().cycleTheme();
      seen.push(useApp.getState().theme);
    }
    expect(seen).toEqual(['light', 'dark', 'eink', 'light']);
  });

  it('sets a theme directly', () => {
    useApp.getState().setTheme('eink');
    expect(useApp.getState().theme).toBe('eink');
    useApp.getState().setTheme('light');
  });
});
