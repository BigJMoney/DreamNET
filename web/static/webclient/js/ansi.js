/*

Input string ANSI checking and parsing

 */


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

// Flags bitfield (stored on cells, but currently only used for bold/inverse)
export const F_BOLD = 1 << 0;
export const F_BLINK = 1 << 2; // SGR 5/25
const F_INVERSE = 1 << 1;

// 16-color defaults
export const DEFAULT_FG = 7; // light gray / “white”
export const DEFAULT_BG = 0; // black

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isCp437Char(ch) {
  // (fine for BMP; non-BMP would come as surrogate halves and fail -> replaced)
  return CP437_CODEPOINTS.has(ch.codePointAt(0));
}

function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
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

// SGR-only parser and writer.
// Writes sequentially into fb starting at (x0,y0) within a rectangle of size (w,h).
// Newlines advance rows; overflow clamps (no scrolling yet).
export function writeAnsiSgrToRect(fb, text, x0, y0, w, h) {
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

    // Line wrap happens after non-printables are accounted for but before writing characters
    if (x >= rw) {
      x = 0;
      y++;
      if (y >= rh) break;
    }

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