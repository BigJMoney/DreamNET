import {F_BLINK, F_BOLD, DEFAULT_BG, DEFAULT_FG} from "./ansi.js";
import {CONFIG} from "./config.js";
import {el} from "./dom_utils.js";

/*

Renderer for the webclient that features "old school" ANSI terminal emulation; a framebuffer comprised of a
 fixed grid of cels. Once the framebuffer has been logically drawn in memory, it is then converted to HTML and sent
  to the webclient page. This cycle itsle is managed by the engine, and is performed each frame, according to the
   fps set by the frame limiter.

Takes input from AnimationDriver and various input Writers, rather than directly from the game.

 */


let framebuffer = null;
let surfaceEl = null;
let _initialized = false;


function _assertInitialized() {
  if (!_initialized) { throw new Error("[renderer] not initialized") }
}

function makeCell(ch = " ", fg = DEFAULT_FG, bg = DEFAULT_BG, flags = 0) {
  return { ch, fg, bg, flags };
}

function makeFramebuffer(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell())
  );
}

// Derive CSS class string for a given cell.
function classesForCell(c) {
  let cls = `fg${c.fg} bg${c.bg}`;

  if (c.flags & F_BOLD) cls += " b";
  if (c.flags & F_BLINK) cls += " blink";

  // NOTE: inverse is applied at write-time in MVP, so no class needed.
  return cls;
}

function escapeHtml(s) {
  // Minimal escape for innerHTML
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

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

export function initRenderer() {
  // Do safety checks at API boundary
  if (_initialized) {
    throw new Error("[renderer] initRenderer called twice (single-instance invariant)");
  }
  framebuffer = makeFramebuffer(CONFIG.termCols | 0, CONFIG.termRows | 0);
  if (framebuffer == null) throw new Error("[renderer] framebuffer creation failed during initialization");
  surfaceEl = el("termSurface");
  _initialized = true;
}

export function clearFramebuffer() {
  _assertInitialized();
  const rows = framebuffer.length;
  const cols = framebuffer[0]?.length ?? 0;
  for (let y = 0; y < rows; y++) {
    const row = framebuffer[y];
    for (let x = 0; x < cols; x++) {
      // reset cell in-place to avoid new allocations
      row[x].ch = " ";
      row[x].fg = DEFAULT_FG;
      row[x].bg = DEFAULT_BG;
      row[x].flags = 0;
    }
  }
}

export function getFramebuffer() {
  _assertInitialized();
  return framebuffer;
}

export function renderFramebuffer() {
  _assertInitialized();
  const rows = framebuffer.length;
  const cols = framebuffer[0]?.length ?? 0;

  let html = "";

  for (let y = 0; y < rows; y++) {
    const row = framebuffer[y];

    // Build runs of identical style
    let runCls = null;
    let runText = "";

    for (let x = 0; x < cols; x++) {
      const c = row[x];
      const cls = classesForCell(c);

      if (runCls === null) {
        runCls = cls;
        runText = c.ch;
        continue;
      }

      if (cls === runCls) {
        runText += c.ch;
      } else {
        html += `<span class="${runCls}">${escapeHtml(runText)}</span>`;
        runCls = cls;
        runText = c.ch;
      }
    }
    if (runCls !== null) {
      html += `<span class="${runCls}">${escapeHtml(runText)}</span>`;
    }
    if (y !== rows - 1) html += "\n";
  }
  surfaceEl.innerHTML = html;
}
