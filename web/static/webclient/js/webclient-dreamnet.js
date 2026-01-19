/*
 *
 * DreamNET Webclient GUI component (framebuffer-first)
 *
 */

console.log("[terminal] script loaded");

const DEV = /[?&]dreamnetDev=1\b/.test(location.search);


// ---- Config (dev-time) ----
// Change these during development; treat as constants during play.

const CONFIG = {
  termCols: 135,
  termRows: 49,

  termFont: {
    face: "ToshibaSat_8x16",
    size: "16px",
    lineheight: "16px",
    spacing: "0px",
  },

  // Boot screen: set to the 135x49 plain snapshot.
  bootScreenUrl: "/static/webclient/ui/virtualmode.135x49.txt",
};

// Set dynamically so that font face has one source of truth
CONFIG.termFont.family = `"${CONFIG.termFont.face}", monospace`;

// CP437 byte->Unicode table (256 code points)
const CP437_UNICODE = [
  0x0000,0x263A,0x263B,0x2665,0x2666,0x2663,0x2660,0x2022,0x25D8,0x25CB,0x25D9,0x2642,0x2640,0x266A,0x266B,0x263C,
  0x25BA,0x25C4,0x2195,0x203C,0x00B6,0x00A7,0x25AC,0x21A8,0x2191,0x2193,0x2192,0x2190,0x221F,0x2194,0x25B2,0x25BC,
  0x0020,0x0021,0x0022,0x0023,0x0024,0x0025,0x0026,0x0027,0x0028,0x0029,0x002A,0x002B,0x002C,0x002D,0x002E,0x002F,
  0x0030,0x0031,0x0032,0x0033,0x0034,0x0035,0x0036,0x0037,0x0038,0x0039,0x003A,0x003B,0x003C,0x003D,0x003E,0x003F,
  0x0040,0x0041,0x0042,0x0043,0x0044,0x0045,0x0046,0x0047,0x0048,0x0049,0x004A,0x004B,0x004C,0x004D,0x004E,0x004F,
  0x0050,0x0051,0x0052,0x0053,0x0054,0x0055,0x0056,0x0057,0x0058,0x0059,0x005A,0x005B,0x005C,0x005D,0x005E,0x005F,
  0x0060,0x0061,0x0062,0x0063,0x0064,0x0065,0x0066,0x0067,0x0068,0x0069,0x006A,0x006B,0x006C,0x006D,0x006E,0x006F,
  0x0070,0x0071,0x0072,0x0073,0x0074,0x0075,0x0076,0x0077,0x0078,0x0079,0x007A,0x007B,0x007C,0x007D,0x007E,0x2302,
  0x00C7,0x00FC,0x00E9,0x00E2,0x00E4,0x00E0,0x00E5,0x00E7,0x00EA,0x00EB,0x00E8,0x00EF,0x00EE,0x00EC,0x00C4,0x00C5,
  0x00C9,0x00E6,0x00C6,0x00F4,0x00F6,0x00F2,0x00FB,0x00F9,0x00FF,0x00D6,0x00DC,0x00A2,0x00A3,0x00A5,0x20A7,0x0192,
  0x00E1,0x00ED,0x00F3,0x00FA,0x00F1,0x00D1,0x00AA,0x00BA,0x00BF,0x2310,0x00AC,0x00BD,0x00BC,0x00A1,0x00AB,0x00BB,
  0x2591,0x2592,0x2593,0x2502,0x2524,0x2561,0x2562,0x2556,0x2555,0x2563,0x2551,0x2557,0x255D,0x255C,0x255B,0x2510,
  0x2514,0x2534,0x252C,0x251C,0x2500,0x253C,0x255E,0x255F,0x255A,0x2554,0x2569,0x2566,0x2560,0x2550,0x256C,0x2567,
  0x2568,0x2564,0x2565,0x2559,0x2558,0x2552,0x2553,0x256B,0x256A,0x2518,0x250C,0x2588,0x2584,0x258C,0x2590,0x2580,
  0x03B1,0x00DF,0x0393,0x03C0,0x03A3,0x03C3,0x00B5,0x03C4,0x03A6,0x0398,0x03A9,0x03B4,0x221E,0x03C6,0x03B5,0x2229,
  0x2261,0x00B1,0x2265,0x2264,0x2320,0x2321,0x00F7,0x2248,0x00B0,0x2219,0x00B7,0x221A,0x207F,0x00B2,0x25A0,0x00A0
];

