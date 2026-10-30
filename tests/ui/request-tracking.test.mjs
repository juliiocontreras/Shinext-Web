import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requestHtml=await readFile(new URL("../../solicitar/index.html",import.meta.url),"utf8");
const requestJs=await readFile(new URL("../../assets/js/service-request.js",import.meta.url),"utf8");
const trackingHtml=await readFile(new URL("../../seguimiento/index.html",import.meta.url),"utf8");
const trackingJs=await readFile(new URL("../../assets/js/request-tracking.js",import.meta.url),"utf8");
const portalJs=await readFile(new URL("../../portal/portal.js",import.meta.url),"utf8");

test("request confirmation exposes quote and secure tracking link",()=>{
  assert.match(requestHtml,/request-price/);
  assert.match(requestHtml,/request-tracking-link/);
  assert.match(requestJs,/trackingToken/);
  assert.match(requestJs,/clientPrice/);
});

test("tracking page queries by opaque token rather than phone or lead id",()=>{
  assert.match(trackingJs,/URLSearchParams/);
  assert.match(trackingJs,/token/);
  assert.doesNotMatch(trackingJs,/clientPhone/);
  assert.match(trackingHtml,/Estado de tu servicio/);
});

test("provider offers show defined earning from dispatcher",()=>{
  assert.match(portalJs,/worker_earning/);
  assert.match(portalJs,/client_price/);
});
