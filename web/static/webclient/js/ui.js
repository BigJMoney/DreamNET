import {CONFIG} from "./config.js";
import {el} from "./dom_utils.js";

/*

UI-only (DOM/CSS), independent of engine scheduling/render logic.

 */


let cell = { w: 0, h: 0 };       // measured at k=1 from termSurface styles
let scaleK = 0;

// ---- Public API

export function initUi() {
    cell = measureCellFrom(el("termSurface"));
}

// ---- Scaling ----

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

export function recomputeScale() {
  const viewport = el("viewport");

  const termPxW = CONFIG.termCols * cell.w;
  const termPxH = CONFIG.termRows * cell.h;

  const k = computeScale(viewport.clientWidth, viewport.clientHeight, termPxW, termPxH);
  if (k !== scaleK) {
    console.log("[scale] k", scaleK, "->", k);
    applyScale(k);
  }
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