const CP437_CODEPOINTS = new Set(CP437_UNICODE);

// Use a CP437-safe placeholder. '■' (U+25A0) is CP437 byte 0xFE.
const CP437_MISSING = "■";


// ---- Style ----

function applyFontConfig() {
  const root = document.documentElement;
  root.style.setProperty("--term-font-family", CONFIG.termFont.family);
  root.style.setProperty("--term-font-px", CONFIG.termFont.size);
  root.style.setProperty("--term-font-lineheight", CONFIG.termFont.lineheight);
  root.style.setProperty("--term-font-letterspacing", CONFIG.termFont.spacing);
}


// ---- State ----

let framebuffer = null;          // Cell[][] length termRows x termCols
let cell = { w: 0, h: 0 };       // measured at k=1 from termSurface styles
let scaleK = 1;

let renderQueued = false;


// ---- Helpers ----

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`[terminal] missing #${id}`);
  return node;
}

function waitNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForFonts() {
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

function measureCellFrom(surfaceEl) {
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

function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

// Flags bitfield (stored on cells, but currently only used for bold/inverse)
const F_BOLD = 1 << 0;
const F_INVERSE = 1 << 1;
const F_BLINK = 1 << 2; // SGR 5/25

// 16-color defaults (you can change these if desired)
const DEFAULT_FG = 7; // light gray / “white”
const DEFAULT_BG = 0; // black

function makeCell(ch = " ", fg = DEFAULT_FG, bg = DEFAULT_BG, flags = 0) {
  return { ch, fg, bg, flags };
}

function makeFramebuffer(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => makeCell())
  );
}

