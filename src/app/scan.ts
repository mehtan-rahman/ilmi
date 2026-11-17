// `scan a code` (milestone 84): the camera of an iPhone or an iPad reading a
// pairing code (`pair.ts`) off another device's screen. The camera is the
// barcode-scanner plugin's, QR codes only. It is shown behind the page: while
// a scan runs the page carries `data-scanning`, by which everything of the
// app is hidden and the page is see-through, and what is left on the glass
// is a line saying what to point at and `cancel`.
//
// What was read is handed back and nothing else is done with it here: it is
// not logged and not kept. A camera the system will not give is said in
// plain words, and whatever asked still has its fields to type in.

export const CAMERA_OFF = 'camera access is off · allow it for ilmi in the system\'s settings, or type the fields';
export const NO_CAMERA = 'no camera on this device · type the fields';

type DevScan = () => Promise<string | null>;
let devScan: DevScan | null = null;

/** Dev only: what stands in for the camera (a simulator has none): the text "read", null for a scan cancelled, a throw for a camera refused. A release takes no notice. */
export function setDevScan(fn: DevScan | null): void {
  devScan = fn;
}

let overlay: HTMLElement | null = null;

function show(onCancel: () => void): void {
  const el = document.createElement('div');
  el.className = 'scan';
  const frame = el.appendChild(document.createElement('div'));
  frame.className = 'scan-frame';
  const foot = el.appendChild(document.createElement('div'));
  foot.className = 'scan-foot';
  const line = foot.appendChild(document.createElement('span'));
  line.className = 'scan-line';
  line.textContent = 'point the camera at the code on the other device';
  const cancel = foot.appendChild(document.createElement('button'));
  cancel.type = 'button';
  cancel.className = 'scan-cancel';
  cancel.textContent = 'cancel';
  cancel.addEventListener('click', onCancel);
  document.body.appendChild(el);
  document.documentElement.setAttribute('data-scanning', '1');
  overlay = el;
}

function hide(): void {
  overlay?.remove();
  overlay = null;
  document.documentElement.removeAttribute('data-scanning');
}

/**
 * The text of the QR code the camera is shown; null when the scan was
 * cancelled. Throws `CAMERA_OFF` when the system does not let the app use
 * the camera, `NO_CAMERA` where there is none.
 */
export async function scanCode(): Promise<string | null> {
  if (import.meta.env.DEV && devScan) return devScan();
  const { Format, cancel, checkPermissions, requestPermissions, scan } = await import('@tauri-apps/plugin-barcode-scanner');
  let allowed = await checkPermissions();
  if (allowed !== 'granted' && allowed !== 'denied') allowed = await requestPermissions();
  if (allowed !== 'granted') throw new Error(CAMERA_OFF);
  let cancelled = false;
  show(() => { cancelled = true; void cancel().catch(() => {}); });
  try {
    const got = await scan({ windowed: true, formats: [Format.QRCode] });
    return typeof got?.content === 'string' ? got.content : null;
  } catch (e) {
    if (cancelled) return null;
    const why = e instanceof Error ? e.message : String(e);
    if (/denied/i.test(why)) throw new Error(CAMERA_OFF);
    throw new Error(NO_CAMERA);
  } finally {
    hide();
  }
}
