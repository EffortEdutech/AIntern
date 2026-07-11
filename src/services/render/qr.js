/**
 * AIntern - QR helper (v1.1 R3, spec §27)
 *
 * Renders a QR code to a PNG data URL via canvas (browser only).
 * Uses the dependency-free `qrcode-generator` package; jsPDF and
 * docx both accept the resulting PNG.
 *
 * @file src/services/render/qr.js
 * @created July 11, 2026 - v1.1 R3
 */

import qrcode from 'qrcode-generator';

/**
 * @param {string} text  - content to encode (e.g. verify URL)
 * @param {number} px    - pixels per module (default 6)
 * @returns {string|null} PNG data URL, or null outside a browser
 */
export function qrPngDataUrl(text, px = 6) {
  if (typeof document === 'undefined') return null;
  const qr = qrcode(0, 'M'); // auto version, medium error correction
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 4; // quiet-zone modules
  const size = (count + quiet * 2) * px;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
      }
    }
  }
  return canvas.toDataURL('image/png');
}

export default qrPngDataUrl;
