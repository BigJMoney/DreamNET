import {CONFIG} from "./config.js";

/*

HTML and DOM utilities.

 */


export function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`[terminal] missing #${id}`);
  return node;
}

export function waitNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function waitForFonts() {
  if (!(document.fonts && document.fonts.load)) return;

  const spec = `${CONFIG.termFont.size} "${CONFIG.termFont.face}"`;
  console.log("[fonts] load begin", spec);
  await document.fonts.load(spec);
  console.log("[fonts] load end", spec);

  // optional best-effort
  if (document.fonts.ready) {
    try { await document.fonts.ready; } catch {}
  }
}
