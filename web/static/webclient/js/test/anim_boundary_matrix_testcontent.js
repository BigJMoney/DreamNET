// animation_test_content_boundary_matrix.js
//
// Generates fullscreen text frames for DreamNET animation tests.
// Output: { meta, frames }
// - frames: Array<string>, each string is a fullscreen text frame (rows joined by '\n').
// Intended to be passed directly into animation.playFrames(frames, opts).
//
// Notes:
// - Lines are allowed to exceed `cols` to test crop/wrap behavior in the renderer.
// - Includes glyph bundles: G0, G2, G3, G5, and (optionally) G1.
// - Excludes G4 for now as requested (Evennia output risk unknown).

/**
 * @typedef {Object} BoundaryMatrixGenOpts
 * @property {number} cols
 * @property {number} rows
 * @property {boolean=} enableG1  - Include whitespace/control bundle (G1). Default true.
 * @property {boolean=} includeP3 - Include newline-boundary cases (P3). Default true.
 * @property {boolean=} includeP4 - Include trailing-whitespace cases (P4). Default true.
 * @property {boolean=} includeP5 - Include partial-overwrite cases (P5). Default true.
 */

/**
 * Generate fullscreen animation test content for
 * Matrix 1: Boundary × Placement × GlyphClass.
 *
 * The returned frames are **fullscreen text frames** (one string per frame,
 * rows joined by '\n') and are intended to be passed directly to
 * `playFrames(frames, opts)` with no region cropping.
 *
 * This generator is deterministic and bounded:
 * - Core placement patterns (P0/P2) are always included
 * - Conditional patterns (P3/P4/P5) are included based on options and bundle traits
 * - Glyph bundles G0, G2, G3, G5 are always included
 * - Glyph bundle G1 (whitespace/control) is optionally included to lock policy
 *
 * No engine behavior is modified by this function; it emits test content only.
 *
 * @param {BoundaryMatrixGenOpts} opts
 *
 * @returns {{
 *   meta: {
 *     suite: string,
 *     cols: number,
 *     rows: number,
 *     enableG1: boolean,
 *     includeP3: boolean,
 *     includeP4: boolean,
 *     includeP5: boolean,
 *     frameCount: number,
 *     targets: number
 *   },
 *   index: Array<{
 *     caseNo: number,
 *     target: { x: number, y: number, tag: string },
 *     placement: string,
 *     bundle: string,
 *     partner?: string
 *   }>,
 *   frames: string[]
 * }}
 *   An object containing:
 *   - `frames`: fullscreen text frames suitable for `playFrames()`
 *   - `index`: per-frame metadata describing the test case
 *   - `meta`: summary information for logging and diagnostics
 */
