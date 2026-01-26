/*

Framebuffer calculations and helpers; mostly to support the rendering engine.

 */

import {DEFAULT_BG, DEFAULT_FG} from "./ansi.js";

function makeCell(ch = " ", fg = DEFAULT_FG, bg = DEFAULT_BG, flags = 0) {
  return { ch, fg, bg, flags };
}

export function makeFramebuffer(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell())
  );
}

export function clearFramebuffer(fb) {
  const rows = fb.length;
  const cols = fb[0]?.length ?? 0;
  for (let y = 0; y < rows; y++) {
    const row = fb[y];
    for (let x = 0; x < cols; x++) {
      // reset cell in-place to avoid new allocations
      row[x].ch = " ";
      row[x].fg = DEFAULT_FG;
      row[x].bg = DEFAULT_BG;
      row[x].flags = 0;
    }
  }
}

export function measureCellFrom(surfaceEl) {
  const measurer = document.createElement("span");
  measurer.setAttribute("aria-hidden", "true");
  measurer.style.position = "absolute";
  measurer.style.left = "-99999px";
  measurer.style.top = "0";
  measurer.style.whiteSpace = "pre";
  measurer.style.visibility = "hidden";
  measurer.style.pointerEvents = "none";

  surfaceEl.appendChild(measurer);

  const N = 200;
  measurer.textContent = "█".repeat(N);
  const rectW = measurer.getBoundingClientRect().width;
  const w = rectW / N;

  measurer.textContent = "█\n".repeat(40);
  const rectH = measurer.getBoundingClientRect().height;
  const h = rectH / 40;

  measurer.remove();
  return { w, h };
}
