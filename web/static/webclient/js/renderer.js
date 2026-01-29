import {
  F_BLINK,
  F_BOLD,
  DEFAULT_BG,
  DEFAULT_FG,
  normalizeNewlines,
  applySgrCodes,
  F_INVERSE,
  isCp437Char, CP437_MISSING
} from "./ansi.js";
import {CONFIG} from "./config.js";
import {el} from "./dom_utils.js";
import {clamp} from "./utils.js";

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

// todo: is this deprecated / vestigial?
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

export function clearRectFb(fb, x0, y0, w, h) {
  const cols = fb[0]?.length ?? 0;
  const rows = fb.length;

  const rx0 = Math.max(0, Math.min(cols, x0));
  const ry0 = Math.max(0, Math.min(rows, y0));
  const rx1 = Math.max(0, Math.min(cols, x0 + w));
  const ry1 = Math.max(0, Math.min(rows, y0 + h));

  for (let y = ry0; y < ry1; y++) {
    const row = fb[y];
    for (let x = rx0; x < rx1; x++) {
      const cell = row[x];
      cell.ch = " ";
      cell.fg = DEFAULT_FG;
      cell.bg = DEFAULT_BG;
      cell.flags = 0;
    }
  }
}

// SGR-only parser and writer.
// Writes sequentially into fb starting at (x0,y0) within a rectangle of size (w,h).
// Newlines advance rows; overflow clamps (no scrolling yet).
export function drawRectAnsiToFb(fb, text, x0, y0, w, h) {
  const cols = fb[0]?.length ?? 0;
  const rows = fb.length;

  // Clip the rect to framebuffer bounds (defensive)
  const rx0 = clamp(x0, 0, cols);
  const ry0 = clamp(y0, 0, rows);
  const rx1 = clamp(x0 + w, 0, cols);
  const ry1 = clamp(y0 + h, 0, rows);
  const rw = Math.max(0, rx1 - rx0);
  const rh = Math.max(0, ry1 - ry0);

  let s = normalizeNewlines(text);

  let x = 0;
  let y = 0;

  const pen = { fg: DEFAULT_FG, bg: DEFAULT_BG, flags: 0 };

  // Fast path: nothing to draw
  if (rw === 0 || rh === 0) return;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    // Newline
    if (ch === "\n") {
      x = 0;
      y++;
      if (y >= rh) break;
      continue;
    }

    // CSI SGR: ESC [ ... m
    if (ch === "\x1b" && s[i + 1] === "[") {
      // Scan until 'm' or abort if too long / malformed
      let j = i + 2;
      let params = "";
      while (j < s.length) {
        const cj = s[j];
        if (params.length > 16) {
          console.warn("[write ANSI] Malformed CSI SGR code:", params);
          i = j-1; // advance as cleanly as possible
          continue;
        }
        if (cj === "m") break;

        // Basic guard: only accept digits/semicolons for SGR
        // If we hit something else, treat as malformed and stop.
        if (!((cj >= "0" && cj <= "9") || cj === ";")) {
          break;
        }
        params += cj;
        j++;
      }

      if (j < s.length && s[j] === "m") {
        const codes = params.length ? params.split(";") : [];
        applySgrCodes(pen, codes);
        i = j; // advance past 'm'
        continue;
      }

      // Malformed sequence: skip just the ESC, continue processing the rest.
      continue;
    }

    // Ignore char if NUL or control
    if (ch < " " || ch === "\x7f") continue;

    // Write printable char
    if (x < rw && y < rh) {
      const gx = rx0 + x;
      const gy = ry0 + y;

      // Write in-place to avoid allocating new objects per char.
      // (We still compute fg/bg swap if inverse is set.)
      let fg = pen.fg;
      let bg = pen.bg;
      if (pen.flags & F_INVERSE) {
        const t = fg;
        fg = bg;
        bg = t;
      }

      const cell = fb[gy][gx];

      // Determine output glyph + per-cell flags
      let outCh = ch;
      let outFlags = pen.flags;

      // Sanitize only glyphs, not ANSI/control stream
      if (!isCp437Char(ch)) {
        outCh = CP437_MISSING;
        outFlags |= F_BLINK; // highlight invalid glyphs
      }

      cell.ch = outCh;
      cell.fg = fg;
      cell.bg = bg;
      cell.flags = outFlags;
    }

    x++;
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

/**
 * Apply one FrameCommandList to the framebuffer.
 * Renderer owns framebuffer mutation and command semantics.
 *
 * Renderer clips only; producers must pre-wrap with `\n`.
 */
export function applyFrameCommands(fb, commands, defaults) {
  const cols = defaults?.cols ?? (fb[0]?.length ?? 0);
  const rows = defaults?.rows ?? fb.length;

  for (const cmd of commands) {
    if (!cmd || typeof cmd !== "object") {
      console.warn("[renderer] invalid command (non-object)", cmd);
      continue;
    }

    if (cmd.name === "hold") {
      break; // engine-level guarantee, but harmless here too
    }

    if (cmd.name === "clearRect") {
      const x = (cmd.rStart?.[0] ?? 0);
      const y = (cmd.rStart?.[1] ?? 0);
      const w = (cmd.rSize?.[0] ?? cols);
      const h = (cmd.rSize?.[1] ?? rows);

      clearRectFb(fb, x, y, w, h);
      continue;
    }

    if (cmd.name === "drawRect") {
      const x = (cmd.rStart?.[0] ?? 0);
      const y = (cmd.rStart?.[1] ?? 0);
      const w = (cmd.rSize?.[0] ?? cols);
      const h = (cmd.rSize?.[1] ?? rows);
      const text = String(cmd.rText ?? "<RENDERER ERROR: no rText for drawRect>");

      drawRectAnsiToFb(fb, text, x, y, w, h);
      continue;
    }

    console.warn("[renderer] unknown command!", cmd);
  }
}