export function genBoundaryMatrixFrames(opts) {
  const cols = mustInt(opts.cols, "cols");
  const rows = mustInt(opts.rows, "rows");

  const enableG1 = opts.enableG1 ?? true;
  const includeP3 = opts.includeP3 ?? true;
  const includeP4 = opts.includeP4 ?? true;
  const includeP5 = opts.includeP5 ?? true;

  const bundles = buildGlyphBundles({ enableG1 });
  const targets = buildMatrixTargets(cols, rows);

  /** @type {string[]} */
  const frames = [];
  /** @type {Object[]} */
  const index = [];

  let caseNo = 0;

  // Helper: push a single fullscreen frame and record metadata
  function pushFrame(frameLines, meta) {
    frames.push(frameLines.join("\n"));
    index.push(meta);
  }

  for (let t = 0; t < targets.length; t++) {
    const target = targets[t];

    // --- Core: P0 with all enabled bundles
    for (const bundle of bundles.enabledAll) {
      caseNo++;
      pushFrame(
        makeFrameForCase({
          cols, rows,
          target,
          placement: "P0",
          bundle,
          caseNo,
        }),
        { caseNo, target, placement: "P0", bundle: bundle.id }
      );

      // Conditional: P3 for newline-capable content
      if (includeP3 && bundle.hasNewlinePotential) {
        caseNo++;
        pushFrame(
          makeFrameForCase({
            cols, rows,
            target,
            placement: "P3",
            bundle,
            caseNo,
          }),
          { caseNo, target, placement: "P3", bundle: bundle.id }
        );
      }

      // Conditional: P4 for whitespace-sensitive bundle
      if (includeP4 && bundle.isWhitespaceSensitive) {
        caseNo++;
        pushFrame(
          makeFrameForCase({
            cols, rows,
            target,
            placement: "P4",
            bundle,
            caseNo,
          }),
          { caseNo, target, placement: "P4", bundle: bundle.id }
        );
      }
    }

    // --- Core: P2 wrap/crop with subset bundles G0/G2/G5
    for (const bundle of bundles.p2Subset) {
      caseNo++;
      pushFrame(
        makeFrameForCase({
          cols, rows,
          target,
          placement: "P2",
          bundle,
          caseNo,
        }),
        { caseNo, target, placement: "P2", bundle: bundle.id }
      );
    }

    // --- Optional: P5 state-carry tests
    // P5 is emitted as TWO frames: base styled write, then partial overwrite.
    if (includeP5) {
      // P5 only makes sense with SGR + one non-SGR bundle (G2 or G3)
      const sgr = bundles.byId.G5;
      for (const nonSgr of [bundles.byId.G2, bundles.byId.G3]) {
        caseNo++;
        const base = makeFrameForCase({
          cols, rows,
          target,
          placement: "P5_BASE",
          bundle: sgr,
          caseNo,
          p5Partner: nonSgr,
        });
        pushFrame(base, { caseNo, target, placement: "P5_BASE", bundle: "G5", partner: nonSgr.id });

        caseNo++;
        const ovw = makeFrameForCase({
          cols, rows,
          target,
          placement: "P5_OVERWRITE",
          bundle: sgr,
          caseNo,
          p5Partner: nonSgr,
        });
        pushFrame(ovw, { caseNo, target, placement: "P5_OVERWRITE", bundle: "G5", partner: nonSgr.id });
      }
    }
  }

  return {
    meta: {
      suite: "boundary_matrix_fullscreen_v1",
      cols,
      rows,
      enableG1,
      includeP3,
      includeP4,
      includeP5,
      frameCount: frames.length,
      targets: targets.length,
    },
    index,
    frames,
  };
}

/* ----------------------------- Targets (Matrix 1) ----------------------------- */

function buildMatrixTargets(cols, rows) {
  const X0 = 0;
  const XL = cols - 1;
  const XLm1 = cols - 2;
  const Y0 = 0;
  const YB = rows - 1;

  const xMid = Math.floor(cols / 2);
  const yMid = Math.floor(rows / 2);

  return [
    // 4 corners
    { x: X0, y: Y0, tag: "corner_tl" },
    { x: XL, y: Y0, tag: "corner_tr" },
    { x: X0, y: YB, tag: "corner_bl" },
    { x: XL, y: YB, tag: "corner_br" },

    // 2 midpoints (as previously specified)
    { x: xMid, y: 0, tag: "mid_top" },
    { x: 0, y: yMid, tag: "mid_left" },

    // 2 row-wrap targets
    { x: XLm1, y: yMid, tag: "wrap_x=C-2" },
    { x: XL, y: yMid, tag: "wrap_x=C-1" },

    // 2 bottom-edge targets
    { x: xMid, y: rows - 2, tag: "near_bottom" },
    { x: xMid, y: YB, tag: "bottom" },
  ];
}

/* ----------------------------- Glyph Bundles --------------------------------- */

