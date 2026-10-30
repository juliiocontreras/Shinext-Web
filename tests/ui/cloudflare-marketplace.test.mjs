import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requestJs=await readFile(new URL("../../assets/js/service-request.js",import.meta.url),"utf8");
const portalJs=await readFile(new URL("../../portal/portal.js",import.meta.url),"utf8");
const portalHtml=await readFile(new URL("../../portal/index.html",import.meta.url),"utf8");
const operations=await readFile(new URL("../../crm/modules/operations.js",import.meta.url),"utf8");
const home=await readFile(new URL("../../index.html",import.meta.url),"utf8");

test("public customer flow uses the Cloudflare dispatcher",()=>{
  assert.match(requestJs,/shinext-dispatch\.juliiocontreras\.workers\.dev/);
  assert.match(requestJs,/\/leads/);
});

test("provider portal syncs profile, availability and offers through authenticated provider API",()=>{
  assert.match(portalJs,/shinext-provider\.juliiocontreras\.workers\.dev/);
  assert.match(portalJs,/\/profile/);
  assert.match(portalJs,/\/availability/);
  assert.match(portalJs,/\/offers/);
  assert.match(portalHtml,/id="availability-form"/);
});

test("operations CRM reads marketplace leads from authenticated admin API",()=>{
  assert.match(operations,/shinext-admin\.juliiocontreras\.workers\.dev/);
  assert.match(operations,/Authorization/);
  assert.match(operations,/\/leads/);
});

test("public CTAs route customers and providers into native platform flows",()=>{
  assert.match(home,/href="\/solicitar\//);
  assert.match(home,/href="\/trabaja\//);
});
