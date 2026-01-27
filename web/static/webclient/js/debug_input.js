// debug_input.js
import { flog } from "./log.js";

/**
 * Debug-only keyboard capture.
 * Requires dreamnetDev to be true.
 *
 * Spacebar handler is injected by caller (so we can rewire it later).
 */


export function initDebugInput({ onSpace }) {

  flog("[debug_input] initDebugInput(): attaching keydown listener");

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;

    // Prevent page scroll / button activation
    e.preventDefault();
    e.stopPropagation();

    flog("[debug_input] keydown Space: dispatch onSpace()");
    try {
      onSpace?.(e);
    } finally {
      // Your preference: log the end of the original call stack
      flog("[debug_input] keydown Space: onSpace() returned");
    }
  }, { capture: true });
}

export function debugClearAndRenderOneFrame(engine, cols, rows) {
  // Fill full grid with spaces. (SGR reset handling should already be in drawRect path.)
  const blankLine = " ".repeat(cols);
  const text = Array.from({ length: rows }, () => blankLine).join("\n");

  engine.requestFrame([{
    name: "drawRect",
    rText: text,
  }], "debug: spacebar clear framebuffer");
}