function buildGlyphBundles({ enableG1 }) {
  const ESC = "\x1b";

  const G0 = {
    id: "G0",
    desc: "ASCII basic",
    tokens: ["A", "z", "0", "!", "?", "@", "[", "]", "\\", "_"],
    hasNewlinePotential: false,
    isWhitespaceSensitive: false,
  };

  const G1 = {
    id: "G1",
    desc: "Whitespace/control (policy-locking)",
    tokens: [" ", "\t", "\r"], // NOTE: Fullscreen frames already use '\n' as row separators; see P3 for newline cases.
    hasNewlinePotential: true,
    isWhitespaceSensitive: true,
  };

  const G2 = {
    id: "G2",
    desc: "CP437 box drawing",
    tokens: ["─", "│", "┌", "┐", "└", "┘", "├", "┤", "┬", "┴", "┼"],
    hasNewlinePotential: false,
    isWhitespaceSensitive: false,
  };

  const G3 = {
    id: "G3",
    desc: "CP437 blocks/shades",
    tokens: ["░", "▒", "▓", "█"],
    hasNewlinePotential: false,
    isWhitespaceSensitive: false,
  };

  const G5 = {
    id: "G5",
    desc: "ANSI SGR sequences",
    tokens: [
      `${ESC}[31mX${ESC}[0m`,
      `${ESC}[1;33;47mY${ESC}[0m`,
      `${ESC}[mZ${ESC}[0m`,      // empty params
      `${ESC}[31mQ${ESC}[0m`,    // extra normal case
      `${ESC}[`                  // incomplete (deliberate)
    ],
    hasNewlinePotential: true,    // because malformed sequences can straddle boundaries
    isWhitespaceSensitive: false,
  };

  /** @type {any[]} */
  const enabledAll = [G0, G2, G3, G5];
  if (enableG1) enabledAll.push(G1);

  const byId = { G0, G1, G2, G3, G5 };

  // P2 subset: G0, G2, G5 only
  const p2Subset = [G0, G2, G5];

  return { enabledAll, p2Subset, byId };
}

/* ----------------------------- Frame Construction ---------------------------- */

function makeFrameForCase({ cols, rows, target, placement, bundle, caseNo, p5Partner }) {
  // Start as a visible “empty” frame. Use dots so crop/wrap is obvious.
  // If your renderer treats '.' specially, change to spaces. Dots help debug visually.
  const lines = new Array(rows).fill("").map(() => repeat(".", cols));

  // Place an unobtrusive case label where possible.
  // Avoid clobbering the boundary target itself:
  // - Prefer row 1 col 0, else row 0 col 1, else skip.
  placeCaseLabel(lines, cols, rows, target, placement, bundle.id, caseNo);

  // Emit content according to placement.
  switch (placement) {
    case "P0":
      applyP0(lines, cols, rows, target, pickToken(bundle, caseNo));
      break;

    case "P1":
      // Not used by default in the bounded suite builder, but kept available
      applyP1(lines, cols, rows, target, pickToken(bundle, caseNo) + pickToken(bundle, caseNo + 1));
      break;

    case "P2":
      applyP2(lines, cols, rows, target, bundle);
      break;

    case "P3":
      applyP3(lines, cols, rows, target, bundle);
      break;

    case "P4":
      applyP4(lines, cols, rows, target, bundle);
      break;

    case "P5_BASE":
      applyP5Base(lines, cols, rows, target, bundle, p5Partner, caseNo);
      break;

    case "P5_OVERWRITE":
      applyP5Overwrite(lines, cols, rows, target, bundle, p5Partner, caseNo);
      break;

    default:
      // No-op
      break;
  }

  return lines;
}

function placeCaseLabel(lines, cols, rows, target, placement, bundleId, caseNo) {
  const label = `[BM:${caseNo}:${bundleId}:${placement}:${target.tag}]`;

  // Candidate label positions (x,y)
  const candidates = [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ];

  for (const p of candidates) {
    if (p.y < 0 || p.y >= rows) continue;
    if (clobbersTarget(p.x, p.y, label.length, target)) continue;

    lines[p.y] = spliceIntoLine(lines[p.y], p.x, label);
    return;
  }
}

function clobbersTarget(x, y, len, target) {
  if (y !== target.y) return false;
  return target.x >= x && target.x < (x + len);
}

function pickToken(bundle, n) {
  const i = n % bundle.tokens.length;
  return bundle.tokens[i];
}

function applyP0(lines, cols, rows, target, token) {
  if (target.y < 0 || target.y >= rows) return;

  // Place token at exact x (line may grow beyond cols).
  lines[target.y] = spliceIntoLine(lines[target.y], target.x, token);
}

