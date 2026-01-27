import {CONFIG, DEV} from "./config.js";

/*

Content for booting the client. Temporary stub for MVP.

 */


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

export async function loadBootScreenText() {
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

export async function loadPerfTestScreens() {
  let testloop = [];
  if (DEV) {
    for (let i = 0; i <= 9; i++) {
      try {
        const text = await fetchText(`${CONFIG.devBootScreenUrlBase}0${i}.ans`);
        console.log("[dev] loaded test screen", i);
        testloop.push(text);
      } catch (err) {
        console.warn("[dev] failed to load test screen", err);
        return null;
      }
    }
    return testloop;
  }
  return null;
}
