/*

Writers process text coming from the server to prepare it for frame submission to the engine or animation driver. Each
 writer has a unique target (or type of target) and write script.

 */


/**
 * Minimal ScrollbackWriter stub.
 *
 * Purpose:
 * - Exists only to satisfy references from output_coordinator and main.js
 * - Produces no real output yet
 * - Safe to replace later with full implementation
 */
export class ScrollbackWriter {
  constructor(opts = {}) {
    this.writerId = String(opts.writerId ?? "main");

    // Explicit rect (even if unused for now)
    this.rStart = opts.rStart ?? [0, 0];
    this.rSize  = opts.rSize  ?? [0, 0];

    // Terminal geometry (stored for later use)
    this.cols = opts.cols ?? 0;
    this.rows = opts.rows ?? 0;

    // Required future-proofing members
    this.dirty = false;
    this.pendingCommands = null;
  }

  /**
   * Accept output text.
   * For now: mark dirty and store nothing.
   */
  write(_chunk, _meta) {
    this.dirty = true;

    // No-op command placeholder (valid FrameCommandList shape)
    this.pendingCommands = [];
  }

  /**
   * Return pending commands and clear dirty flag.
   */
  consumePendingCommands() {
    const cmds = this.pendingCommands;
    this.pendingCommands = null;
    this.dirty = false;
    return cmds;
  }
}
