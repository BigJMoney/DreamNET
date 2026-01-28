import {flog} from "./log.js"; // adjust path if needed
import {DEV} from "./config.js";

/*

Receives server output from the plugin and directs it to the appropriate writer.

 */

/**
 * Writer interface expected:
 * - writerId: string
 * - write(chunk: string, meta?: object): void
 * - consumePendingCommands(): (Array<object>|null)  // FrameCommandList or null
 */

/**
 * Create an output coordinator that is the ONLY module allowed to call engine.requestFrame(...).
 *
 * @param {object} opts
 * @param {TerminalEngine} opts.engine
 * @param {object} opts.writer - single-writer A1; later can extend to multiple writers/composer
 * @returns {{ ingest(chunk: string, reason?: string): void }}
 */
export function createOutputCoordinator({ engine, writer }) {
  if (!engine) throw new Error("[output_coordinator] missing engine");
  if (!writer) throw new Error("[output_coordinator] missing writer");

  const writerId = String(writer.writerId ?? "main");

  function ingest(chunk, reason = "") {
    const text = String(chunk ?? "");

    // --- async-branch logging (start) ---
    if (DEV) {
      flog(`[io] ingest begin reason="${reason}" writer="${writerId}" len=${text.length}`);
    }

    try {
      writer.write(text, { reason });

      const cmds = writer.consumePendingCommands();
      if (cmds && cmds.length) {
        engine.requestFrame(cmds, `io:${writerId}:${reason}`);
      } else {
        if (DEV) {
          flog(`[io] no commands produced writer="${writerId}" reason="${reason}"`);
        }
      }
    } finally {
      // --- async-branch logging (end of originating call stack) ---
      if (DEV) {
        flog(`[io] ingest end reason="${reason}" writer="${writerId}"`);
      }
    }
  }

  return { ingest };
}
