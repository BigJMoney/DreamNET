import {DEV} from "./config.js";

/*

Webclient logging.

 */


export function flog(msg) {
  if (!DEV) return;
  console.log(msg);
}