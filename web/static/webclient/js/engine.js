import {CONFIG, DEV} from "./config.js";
import {writeAnsiSgrToRect} from "./ansi.js";
import {getFramebuffer, initRenderer, renderFramebuffer} from "./renderer.js";
import {flog} from "./log.js";

/*

Engine for the webclient that controls timing. Its main priority is currently just the renderer, but in the (near)
 future it will also handle user input.

 */


/**
 *
 * @typedef {(RectDrawCommand|HoldCommand)[]} FrameCommandList
 *  A list of frame command objects and their associated data
 *
 * @typedef {Object} RectDrawCommand
 *  Paints text into an arbitrarily sized rectangle in the framebuffer.
 * @property {"drawRect"} name
 * @property {[number, number]} rStart - Top-left corner of the rectangle in x, y coordinates.
 * @property {[number, number]} rSize - Width and height of the rectangle as w, h values.
 * @property {string} rText - Text content to write into the rectangle.
 *
 * @typedef {Object} HoldCommand
 *  Instructs the renderer to continue rendering the current framebuffer in the next frame (for animation)
 * @property {"hold"} name
 * @property {boolean=} repaint // ignored for now
 *
 * Append
 *  future release
 *
 */

export class TerminalEngine {

  constructor() {
    // Single-instance runtime: constructing the engine initializes the renderer exactly once.
    initRenderer();
    this._fb = getFramebuffer();

    this.cols = CONFIG.termCols | 0;
    this.rows = CONFIG.termRows | 0;

    this.dev = DEV;
    this.fps = DEV ? (CONFIG.devFps | 0) : 0;
    this.frameInterval = this.fps > 0 ? (1000 / this.fps) : 0;

    // Scheduler state
    this.isRunning = false;
    this.nextFrameDue = null;
    this.rafIsScheduled = false;
    this.timerId = null;

    // Pending frame requests (FIFO)
    this._queue = [];

    // Frame counter (monotonic per engine instance)
    this.frameNo = 0;
    // Will receive an event when a frame is complete
    this._frameCompleteListeners = [];

  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  subFrameComplete(callback) {
    this._frameCompleteListeners.push(callback)
  }

  unsubFrameComplete(callback) {
    const i = this._frameCompleteListeners.indexOf(callback);
    if (i !== -1) this._frameCompleteListeners.splice(i, 1);
  }

  _emitFrameComplete() {
    for (const callb of this._frameCompleteListeners) {
      try { callb(); } catch (e) { console.error("[engine] frameComplete listener threw", e); }
    }
  }

  // -------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------

  /**
   * A FrameRequest describes one engine frame worth of work.
   *
   * @param {FrameCommandList} commands - Ordered list of commands to execute in this frame.
   * @param {string} reason - Text that describes purpose of frame request
   * @returns {void}
   *
   */
  requestFrame(commands, reason="") {

    if (!Array.isArray(commands)) {
      throw new Error("[engine] requestFrame(commands) requires an array of commands");
    }

    if (DEV) { flog(`[frame] frame request because ${reason}`) }

    // FRAME-GUARANTEE VALIDATION
    let holdIsRequested = false;
    for (const cmd of commands) {
      if (cmd && cmd.name === "hold") {
        holdIsRequested = true;
        break;
      }
    }

    if (holdIsRequested && commands.length > 1) {
      throw new Error(
        "[engine] invalid FrameRequest: 'hold' is a frame-level guarantee and must be the only command"
      );
    }

    this._queue.push(commands);

    if (!this.isRunning) {
      this._resetScheduler();
      this.isRunning = true;
      this._scheduleNextTick();
    }
  }

  // Reason to stay alive
  hasPendingWork() {
    return this._queue.length > 0;
  }

  // -------------------------------------------------------------------------
  // Scheduler
  // -------------------------------------------------------------------------

  _resetScheduler() {
    this.nextFrameDue = null;
    this.rafIsScheduled = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  _scheduleNextTick() {
    if (!this.isRunning) return;

    if (!this.hasPendingWork()) {
      this.isRunning = false;
      this._resetScheduler();
      return;
    }

    // Uncapped fps path (fps = 0): schedule via rAF only while work exists
    if (this.fps <= 0) {
      if (this.rafIsScheduled) return;
      this.rafIsScheduled = true;

      requestAnimationFrame(() => {
        this.rafIsScheduled = false;
        this._tick();
      });
      return;
    }

    // Capped fps path: schedule via setTimeout
    if (this.timerId) return;

    const now = performance.now();
    if (this.nextFrameDue == null) this.nextFrameDue = now;

    // Catch up scenario (intentionally late -> wait phase-locked; review if behavior is undesirable)
    if (this.nextFrameDue < now) {
      const missed = Math.floor((now - this.nextFrameDue) / this.frameInterval) + 1;
      this.nextFrameDue += missed * this.frameInterval;
    }

    const delay = this.nextFrameDue - now;

    this.timerId = setTimeout(() => {
      this.timerId = null;
      this._tick();
    }, delay);
  }

  _tick() {
    if (!this.isRunning) return;

    const commands = this._queue.shift();
    if (!commands) {
      // Shouldn't happen because hasPendingWork() was true, but be defensive.
      console.warn("[frame] tick with empty queue; forcing idle");
      this._scheduleNextTick();
      return;
    }

    // Execute exactly one frame request per tick
    this._runOneFrame(commands);

    this.frameNo++;
    this._emitFrameComplete();

    // Advance cadence tracking for capped fps
    if (this.fps > 0) {
      this.nextFrameDue += this.frameInterval;
    }

    this._scheduleNextTick();
  }

  // -------------------------------------------------------------------------
  // Frame execution
  // -------------------------------------------------------------------------

  /**
   * Execute a single FrameRequest: apply all commands, then render once.
   * No framebuffer mutation should occur outside this function.
   */
  _runOneFrame(commands) {

    for (const cmd of commands) {
      if (!cmd || typeof cmd !== "object") {
        console.warn("[frame] invalid command (non-object)", cmd);
        continue;
      }

      if (cmd.name === "hold") {
        break;  // Footgun defense (shouldn't be needed but doesn't hurt)
      }

      if (cmd.name === "drawRect") {
        const x = (cmd.rStart?.[0] ?? 0);
        const y = (cmd.rStart?.[1] ?? 0);
        const w = (cmd.rSize?.[0] ?? this.cols);
        const h = (cmd.rSize?.[1] ?? this.rows);
        const text = String(cmd.rText ?? "<ENGINE ERROR: no rText for drawRect>");

        writeAnsiSgrToRect(this._fb, text, x, y, w, h);
        continue;
      }

      console.warn("[frame] unknown command!", cmd);
    }

    // Render exactly once per frame
    renderFramebuffer()
  }
}