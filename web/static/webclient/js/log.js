/*

Webclient logging.

 */

import {DEV} from "./config.js";

export function flog(msg) {
  if (!DEV) return;
  console.log(msg);
}