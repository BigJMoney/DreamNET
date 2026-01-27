import { DEV, CONFIG, applyFontConfig } from "./config.js";
import {el, waitForFonts, waitNextFrame} from "./dom_utils.js";
import {TerminalEngine} from "./engine.js";
import {AnimationDriver} from "./animation.js";
import {loadBootScreenText, loadPerfTestScreens} from "./boot_assets.js";

/*
 *
 * DreamNET Webclient entry code. The Webclient is an "old-school" Terminal-based CLI.
 *
 */


console.log("[terminal] script loaded");

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





let engine = null;
let animDriver = null;


// ---- Boot screen loader ----




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
