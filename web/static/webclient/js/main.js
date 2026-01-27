/*
 *
 * DreamNET Webclient component entry code.
 *
 */

import { DEV, CONFIG, applyFontConfig } from "./config.js";
import {el, waitForFonts, waitNextFrame} from "./dom_utils.js";
import {TerminalEngine} from "./engine.js";
import {flog} from "./log.js";

console.log("[terminal] script loaded");


// ---- State ----

let cell = { w: 0, h: 0 };       // measured at k=1 from termSurface styles
let scaleK = 0;                   //todo: move to ui module


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
  const root = el("terminalRoot");     // layout box (scroll size)
  const surface = el("termSurface");   // visual surface (scaled)

  // Native terminal pixel size at k=1.
  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  // Layout size reflects scaled content for accurate scrollbars/clipping.
  const scaledW = termPxW * k;
  const scaledH = termPxH * k;
  root.style.width = `${scaledW}px`;
  root.style.height = `${scaledH}px`;

  // The surface stays at native size; apply integer scaling visually.
  surface.style.width = `${termPxW}px`;
  surface.style.height = `${termPxH}px`;
  surface.style.transform = `scale(${k})`;

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

// todo: move
function recomputeScale() {
  const viewport = el("viewport");

  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  const k = computeScale(viewport.clientWidth, viewport.clientHeight, termPxW, termPxH);
  if (k !== scaleK) {
    console.log("[scale] k", scaleK, "->", k);
    applyScale(k);
  }
}


// ---- Rendering ----






/**
 * A simple text animation defined as a list of frames. Each element in the array is one animation frame.
 *
 * @typedef {Array<string>} AnimFrameList
 */

/**
 * An object that produces one engine frame worth of commands at a time.
 *
 * @typedef {Object} Animation
 * @property {number} framesPerStep - engine frames per animation frame (>= 1)
 * @property {number} loop - full-animation repeats (>= 1)
 * @property {FrameCommandList[]} frameCmds - one FrameCommandList per animation frame (2 dim list)
 */

/**
 * Options shared by `play*` invocations.
 *
 * - `framesPerStep` controls pacing: the driver requests `hold` frames until the
 *   threshold is met, then requests the next script frame. Default = 1.
 * - `rStart` / `rSize` are used by `playFrames()` to define where text frames are
 *   drawn. Default is fullscreen.
 *
 * @typedef {Object} AnimPlayOpts
 * @property {number=} framesPerStep
 * @property {number=} loop
 * @property {[number, number]=} rStart
 * @property {[number, number]=} rSize
 */

class AnimationDriver {
  /**
   * Drives playback of animation scripts using TerminalEngine.
   *
   * Engine-paced: submits exactly one next frame request in response to each engine "frame complete"
   * boundary.
   *
   * Observable outputs:
   * - Submits `engine.requestFrame(...)` calls ("anim start", "anim hold", "anim step").
   * - Subscribes/unsubscribes to the engine's frame complete event.
   *
   * @param {TerminalEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.playing = false;
    this.anim = null; // The anim object

    this.frameIndex = 0;
    this.loopsRemaining = 1;

    this.framesPerStep = 1; // integer >= 1
    this.accum = 0;
    this.stopRequested = false;

    // Perf tracking
    this._perfStart = 0;
    this._perfFrames = 0;

    // Bind once (stable identity for subscribe/unsubscribe)
    this._onFrameComplete = this._onFrameComplete.bind(this);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Start playing a frame script (commands per frame).
   *
   * @param {Animation} anim
   * @returns {boolean} Whether play started (false if already playing).
   * @throws {Error} If `script` does not provide `nextFrame()`.
   */
  play(anim) {
    if (this.playing) {
      console.warn("[anim] play rejected: already playing");
      return false;
    }
    if (!anim || typeof anim !== "object") {
      throw new Error("[anim] play requires an animation object");
    }
    if (!Array.isArray(anim.frameCmds)) {
      throw new Error("[anim] invalid animation: frames must be an array");
    }

    // normalize + latch
    this.anim = anim;

    this.framesPerStep = Math.max(1, (anim.framesPerStep | 0) || 1);
    this.accum = 0;

    this.loopsRemaining = Math.max(1, (anim.loop | 0) || 1);
    this.frameIndex = 0;

    this.stopRequested = false;
    this.playing = true;

    this.engine.subFrameComplete(this._onFrameComplete);

    // kick perf
    this._perfStart = performance.now();
    this._perfFrames = 0;

    // kick anim
    this.engine.requestFrame([{ name: "hold"}], "anim start");
    return true;
  }

  /**
   * Start playing an array of text frames.
   *
   * @param {AnimFrameList} frames
   * @param {AnimPlayOpts=} opts
   * @returns {boolean} Whether play started (false if already playing).
   * @throws {Error} If `frames` is not an array.
   */
playFrames(frames, opts = {}) {
  if (this.playing) {
    console.warn("[anim] playFrames rejected: already playing");
    return false;
  }
  if (!Array.isArray(frames)) {
    throw new Error("[anim] playFrames requires an array of strings");
  }

  const framesPerStep = Math.max(1, (opts.framesPerStep | 0) || 1);
  const loop = Math.max(1, (opts.loop | 0) || 1);

  const rStart = opts.rStart ?? [0, 0];
  const rSize = opts.rSize ?? [this.engine.cols, this.engine.rows];

  const frameCmds = frames.map((t) => ([{
    name: "drawRect",
    rStart,
    rSize,
    rText: String(t),
  }]));

  const anim = { framesPerStep, loop, frameCmds };

  return this.play(anim);
}

