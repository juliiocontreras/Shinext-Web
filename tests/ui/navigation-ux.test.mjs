import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home=await readFile(new URL("../../index.html",import.meta.url),"utf8");
const requestHtml=await readFile(new URL("../../solicitar/index.html",import.meta.url),"utf8");
const requestJs=await readFile(new URL("../../assets/js/service-request.js",import.meta.url),"utf8");
const workerHtml=await readFile(new URL("../../trabaja/index.html",import.meta.url),"utf8");
const workerJs=await readFile(new URL("../../assets/js/worker-application.js",import.meta.url),"utf8");
const portalHtml=await readFile(new URL("../../portal/index.html",import.meta.url),"utf8");
const portalJs=await readFile(new URL("../../portal/portal.js",import.meta.url),"utf8");

test("primary conversion links go directly to native flows",()=>{
  assert.doesNotMatch(home,/href="#solicitar"/);
  assert.doesNotMatch(home,/href="#trabaja"/);
  assert.match(home,/href="\/solicitar\//);
  assert.match(home,/href="\/trabaja\//);
});

test("service cards preserve service intent when opening request flow",()=>{
  for(const type of ["home","airbnb","office","commerce","industrial"]){
    assert.match(home,new RegExp(`\\/solicitar\\/\\?service=${type}`));
  }
  assert.match(requestJs,/URLSearchParams/);
  assert.match(requestJs,/searchParams\.get\("service"\)/);
});

test("request flow is chunked into three understandable steps and prevents past dates",()=>{
  assert.match(requestHtml,/1\. Servicio/);
  assert.match(requestHtml,/2\. Fecha y preferencias/);
  assert.match(requestHtml,/3\. Tus datos/);
  assert.match(requestJs,/requestedDate/);
  assert.match(requestJs,/min/);
});

test("worker signup explains deferred document verification when Storage is unavailable",()=>{
  assert.match(workerHtml,/id="documents-section"/);
  assert.match(workerJs,/documents-section/);
  assert.match(workerJs,/verificación documental/i);
});

test("provider navigation names availability explicitly and marks current tab",()=>{
  assert.match(portalHtml,/>Disponibilidad</);
  assert.match(portalJs,/aria-current/);
});

test("provider cannot accept a Cloudflare offer without a defined earning",()=>{
  assert.match(portalJs,/Pago por confirmar/);
  assert.match(portalJs,/canAccept/);
});

test("provider portal only shows empty state when there are no actionable offers",()=>{
  assert.match(portalHtml,/id="offers-empty"/);
  assert.match(portalJs,/offers-empty/);
});

test("independent providers do not see Partner-only supply request controls",()=>{
  assert.match(portalJs,/supply-grid/);
  assert.match(portalJs,/hidden = !partner/);
});