function clearFramebuffer(fb) {
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

// Apply pen to a character; if inverse is set, swap fg/bg at write time (MVP).
function makeCellFromPen(ch, pen) {
  let fg = pen.fg;
  let bg = pen.bg;
  if (pen.flags & F_INVERSE) {
    const t = fg;
    fg = bg;
    bg = t;
  }
  return makeCell(ch, fg, bg, pen.flags);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function applySgrCodes(pen, codes) {
  // Empty SGR (ESC[m) equals reset.
  if (!codes.length) codes = [0];

  for (const raw of codes) {
    const code = Number(raw);
    if (!Number.isFinite(code)) continue;

    if (code === 0) {
      pen.fg = DEFAULT_FG;
      pen.bg = DEFAULT_BG;
      pen.flags = 0;
      continue;
    }
    if (code === 1) { pen.flags |= F_BOLD; continue; }
    if (code === 22) { pen.flags &= ~F_BOLD; continue; }
    if (code === 7) { pen.flags |= F_INVERSE; continue; }
    if (code === 27) { pen.flags &= ~F_INVERSE; continue; }

    if (code === 5)  { pen.flags |= F_BLINK; continue; }  // blink on
    if (code === 25) { pen.flags &= ~F_BLINK; continue; } // blink off

    // Optional defaults
    if (code === 39) { pen.fg = DEFAULT_FG; continue; }
    if (code === 49) { pen.bg = DEFAULT_BG; continue; }

    // 16-color foreground
    if (code >= 30 && code <= 37) { pen.fg = code - 30; continue; }
    if (code >= 90 && code <= 97) { pen.fg = (code - 90) + 8; continue; }

    // 16-color background
    if (code >= 40 && code <= 47) { pen.bg = code - 40; continue; }
    if (code >= 100 && code <= 107) { pen.bg = (code - 100) + 8; continue; }

    // Ignore unsupported SGR codes (MVP scope)
  }
}

function isCp437Char(ch) {

  // (fine for BMP; non-BMP would come as surrogate halves and fail -> replaced)
  return CP437_CODEPOINTS.has(ch.codePointAt(0));
}

// SGR-only parser and writer.
// Writes sequentially into fb starting at (x0,y0) within a rectangle of size (w,h).
// Newlines advance rows; overflow clamps (no scrolling yet).
function writeAnsiSgrToRect(fb, text, x0, y0, w, h) {
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
    // Autowrap at end of line unless there's already a newline char in the next cel
    if (x >= rw && s[i + 1] !== '\n') {
      x = 0;
      y++;
      if (y >= rh) break;
    }
  }
}


// ---- HTML rendering (span runs) ----

function escapeHtml(s) {
  // Minimal escape for innerHTML
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Derive CSS class string for a given cell.
function classesForCell(c) {
  let cls = `fg${c.fg} bg${c.bg}`;

  if (c.flags & F_BOLD) cls += " b";
  if (c.flags & F_BLINK) cls += " blink";

  // NOTE: inverse is applied at write-time in MVP, so no class needed.
  return cls;
}

function renderFramebufferToHtml(fb) {
  const rows = fb.length;
  const cols = fb[0]?.length ?? 0;

  let html = "";

  for (let y = 0; y < rows; y++) {
    const row = fb[y];

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
  return html;
}


// ---- Report ----

function publishTerminalReport(detail) {
  // Debug hook
  window.__dreamnetTerm = detail;

  // Global vars for debugging and future hit-testing / overlays
  document.documentElement.style.setProperty("--cell-w", `${detail.cellW}px`);
  document.documentElement.style.setProperty("--cell-h", `${detail.cellH}px`);
  document.documentElement.style.setProperty("--ui-scale", String(detail.scale));

  window.dispatchEvent(new CustomEvent("dreamnet:termreport", { detail }));
}

async function fetchText(url) {
  console.log("[fetch] begin", url);
  const res = await fetch(url, { cache: "no-store" }); // no-store is nice during dev
  console.log("[fetch] response", url, res.status, res.statusText);

  if (!res.ok) {
    throw new Error(`[fetch] failed ${res.status} ${res.statusText} for ${url}`);
  }

  const text = await res.text();
  console.log("[fetch] read text", url, { chars: text.length });
  return text;
}


// ---- Scaling ----

function computeScale(viewportW, viewportH, termPxW, termPxH) {
  // Largest integer k >= 1 that fits, else 1 (and we rely on scrolling).
  const kx = Math.floor(viewportW / termPxW);
  const ky = Math.floor(viewportH / termPxH);
  return Math.max(1, Math.min(kx, ky));
}

function applyScale(k) {
  const viewport = el("viewport");
  const root = el("terminalRoot");

  // Native terminal pixel size at k=1.
  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  // Set layout size so scrollbars represent scaled content accurately.
  const scaledW = Math.ceil(termPxW * k);
  const scaledH = Math.ceil(termPxH * k);
  root.style.width = `${scaledW}px`;
  root.style.height = `${scaledH}px`;

  // Apply visual scale (integer only).
  root.style.transform = `scale(${k})`;
  // IMPORTANT: after scaling, the *layout size* above is already scaled, so we must
  // "undo" layout scaling by sizing at k and scaling root back to 1? No:
  // We’re using transform scale, so layout size stays unscaled. Setting width/height
  // to scaled values makes scrolling match. This is what we want.

  // (Optional) helpful debug attrs
  viewport.dataset.scale = String(k);

  scaleK = k;

  publishTerminalReport({
    grid: { cols: CONFIG.termCols, rows: CONFIG.termRows },
    cellW: cell.w,
    cellH: cell.h,
    scale: k,
    termPxW,
    termPxH,
    scaledPxW: scaledW,
    scaledPxH: scaledH,
    viewportW: viewport.clientWidth,
    viewportH: viewport.clientHeight,
  });
}

function recomputeScale() {
  const viewport = el("viewport");

  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  const k = computeScale(viewport.clientWidth, viewport.clientHeight, termPxW, termPxH);
  if (k !== scaleK) {
    console.log("[scale] k", scaleK, "->", k);
  }
  applyScale(k);
}


// ---- Rendering ----

function renderFramebuffer() {
  const surface = el("termSurface");
  surface.innerHTML = renderFramebufferToHtml(framebuffer);
}

function requestRender(reason) {
  console.log("[render] request", reason);
  if (renderQueued) return; // Coalesce render into a consistent one per frame
  renderQueued = true;

  requestAnimationFrame(() => {
    console.log("[render] rAF paint begin (scheduled by)", reason);
    renderQueued = false;
    renderFramebuffer();
    console.log("[render] rAF paint end");
  });

  console.log("[render] scheduled rAF; end of call stack for", reason);
}


// ---- Boot screen loader ----

async function loadBootScreenText() {
  if (!CONFIG.bootScreenUrl) {
    // fallback: blank screen
    console.log("[boot] no bootScreenUrl; using blank framebuffer");
    return Array(CONFIG.termRows).fill("").join("\n");
  }

  try {
    const text = await fetchText(CONFIG.bootScreenUrl);
    console.log("[boot] loaded boot screen");
    return text;
  } catch (err) {
    console.warn("[boot] failed to load boot screen; using fallback", err);
    const header = `BOOT SCREEN LOAD FAILED`;
    return Array.from({ length: CONFIG.termRows }, (_, y) =>
      (y === 0 ? header : "").padEnd(CONFIG.termCols, " ").slice(0, CONFIG.termCols)
    ).join("\n");
  }
}


// ---- Wiring ----

function setupResizeHandling() {
  let timer = null;
  window.addEventListener("resize", () => {
    // Resize only recomputes scale; does not touch cols/rows.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      recomputeScale();
      requestRender("resize");
    }, 50);
  });
}


// ---- Startup ----

async function initializeTerminal() {
  console.log("[start] begin");

  console.log("[start] waitForFonts begin");
  applyFontConfig();
  await waitForFonts();
  console.log("[start] waitForFonts end");

  console.log("[start] settle frames begin");
  await waitNextFrame();
  await waitNextFrame();
  console.log("[start] settle frames end");

  console.log("[start] measure cell begin");
  cell = measureCellFrom(el("termSurface"));
  console.log("[start] measure cell end", cell);

  console.log("[start] init framebuffer begin");
  framebuffer = makeFramebuffer(CONFIG.termCols, CONFIG.termRows);
  console.log("[start] init framebuffer end");

  console.log("[start] load boot screen begin");
  const bootText = await loadBootScreenText();
  console.log("[start] load boot screen end");

  console.log("[start] paint boot screen begin");
  clearFramebuffer(framebuffer);
  // Full-screen write (MVP). Later, region writers will target rects.
  writeAnsiSgrToRect(framebuffer, bootText, 0, 0, CONFIG.termCols, CONFIG.termRows);
  console.log("[start] paint boot screen end");

  console.log("[start] initial scale+render begin");
  recomputeScale();
  requestRender("boot");
  console.log("[start] initial scale+render end");

  setupResizeHandling();

  console.log("[start] end");
}


// ---- Entry Point ----

let started = false;

function main() {
  if (started) {
    console.warn("[terminal] Subsequent startups attempted");
    return;
  }
  started = true;

  const Evennia = window.Evennia;
  // Optional: log connection state for debugging, but don't gate on it.
  if (Evennia) {
    console.log("[terminal] Evennia detected", Object.keys(Evennia));
  } else {
    console.warn("[terminal] Evennia not detected (no window.Evennia)");
  }

  // Start DreamNET UI immediately once the script loads.
  // This does not depend on websocket connection.
  console.log("[terminal] main; starting DreamNET");
  initializeTerminal().catch((err) => console.error("[terminal] start FAILED", err));
}

main();
