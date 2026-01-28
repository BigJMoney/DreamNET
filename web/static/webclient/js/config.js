/*

General Webclient configuration.

 */


export const DEV = /[?&]dreamnetDev=1\b/.test(location.search);
export const TEST = /[?&]dreamnetTest=1\b/.test(location.search);

export const CONFIG = {
  termCols: 135,
  termRows: 49,
  termFont: {
    face: "ToshibaSat_8x16",
    size: "16px",
    lineheight: "16px",
    spacing: "0px",
  },
  bootScreenUrl: "/static/webclient/ui/virtual_mode05.ans",
  devBootScreenUrlBase: "/static/webclient/ui/sgr_blocks10_shift_with_page_135x49_shift",
  devFps: 20,
};

// keep this next line if you want the derived property:
CONFIG.termFont.family = `"${CONFIG.termFont.face}", monospace`;

export function applyFontConfig() {
  const root = document.documentElement;
  root.style.setProperty("--term-font-family", CONFIG.termFont.family);
  root.style.setProperty("--term-font-px", CONFIG.termFont.size);
  root.style.setProperty("--term-font-lineheight", CONFIG.termFont.lineheight);
  root.style.setProperty("--term-font-letterspacing", CONFIG.termFont.spacing);
}
