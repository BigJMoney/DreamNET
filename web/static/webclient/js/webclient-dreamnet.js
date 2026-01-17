/*
 *
 * DreamNET Webclient GUI component (framebuffer-first)
 *
 */

console.log("[terminal] script loaded");

const DEV = /[?&]dreamnetDev=1\b/.test(location.search);


// ---- Config (dev-time) ----
// Change these during development; treat as constants during play.

const CONFIG = {
  termCols: 135,
  termRows: 49,

  termFont: {
    face: "ToshibaSat_8x16",
    size: "16px",
    lineheight: "16px",
    spacing: "0px",
  },

  // Boot screen: set to the 135x49 plain snapshot.
  bootScreenUrl: "/static/webclient/ui/virtualmode.135x49.txt",
};

// Set dynamically so that font face has one source of truth
CONFIG.termFont.family = `"${CONFIG.termFont.face}", monospace`;


// ---- Style ----

function applyFontConfig() {
  const root = document.documentElement;
  root.style.setProperty("--term-font-family", CONFIG.termFont.family);
  root.style.setProperty("--term-font-px", CONFIG.termFont.size);
  root.style.setProperty("--term-font-lineheight", CONFIG.termFont.lineheight);
  root.style.setProperty("--term-font-letterspacing", CONFIG.termFont.spacing);
}


// ---- State ----

let framebufferLines = [];      // string[] length termRows, each length termCols
let cell = { w: 0, h: 0 };      // measured at k=1 from termSurface styles
let scaleK = 1;

let renderQueued = false;


// ---- Helpers ----

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`[terminal] missing #${id}`);
  return node;
}

function waitNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.load(CONFIG.termFont.size + " " + CONFIG.termFont.face);
    } catch {
      // best effort
    }
  }
}

function measureCellFrom(surfaceEl) {
  const measurer = document.createElement("span");
  measurer.setAttribute("aria-hidden", "true");
  measurer.style.position = "absolute";
  measurer.style.left = "-99999px";
  measurer.style.top = "0";
  measurer.style.whiteSpace = "pre";
  measurer.style.visibility = "hidden";
  measurer.style.pointerEvents = "none";

  surfaceEl.appendChild(measurer);

  const N = 200;
  measurer.textContent = "█".repeat(N);
  const rectW = measurer.getBoundingClientRect().width;
  const w = rectW / N;

  measurer.textContent = "█\n".repeat(40);
  const rectH = measurer.getBoundingClientRect().height;
  const h = rectH / 40;

  measurer.remove();
  return { w, h };
}


function normalizeToGrid(text, cols, rows) {
  // Normalize newlines, then enforce exact rows and cols.
  const s = String(text).replace(/\r\n?/g, "\n");

  // Split into lines; do NOT drop trailing empties (we want exact rows).
  const raw = s.split("\n");

  // If the export didn’t include trailing spaces, pad to cols.
  const lines = [];
  for (let i = 0; i < rows; i++) {
    const line = raw[i] ?? "";
    // Preserve leading content; pad/truncate to exact width.
    lines.push(line.padEnd(cols, " ").slice(0, cols));
  }
  return lines;
}

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
  const root = el("terminalRoot");

  // Native terminal pixel size at k=1.
  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  // Set layout size so scrollbars represent scaled content accurately.
  const scaledW = Math.ceil(termPxW * k);
  const scaledH = Math.ceil(termPxH * k);
  root.style.width = `${scaledW}px`;
  root.style.height = `${scaledH}px`;

  // Apply visual scale (integer only).
  root.style.transform = `scale(${k})`;
  // IMPORTANT: after scaling, the *layout size* above is already scaled, so we must
  // "undo" layout scaling by sizing at k and scaling root back to 1? No:
  // We’re using transform scale, so layout size stays unscaled. Setting width/height
  // to scaled values makes scrolling match. This is what we want.

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

function recomputeScale() {
  const viewport = el("viewport");

  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  const k = computeScale(viewport.clientWidth, viewport.clientHeight, termPxW, termPxH);
  if (k !== scaleK) {
    console.log("[scale] k", scaleK, "->", k);
  }
  applyScale(k);
}


// ---- Rendering ----

function renderFramebuffer() {
  const surface = el("termSurface");
  surface.textContent = framebufferLines.join("\n");
}

function requestRender(reason) {
  console.log("[render] request", reason);
  if (renderQueued) return;
  renderQueued = true;

  requestAnimationFrame(() => {
    console.log("[render] rAF paint begin (scheduled by)", reason);
    renderQueued = false;
    renderFramebuffer();
    console.log("[render] rAF paint end");
  });

  console.log("[render] scheduled rAF; end of call stack for", reason);
}


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


// ---- Wiring ----

function setupResizeHandling() {
  let timer = null;
  window.addEventListener("resize", () => {
    // Resize only recomputes scale; does not touch cols/rows.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      recomputeScale();
      requestRender("resize");
    }, 50);
  });
}


// ---- Startup ----

async function start() {
  console.log("[start] begin");

  console.log("[start] waitForFonts begin");
  await waitForFonts();
  console.log("[start] waitForFonts end");
  applyFontConfig();

  console.log("[start] settle frames begin");
  await waitNextFrame();
  await waitNextFrame();
  console.log("[start] settle frames end");

  console.log("[start] measure cell begin");
  cell = measureCellFrom(el("termSurface"));
  console.log("[start] measure cell end", cell);

  console.log("[start] load boot screen begin");
  const bootText = await loadBootScreenText();
  console.log("[start] load boot screen end");

  console.log("[start] normalize framebuffer begin");
  framebufferLines = normalizeToGrid(bootText, CONFIG.termCols, CONFIG.termRows);
  console.log("[start] normalize framebuffer end", {
    rows: framebufferLines.length,
    cols: framebufferLines[0]?.length ?? 0,
  });

  console.log("[start] initial scale+render begin");
  recomputeScale();
  requestRender("boot");
  console.log("[start] initial scale+render end");

  setupResizeHandling();

  console.log("[start] end");
}


/*function main() {
  const evennia = window["evennia"];
  if (evennia && evennia.on) {
    evennia.on("webclientReady", start);
  } else {
    void start();
  }
}*/

// ---- Entry Point ----
let started = false;

function startOnce(reason) {
  if (started) return;
  started = true;
  console.log("[startOnce] begin (reason)", reason);

  Promise.resolve()
    .then(() => start())
    .then(() => console.log("[startOnce] end"))
    .catch((err) => console.error("[startOnce] FAILED", err));
}

function main() {
  console.log("[main] begin");

  // Always attempt to start from DOM readiness; this is our primary.
  startOnce("main");

  // If Evennia exists, also hook its event — but do NOT rely on it.
  const evennia = window["evennia"];
  if (evennia && typeof evennia.on === "function") {
    console.log("[main] evennia detected; attaching webclientReady");
    evennia.on("webclientReady", () => startOnce("evennia:webclientReady"));

    // Critical: if webclientReady already fired before we attached,
    // this fallback still starts immediately.
    setTimeout(() => startOnce("evennia:fallbackTimeout0"), 0);
  } else {
    console.log("[main] evennia not detected (or no .on); continuing without it");
  }

  console.log("[main] end");
}

// Log async failures that might otherwise look like “nothing happened”
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});
window.addEventListener("error", (e) => {
  console.error("[window.error]", e.error || e.message);
});

// Entry point
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => main(), { once: true });
} else {
  main();
}
