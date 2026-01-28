import {flog} from "./log.js";
import {DEV} from "./config.js";

/*

Handles the logic of creating sequences of frame calls, containing text, to the engine/renderer. Will
 contain scripts to create more complex sequences in the future.

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

export class AnimationDriver {
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
    this.isPaused = false;

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
   * @param {Animation} anim - See typedef
   * @returns {boolean}  - Whether play started (false if already playing).
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
   * @param {string[]} frames - A list of animation frames
   * @param {AnimPlayOpts=} opts - See typedef
   * @returns {boolean} - Whether play started (false if already playing).
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

  /**
   * Request the active animation to go into a holding pattern
   *
   * @param reason
   * @returns {boolean}
   */
  togglePause(reason = "") {
    if (!this.playing) return false;

    this.isPaused = !this.isPaused;
    flog(`[anim] togglePause(): paused=${this.isPaused} reason="${reason}"`);

    if (!this.isPaused) {
      // Resume by requesting a hold boundary (same mechanism already used elsewhere).
      this.engine.requestFrame([{ name: "hold" }], "anim resume");
    }

    return this.isPaused;
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
   * calls:
   * - engine.requestFrame()
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

    if (this.isPaused) {
      log("[anim] _runStep(): paused -> skip scheduling/advance");
      log("[anim] _runStep(): returning (paused)");
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
    if (DEV) {flog(`[anim] complete frames=${frames} dt=${dt.toFixed(1)}ms fps=${fps.toFixed(1)}`)}

    this.engine.unsubFrameComplete(this._onFrameComplete);
  }
}
