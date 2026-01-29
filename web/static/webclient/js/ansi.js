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
export const CP437_MISSING = "■";

// Flags bitfield (stored on cells, but currently only used for bold/inverse)
export const F_BOLD = 1 << 0;
export const F_BLINK = 1 << 2; // SGR 5/25
export const F_INVERSE = 1 << 1;

// 16-color defaults
export const DEFAULT_FG = 7; // light gray / “white”
export const DEFAULT_BG = 0; // black

export function isCp437Char(ch) {
  // (fine for BMP; non-BMP would come as surrogate halves and fail -> replaced)
  return CP437_CODEPOINTS.has(ch.codePointAt(0));
}

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

export function applySgrCodes(pen, codes) {
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

// -----------------------------------------------------------------------------
// Layout helpers: ANSI -> physical rows (streaming), with sparse init-pen detection
// -----------------------------------------------------------------------------

function isDefaultPen(pen) {
  return pen.fg === DEFAULT_FG && pen.bg === DEFAULT_BG && (pen.flags | 0) === 0;
}

function clonePen(pen) {
  return { fg: pen.fg, bg: pen.bg, flags: pen.flags | 0 };
}

/**
 * Create a streaming layout state for appendAnsiToRows.
 *
 * @returns {object}
 */
export function createAnsiRowLayoutState() {
  return {
    // Current pen and cursor
    pen: { fg: DEFAULT_FG, bg: DEFAULT_BG, flags: 0 },
    x: 0,

    // Open row being built
    openParts: [],
    rowHasGlyph: false,
    sawSgrBeforeFirstGlyph: false,
    rowStartPen: { fg: DEFAULT_FG, bg: DEFAULT_BG, flags: 0 },
    openRowInitPen: null, // Pen|null; decided on first glyph (or stays null)
  };
}

/**
 * Encode a pen as a single SGR sequence. (Used as a single prefix marker.)
 * Intentionally "boring": reset + set only supported attributes.
 *
 * @param {{fg:number,bg:number,flags:number}} pen
 * @returns {string}
 */
export function penToSgr(pen) {
  // Always start with reset to establish a known baseline.
  const codes = [0];

  // Bold / inverse (blink is not a "pen" requirement; keep if you want, but you
  // likely don't want to force blink just because pen.flags has it.)
  if (pen.flags & F_BOLD) codes.push(1);
  if (pen.flags & F_INVERSE) codes.push(7);

  // fg
  const fg = pen.fg | 0;
  if (fg >= 0 && fg <= 7) codes.push(30 + fg);
  else if (fg >= 8 && fg <= 15) codes.push(90 + (fg - 8));

  // bg
  const bg = pen.bg | 0;
  if (bg >= 0 && bg <= 7) codes.push(40 + bg);
  else if (bg >= 8 && bg <= 15) codes.push(100 + (bg - 8));

  return `\x1b[${codes.join(";")}m`;
}

function finalizeOpenRow(state, outRows, outRowInitPen) {
  outRows.push(state.openParts.join(""));
  outRowInitPen.push(state.openRowInitPen); // may be null; that's intentional

  // Start next row inheriting current pen (no replay markers added)
  state.openParts.length = 0;
  state.x = 0;
  state.rowHasGlyph = false;
  state.sawSgrBeforeFirstGlyph = false;
  state.rowStartPen = clonePen(state.pen);
  state.openRowInitPen = null;
}

/**
 * Append ANSI text to a physical-row buffer (wrapped by width).
 *
 * IMPORTANT: This does NOT add any replay markers. It preserves the incoming
 * SGR stream as-is and only splits into rows. It also computes sparse init-pen
 * metadata for each completed row (Pen|null).
 *
 * @param {object} state - from createAnsiRowLayoutState()
 * @param {string} text
 * @param {number} width - rect width in columns (must be > 0)
 * @param {string[]} outRows
 * @param {(object|null)[]} outRowInitPen
 */
export function appendAnsiToRows(state, text, width, outRows, outRowInitPen) {
  if (!state) throw new Error("[ansi] appendAnsiToRows missing state");
  if (!Array.isArray(outRows)) throw new Error("[ansi] outRows must be array");
  if (!Array.isArray(outRowInitPen)) throw new Error("[ansi] outRowInitPen must be array");

  const w = width | 0;
  if (w <= 0) return;

  const s = normalizeNewlines(text);

  // Ensure rowStartPen initialized if this is the first call
  if (!state.rowStartPen) state.rowStartPen = clonePen(state.pen);

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    // Newline: finalize row immediately (even if empty)
    if (ch === "\n") {
      finalizeOpenRow(state, outRows, outRowInitPen);
      continue;
    }

    // CSI SGR: ESC [ ... m
    if (ch === "\x1b" && s[i + 1] === "[") {
      let j = i + 2;
      let params = "";
      while (j < s.length) {
        const cj = s[j];
        if (params.length > 16) break;
        if (cj === "m") break;
        if (!((cj >= "0" && cj <= "9") || cj === ";")) break;
        params += cj;
        j++;
      }

      if (j < s.length && s[j] === "m") {
        // Preserve the original sequence verbatim in the row text.
        const seq = s.slice(i, j + 1);
        state.openParts.push(seq);

        // Mark that this row establishes pen before first glyph (if applicable)
        if (!state.rowHasGlyph) state.sawSgrBeforeFirstGlyph = true;

        const codes = params.length ? params.split(";") : [];
        applySgrCodes(state.pen, codes);

        i = j; // advance past 'm'
        continue;
      }

      // Malformed: preserve just ESC as-is? For now, drop it (matches prior behavior of "skip ESC").
      continue;
    }

    // Ignore control chars
    if (ch < " " || ch === "\x7f") continue;

    // Wrap check happens before writing the next printable glyph (matches your writer)
    if (state.x >= w) {
      finalizeOpenRow(state, outRows, outRowInitPen);
    }

    // Decide init-pen for this row at the first printable glyph, if needed
    if (!state.rowHasGlyph) {
      const startPenIsDefault = isDefaultPen(state.rowStartPen);
      if (!startPenIsDefault && !state.sawSgrBeforeFirstGlyph) {
        state.openRowInitPen = clonePen(state.rowStartPen);
      } else {
        state.openRowInitPen = null;
      }
      state.rowHasGlyph = true;
    }

    // Append glyph
    state.openParts.push(ch);
    state.x++;
  }
}
