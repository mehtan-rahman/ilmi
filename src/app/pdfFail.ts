// What the page says of a PDF that did not open, in plain lowercase words,
// by what went wrong (the lens, `Pdf.tsx`, shows it with `try again`, and
// tries again by itself when the file lands).

/** Why a PDF did not open: what the page says, and what is done about it. */
export interface PdfFail {
  /** `fell`: opening it took the page down the last time (it is not opened by itself again); `away`: its bytes are not on this device (yet); `absent`: the collection has no such file (yet); `locked`: it asks for a password; `broken`: it is not a PDF that can be read; `other`: anything else. */
  kind: 'away' | 'absent' | 'locked' | 'broken' | 'fell' | 'other';
  /** The line the page shows, lowercase. */
  said: string;
  /** A second, smaller line: what may help, or what was said underneath. */
  detail: string;
}

/**
 * What to say of a PDF that did not open. `there` is whether the collection has the file's row, `away` whether its
 * bytes are not on this device, `size` what the row says it weighs. A file whose bytes are away failed in the
 * fetch (it is still on its way from the device it was added on, or the storage could not be reached); one that is
 * here and will not parse says so, with its size, since a file cut short on its way reads as no PDF at all.
 */
export function pdfFail(e: unknown, there: boolean, away: boolean, size: number): PdfFail {
  const name = e instanceof Error ? e.name : '';
  const msg = (e instanceof Error ? e.message : String(e ?? '')).trim();
  const under = msg.toLowerCase().replace(/\s+/g, ' ').slice(0, 140);
  if (!there) return { kind: 'absent', said: 'its pdf is not in the collection', detail: 'if it was added on another device it may still be arriving' };
  if (away || /not in the storage yet|this file is not here/.test(under)) {
    const waiting = /not in the storage yet/.test(under);
    return { kind: 'away', said: 'not on this device yet', detail: waiting ? 'still arriving from the device it was added on' : /this file is not here/.test(under) ? 'this collection has no storage to fetch it from' : `could not be fetched${under ? `: ${under}` : ''}` };
  }
  if (name === 'PasswordException' || /password/.test(under)) return { kind: 'locked', said: 'this pdf is locked with a password', detail: '' };
  const mb = size <= 0 ? '' : size < 100 * 1024 ? `${Math.max(1, Math.round(size / 1024))} kb here` : `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} mb here`;
  if (name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'FormatError' || /invalid pdf|bad xref|unexpected end/.test(under)) return { kind: 'broken', said: 'this file does not read as a pdf', detail: [mb, 'it may have been cut short on its way'].filter(Boolean).join(' · ') };
  if (/out of memory|allocation|too large|rangeerror/.test(`${name.toLowerCase()} ${under}`)) return { kind: 'other', said: 'too large to read on this device', detail: [mb, under].filter(Boolean).join(' · ') };
  return { kind: 'other', said: 'could not open this pdf', detail: [mb, under].filter(Boolean).join(' · ') };
}
