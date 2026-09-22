// What the intake knows about a piece of text before it becomes a file.
// Pure; the vault side is `Vault.importDoc`, the surface `src/app/Intake.tsx`.

/** Line endings to `\n`, a byte-order mark dropped, outer whitespace trimmed. */
export function cleanText(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
}

/** The first non-empty line, heading marks stripped, at most 64 characters. */
export function deriveTitle(text: string): string {
  const line = text.split('\n').map((s) => s.trim()).find(Boolean) ?? '';
  return line.replace(/^#+\s*/, '').replace(/\s+#+$/, '').slice(0, 64).trim();
}

/** A dropped file's name without its extension. */
export function titleFromFileName(name: string): string {
  const base = name.slice(name.lastIndexOf('/') + 1);
  return base.replace(/\.(txt|md|markdown|text|rtf|html?)$/i, '');
}

export interface Stats {
  words: number;
  paragraphs: number;
  /** At 220 words a minute, never under one. */
  minutes: number;
}

export function stats(text: string): Stats {
  const t = text.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const paragraphs = t ? t.split(/\n\s*\n/).filter((s) => s.trim()).length : 0;
  return { words, paragraphs, minutes: Math.max(1, Math.round(words / 220)) };
}

/** One `http` or `https` address and nothing else. */
export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/** Extensions the intake reads from a dropped file. */
export const TEXT_EXT = /\.(txt|md|markdown|text)$/i;
export const HTML_EXT = /\.html?$/i;