  /**
   * Request the active animation to stop (takes effect on next frame boundary).
   *
   * @returns {void}
   */
  requestStop() {
    if (!this.playing) return;
    this.stopRequested = true;
  }

  // -------------------------------------------------------------------------
  // Engine boundary
  // -------------------------------------------------------------------------

  /**
   * Engine frame-complete handler (post-frame boundary).
   *
   * This method is the sole orchestration boundary for playback progression.
   * It decides whether to stop, hold, or step, and requests exactly one next engine frame accordingly.
   *
   * State transitions:
   * - accum increments and resets to 0 on step.
   * - playing may transition to false via _finish().
   *
   * calls:
   * - engine.requestFrame()
   * - script.nextFrame()
   * - this._finish()
   *
   * @returns {void}
   * @private
   */
  _onFrameComplete() {
    if (!this.playing) return;

    // Tracking frames for perf
    this._perfFrames++

    if (this.stopRequested) {
      this._finish();
      return;
    }

    // pacing via holds
    this.accum++;
    if (this.accum < this.framesPerStep) {
      this.engine.requestFrame([{ name: "hold" }], "anim hold");
      return;
    }
    this.accum = 0;

    const frames = this.anim.frameCmds;

    // finished one pass?
    if (this.frameIndex >= frames.length) {
      this.loopsRemaining--;

      if (this.loopsRemaining > 0) {
        this.frameIndex = 0;
        this.engine.requestFrame([{ name: "hold" }], "anim loop");
        return;
      }

      this._finish();
      return;
    }

    // submit next animation frame
    const nextCommands = frames[this.frameIndex++];
    this.engine.requestFrame(nextCommands, "anim step");
  }

  /**
   * Determine whether this boundary should request a `hold` frame to satisfy pacing.
   *
   * Encapsulates the `framesPerStep` pacing policy and maintains the pacing accumulator.
   *
   * @returns {boolean}
   * @private
   */
  _shouldHoldThisBoundary() {
    this.accum++;
    if (this.accum < this.framesPerStep) return true;
    this.accum = 0;
    return false;
  }

  // -------------------------------------------------------------------------
  // Submission helpers
  // -------------------------------------------------------------------------

  /**
   * Request a frame-level `hold` (no framebuffer mutation) from the engine.
   *
   * @param {string} reason
   * @returns {void}
   * @private
   */
  _requestHold(reason) {
    this.engine.requestFrame([{ name: "hold" }], reason);
  }

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------

  /**
   * Finish playback and restore idle driver state.
   *
   * Ends the active playback session, clears state, and unsubscribes from the engine.
   *
   * @returns {void}
   * @private
   */
  _finish() {
    this.playing = false;
    this.anim = null;
    this.frameIndex = 0;
    this.loopsRemaining = 1;

    this.stopRequested = false;
    this.accum = 0;

    // Perf reporting
    const dt = performance.now() - this._perfStart;
    const frames = this._perfFrames;
    const fps = frames > 0 ? (frames * 1000) / dt : 0;
    flog(
      `[anim] complete frames=${frames} dt=${dt.toFixed(1)}ms fps=${fps.toFixed(1)}`
    );

    this.engine.unsubFrameComplete(this._onFrameComplete);
  }
}


let engine = null;
let animDriver = null;


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


// ---- Dev ----

async function loadPerfTestScreens() {
  let testloop = [];
  if (DEV) {
    for (let i = 0; i <= 9; i++) {
      try {
        const text = await fetchText(`${CONFIG.devBootScreenUrlBase}0${i}.ans`);
        console.log("[dev] loaded test screen", i);
        testloop.push(text);
      } catch (err) {
        console.warn("[dev] failed to load test screen", err);
        return null;
      }
    }
    return testloop;
  }
  return null;
}


// ---- Wiring ----

// todo: turn back on after refactor
/*function setupResizeHandling() {
  let timer = null;
  window.addEventListener("resize", () => {
    // Resize only recomputes scale; does not touch cols/rows.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      term.stageJob("scale", "resize", null);
    }, 50);
  });
}*/


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
  //cell = measureCellFrom(el("termSurface"));
  console.log("[start] measure cell end", cell);

  console.log("[start] init engine begin");
  engine = new TerminalEngine();
  console.log("[start] init engine end");

  console.log("[start] init AnimDriver begin");
  animDriver = new AnimationDriver(engine);
  console.log("[start] init AnimDriver end");

  console.log("[start] load boot screen begin");
  const bootText = await loadBootScreenText();
  console.log("[start] load boot screen end");


  console.log("[start] stage boot paint begin");
  // todo: turn back on after refactor
  /*term.stageJob("scale", "boot scale", null);*/
  engine.requestFrame(
    [{
      name: "drawRect",
      rStart: [0,0],
      rSize: [135,49],
      rText: bootText,
    }]
  )
  console.log("[start] stage boot paint end");

  // todo: turn back on after refactor
  //setupResizeHandling();

  console.log("[start] end");

  if (DEV) {
    console.log("[dev] load perf test screens begin");
    const testloop = await loadPerfTestScreens();
    console.log("[dev] load perf test screens end");
    if (testloop) {
      animDriver.playFrames(testloop, {
        loop: 20,
      });
    }
  }
}


// ---- Entry Point ----

let hasStarted = false;

function main() {
  if (hasStarted) {
    console.warn("[terminal] Subsequent startups attempted");
    return;
  }
  hasStarted = true;

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