function applyP1(lines, cols, rows, target, token2) {
  if (target.y < 0 || target.y >= rows) return;
  lines[target.y] = spliceIntoLine(lines[target.y], target.x, token2);
}

function applyP2(lines, cols, rows, target, bundle) {
  // Force a cross-column wrap/crop situation regardless of the target.x:
  // Always start at (C-2, target.y) with a 4-token sequence.
  const y = clamp(target.y, 0, rows - 1);
  const x = cols - 2;

  const a = pickToken(bundle, 1);
  const b = pickToken(bundle, 2);
  const c = pickToken(bundle, 3);
  const d = pickToken(bundle, 4);

  const payload = `${a}${b}${c}${d}`;
  lines[y] = spliceIntoLine(lines[y], x, payload);
}

function applyP3(lines, cols, rows, target, bundle) {
  // Newline boundary content:
  // We emit "A\nB" anchored so that 'A' lands at target.x and the newline
  // splits the stream. Since our frame itself already uses '\n' to separate
  // rows, we inject '\n' inside a line to stress parser behavior.
  //
  // NOTE: This intentionally creates an internal newline within a row string.
  // If your playFrames implementation splits only on '\n', this will create
  // an extra visual line and shift subsequent content — which is precisely the test.
  const y = clamp(target.y, 0, rows - 1);
  const x = clamp(target.x, 0, cols - 1);

  const A = pickToken(bundle, 10);
  const B = pickToken(bundle, 11);

  const payload = `${A}\n${B}`;
  lines[y] = spliceIntoLine(lines[y], x, payload);
}

function applyP4(lines, cols, rows, target, bundle) {
  // Trailing whitespace: place "A  " so the spaces land at end-of-row and beyond.
  const y = clamp(target.y, 0, rows - 1);
  const x = Math.max(0, cols - 2); // ensure trailing behavior

  const A = pickToken(bundle, 20);
  const payload = `${A}  `;
  lines[y] = spliceIntoLine(lines[y], x, payload);
}

function applyP5Base(lines, cols, rows, target, sgrBundle, nonSgrBundle, caseNo) {
  // Base: write styled "AAAA" near target.
  const y = clamp(target.y, 0, rows - 1);
  const x = clamp(target.x, 0, cols - 1);

  // Use an SGR token that definitely contains styling around a visible glyph.
  // Ensure we have enough characters to overlap later.
  const styled = `\x1b[31mA\x1b[0m\x1b[31mA\x1b[0m\x1b[31mA\x1b[0m\x1b[31mA\x1b[0m`;
  lines[y] = spliceIntoLine(lines[y], x, styled);

  // Also place a non-SGR glyph adjacent as a “control” reference.
  const ref = pickToken(nonSgrBundle, caseNo);
  lines[y] = spliceIntoLine(lines[y], x + 6, ref);
}

function applyP5Overwrite(lines, cols, rows, target, sgrBundle, nonSgrBundle, caseNo) {
  // Overwrite: place "bb" overlapping the center of the prior "AAAA".
  const y = clamp(target.y, 0, rows - 1);
  const x = clamp(target.x, 0, cols - 1);

  const payload = `bb`;
  lines[y] = spliceIntoLine(lines[y], x + 1, payload);

  // Place a non-SGR marker to compare attribute bleed if your renderer shows it.
  const ref = pickToken(nonSgrBundle, caseNo + 1);
  lines[y] = spliceIntoLine(lines[y], x + 6, ref);
}

/* ----------------------------- String Utilities ------------------------------ */

function spliceIntoLine(line, x, insert) {
  if (x < 0) return line;

  // Allow line to grow. Pad with spaces if needed.
  if (line.length < x) {
    line = line + repeat(" ", x - line.length);
  }

  const left = line.slice(0, x);
  const right = line.slice(x + insert.length);
  return left + insert + right;
}

function repeat(ch, n) {
  if (n <= 0) return "";
  return ch.repeat(n);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function mustInt(v, name) {
  if (!Number.isInteger(v) || v <= 0) {
    throw new Error(`Expected ${name} to be a positive integer, got: ${v}`);
  }
  return v;
}
