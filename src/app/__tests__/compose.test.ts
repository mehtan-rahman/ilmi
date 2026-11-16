// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installComposing } from '../compose.js';

describe('a composition\'s keys are the input method\'s', () => {
  it('⏎ while composing reaches no handler; the same key after it does', () => {
    const field = document.createElement('input');
    document.body.append(field);
    const seen: string[] = [];
    field.addEventListener('keydown', (e) => seen.push(e.key));
    document.addEventListener('keydown', (e) => seen.push(`doc:${e.key}`));
    const undo = installComposing(window);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 229 }));
    expect(seen).toEqual([]);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(seen).toEqual(['Enter', 'doc:Enter']);
    undo();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    expect(seen).toEqual(['Enter', 'doc:Enter', 'Escape', 'doc:Escape']);
  });
});
