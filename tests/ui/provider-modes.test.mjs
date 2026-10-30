import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const applicationHtml=await readFile(new URL("../../trabaja/index.html",import.meta.url),"utf8");
const applicationJs=await readFile(new URL("../../assets/js/worker-application.js",import.meta.url),"utf8");
const portalHtml=await readFile(new URL("../../portal/index.html",import.meta.url),"utf8");
const portalJs=await readFile(new URL("../../portal/portal.js",import.meta.url),"utf8");
const purchasing=await readFile(new URL("../../crm/modules/purchasing.js",import.meta.url),"utf8");

test("worker onboarding exposes both operating modes",()=>{
  assert.match(applicationHtml,/value="independent"/);
  assert.match(applicationHtml,/value="shinext_partner"/);
  assert.match(applicationJs,/serviceMode/);
});

test("portal surfaces provider mode and service supply checklist",()=>{
  assert.match(portalHtml,/worker-mode-badge/);
  assert.match(portalHtml,/service-supply-checklist/);
  assert.match(portalJs,/supplyChecklists/);
});

test("purchasing module manages inventory and checklist templates",()=>{
  assert.match(purchasing,/inventory/);
  assert.match(purchasing,/supplyChecklists/);
  assert.match(purchasing,/addDoc|setDoc/);
  assert.match(purchasing,/deleteDoc/);
});
