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

    this._bufferLines = [];
    this.maxLines = opts.maxLines ?? 2000;  // Arbitrary; can be increased if perf allows
  }

  /**
   * Minimal ingest for Step 2:
   * - normalize CRLF/CR to LF
   * - split into lines
   * - append to _lines
   * - repaint whole buffer as rText joined by '\n'
   */
  makeFrameCmds(text, _meta = {}) {
    //todo: reconsider
    // Normalize newlines (keep it deterministic and boring for now)
    const norm = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // todo: why not set _lines directly?
    // Split into lines and append
    const parts = norm.split("\n");

    // If the text ended with \n, split() will include a trailing "" line.
    // That's OK; it represents the cursor sitting at a new blank line.
    for (const line of parts) {
      this._bufferLines.push(line);
    }

    // Buffer cap (drop oldest)
    if (this.maxLines > 0 && this._bufferLines.length > this.maxLines) {
      this._bufferLines.splice(0, this._bufferLines.length - this.maxLines);
    }

    const viewportRows = this.rSize?.[1] ?? this.rows;
    if (viewportRows <= 0) {
      console.error("[writer] An invalid rectangle was passed to ScrollbackWriter");
      return;
    }
    const start = Math.max(0, this._bufferLines.length - viewportRows);
    let visibleLines = this._bufferLines.slice(start);

    // Pad the terminal when output is smaller than screen size
    const blankLines = viewportRows - visibleLines.length;
    if (blankLines > 0) {
      const pad = new Array(blankLines).fill("");
      visibleLines = pad.concat(visibleLines);
    }
    const visibleText = visibleLines.join("\n");

    this.dirty = true;
    this.pendingCommands = [
        this.buildClearRect(),
        this.buildDrawRect(visibleText)];
  }

  // May be handy for debugging/tests
  clearWinAndBuffer() {
    this._bufferLines.length = 0;
    this.dirty = true;
    this.pendingCommands = [this.buildClearRect()];
  }
}
