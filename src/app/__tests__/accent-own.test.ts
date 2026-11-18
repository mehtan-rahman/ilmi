import { describe, expect, it } from 'vitest';
import { ACCENTS, accentOf, useApp } from '../store.js';

describe("an accent of one's own", () => {
  it('reads a colour as the presets are given: hue and chroma, a lightness held readable in each theme', () => {
    const red = accentOf('#ff0000');
    expect(red.h).toBeGreaterThan(25);
    expect(red.h).toBeLessThan(33);
    expect(red.c).toBeGreaterThan(0.15);
    expect(red.c).toBeLessThanOrEqual(0.2);
    expect(red.light).toBeGreaterThanOrEqual(0.42);
    expect(red.light).toBeLessThanOrEqual(0.66);
    expect(red.dark).toBeGreaterThanOrEqual(0.7);
    expect(red.dark).toBeLessThanOrEqual(0.84);
    const blue = accentOf('#0000ff');
    expect(blue.h).toBeGreaterThan(255);
    expect(blue.h).toBeLessThan(270);
  });

  it('a grey has no chroma, and white and black are held to a lightness that shows', () => {
    expect(accentOf('#808080').c).toBeLessThan(0.002);
    expect(accentOf('#ffffff').light).toBe(0.66);
    expect(accentOf('#000000').light).toBe(0.42);
    expect(accentOf('#000000').dark).toBe(0.7);
  });

  it('is chosen over the presets, and a preset pressed afterwards puts it away', () => {
    useApp.getState().setAccentHex('#3366cc');
    expect(useApp.getState().accentHex).toBe('#3366cc');
    useApp.getState().setAccent('sage');
    expect(useApp.getState().accentHex).toBeNull();
    expect(useApp.getState().accent).toBe('sage');
    expect(ACCENTS.sage.label).toBe('sage');
  });
});
