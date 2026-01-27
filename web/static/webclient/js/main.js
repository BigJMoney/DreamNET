import { DEV, applyFontConfig } from "./config.js";
import {waitForFonts, waitNextFrame} from "./dom_utils.js";
import {TerminalEngine} from "./engine.js";
import {AnimationDriver} from "./animation.js";
import {loadBootScreenText, loadPerfTestScreens} from "./boot_assets.js";
import {initUi, recomputeScale} from "./ui.js";
import {clearFramebuffer} from "./renderer.js";

/*
 *
 * DreamNET Webclient entry code. The Webclient is an "old-school" Terminal-based CLI.
 *
 */


console.log("[terminal] script loaded");

let engine = null;
let animDriver = null;

function setupResizeHandling() {
  let timer = null;
  window.addEventListener("resize", () => {
    // Resize only recomputes scale; does not touch cols/rows.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      recomputeScale();
      // For some reason we used to call a single frame here
    }, 50);
  });
}


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

  console.log("[start] init UI begin");
  initUi();
  recomputeScale();
  console.log("[start] init UI end");

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
  engine.requestFrame(
    [{
      name: "drawRect",
      rText: bootText,
    }]
  )
  console.log("[start] stage boot paint end");

  setupResizeHandling();

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
