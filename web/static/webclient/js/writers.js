import { appendAnsiToRows, createAnsiRowLayoutState, penToSgr } from "./ansi.js";

/*

Writers process raw text coming from server messages and make engine Framecommands out of it, according to each writer's
 role.

 */


/**
 * Base class for screen writers.
 */
class BaseWriter {
  constructor(opts = {}) {
    this.writerId = opts.writerId ?? "main";

    // Explicit rect config (required future-proofing)
    this.rStart = opts.rStart ?? [0, 0];
    this.rSize  = opts.rSize  ?? [0, 0];

    // Terminal geometry (may be used by subclasses later)
    this.cols = opts.cols ?? 0;
    this.rows = opts.rows ?? 0;

    // Dirty/pending contract
    this.dirty = false;
    this.pendingCommands = null;
  }

  buildClearRect() {
    return {
      name: "clearRect",
      rStart: this.rStart,
      rSize: this.rSize,
    }
  }

  buildDrawRect(rText) {
    return {
      name: "drawRect",
      rStart: this.rStart,
      rSize: this.rSize,
      rText: rText,
    };
  }

  deliverFrameCmds() {
    const cmds = this.pendingCommands;
    this.pendingCommands = null;
    this.dirty = false;
    return cmds;
  }
}

/**
 * Stores incoming text in a scrollback buffer. Slices from the bottom of the buffer to display to the desginated
 * window.
 *
 */
export class ScrollbackWriter extends BaseWriter {
  constructor(opts = {}) {
    super(opts);

    // Canonical buffer is now PHYSICAL rows (post-wrap)
    this._rows = [];
    this._rowInitPen = [];

    this.maxRows = opts.maxRows ?? 2000;

    // Streaming layout state (pen + x + open row)
    this._layoutState = createAnsiRowLayoutState();
  }

  /**
   * Processes text output from the game in a way that allows it to be stored in a scrollback buffer. Then captures a
   * slice just the right size for one output window's worth of text, and converts it into Framecommands for the
   * renderer to display at the right location.
   *
   */
  makeFrameCmds(text, _meta = {}) {
    text = text ?? "";

    // Width/height from rect
    const rectW = this.rSize?.[0] ?? this.cols;
    const rectH = this.rSize?.[1] ?? this.rows;

    if ((rectW | 0) <= 0 || (rectH | 0) <= 0) {
      console.error("[writer] invalid rectangle passed to ScrollbackWriter", { rectW, rectH, rSize: this.rSize });
      return;
    }

    // Append into physical row buffer (streaming, preserves ANSI codes)
    appendAnsiToRows(this._layoutState, String(text), rectW, this._rows, this._rowInitPen);

    // Cap buffers (drop oldest physical rows)
    if (this.maxRows > 0 && this._rows.length > this.maxRows) {
      const drop = this._rows.length - this.maxRows;
      this._rows.splice(0, drop);
      this._rowInitPen.splice(0, drop);
    }

    // Slice bottom rectH physical rows
    const start = Math.max(0, this._rows.length - rectH);
    let visibleRows = this._rows.slice(start);

    // Top pad with empty rows if buffer is shorter than viewport
    const blankRows = rectH - visibleRows.length;
    if (blankRows > 0) {
      visibleRows = new Array(blankRows).fill("").concat(visibleRows);
    }

    // Single prefix marker (only when needed)
    const initPen = this._rowInitPen[start] ?? null;
    const prefix = initPen ? penToSgr(initPen) : "";

    const visibleText = prefix + visibleRows.join("\n");

    this.dirty = true;
    this.pendingCommands = [
      this.buildClearRect(),
      this.buildDrawRect(visibleText),
    ];
  }

  clearWinAndBuffer() {
    this._rows.length = 0;
    this._rowInitPen.length = 0;
    this._layoutState = createAnsiRowLayoutState();

    this.dirty = true;
    this.pendingCommands = [this.buildClearRect()];
  }
}
