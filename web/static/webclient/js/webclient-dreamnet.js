/*
 *
 * DreamNET Webclient GUI component
 *
 */

console.log("[terminal] script loaded");

// ---- State ----

const scrollback = [];
let termGrid = null;


// ---- Helpers -----

{
  function waitNextFrame() {
    const executor = (resolve) => requestAnimationFrame(resolve);
    return new Promise(executor);
  }

  async function waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // best effort
      }
    }
  }

  function measureCellFrom(element) {
    // Create a hidden measurement element that inherits font metrics
    const measurer = document.createElement("div");
    measurer.setAttribute("aria-hidden", "true");
    measurer.style.position = "absolute";
    measurer.style.left = "-99999px";
    measurer.style.top = "0";
    measurer.style.whiteSpace = "pre";
    measurer.style.visibility = "hidden";
    measurer.style.pointerEvents = "none";

    // Inherit font from the terminal area
    const cs = getComputedStyle(element);

    // ---- LOGGING ----
    console.log("[measureCellFrom] computed", {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
    });

    measurer.style.fontFamily = cs.fontFamily;
    measurer.style.fontSize = cs.fontSize;
    measurer.style.fontWeight = cs.fontWeight;
    measurer.style.fontStyle = cs.fontStyle;
    measurer.style.letterSpacing = cs.letterSpacing;
    measurer.style.lineHeight = cs.lineHeight;

    document.body.appendChild(measurer);

    // Width: average of many glyphs for precision
    const N = 100;
    measurer.textContent = "█".repeat(N);
    const rectW = measurer.getBoundingClientRect().width;

    const ls = parseFloat(cs.letterSpacing) || 0; // "normal" -> NaN -> 0

    // width = N*glyph + (N-1)*ls
    // advancePerChar = glyph + ls = (width + ls) / N
    const w = rectW / N;

    // Height: average of many lines for precision
    measurer.textContent = "█\n█\n█\n█\n█\n█\n█\n█\n█\n█";
    const h = measurer.getBoundingClientRect().height / 10;

    measurer.remove();

    return { charWidth: w, charHeight: h };
  }

  function computeTerminalGrid(viewport, textElForMetrics) {
    const { charWidth, charHeight } = measureCellFrom(textElForMetrics);

    // clientWidth/Height = usable interior space
    const viewportWidth  = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    const cols = Math.max(1, Math.floor(viewportWidth  / charWidth));
    const rows = Math.max(1, Math.floor(viewportHeight / charHeight));

    // ---- LOGGING ----
    console.log("[terminal metrics]");
    console.log("  char size:", {
      width:  +charWidth.toFixed(4),
      height: +charHeight.toFixed(4),
    });
    console.log("  viewport size:", {
      width:  viewportWidth,
      height: viewportHeight,
    });
    console.log("  grid:", {
      cols,
      rows,
    });

    return {
      cols,
      rows,
      charWidth,
      charHeight,
      viewportWidth,
      viewportHeight,
    };
  }


  // ---- Rendering ----

  function renderSlice() {
    if (!termGrid) return;

    const { cols, rows } = termGrid;
    // slice scrollback → DOM

  }


  // ---- Wiring -----

  function publishTerminalReport(viewport, grid) {
    // Debug / inspection
    window.__dreamnetTerm = grid;

    // Optional: data attributes for overlay debugging
    viewport.dataset.cols = String(grid.cols);
    viewport.dataset.rows = String(grid.rows);

    // Global snap metrics
    document.documentElement.style.setProperty("--cell-w", `${grid.charWidth}px`);
    document.documentElement.style.setProperty("--cell-h", `${grid.charHeight}px`);

    // Notify renderer(s)
    window.dispatchEvent(new CustomEvent("dreamnet:termreport", { detail: grid }));
  }

  function initTerminalMetrics() {
    const viewport = document.getElementById("messagewindow");
    if (!viewport) return;

    const textEl = document.getElementById("messagewindowText") || viewport;

    const grid = computeTerminalGrid(viewport, textEl);
    publishTerminalReport(viewport, grid);
  }

  function setupResizeHandling() {
    let timer = null;
    window.addEventListener("resize", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(initTerminalMetrics, 80);
    });
  }

  // Event Hooks
  window.addEventListener("dreamnet:termreport", (ev) => {
    console.log("term resize:", ev.detail.cols, ev.detail.rows);
  });

  window.addEventListener("dreamnet:termreport", (ev) => {
    termGrid = ev.detail;
    renderSlice();
  });


  // ---- Startup Orchestration -----

  async function start() {
    await waitForFonts();
    // Let layout settle (Grid + scrollbars + font swap)
    await waitNextFrame();
    await waitNextFrame();

    initTerminalMetrics();
    setupResizeHandling();
  }

  function main() {
    const evennia = window["evennia"];

    if (evennia && evennia.on) {
      evennia.on("webclientReady", start);
    } else {
      void start();
    }
  }


  // ---- Entry Point -----

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
}
