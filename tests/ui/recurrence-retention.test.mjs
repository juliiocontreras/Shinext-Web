import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const trackingHtml=await readFile(new URL("../../seguimiento/index.html",import.meta.url),"utf8");
const trackingJs=await readFile(new URL("../../assets/js/request-tracking.js",import.meta.url),"utf8");
const dispatch=await readFile(new URL("../../cloudflare/shinext-dispatch.js",import.meta.url),"utf8");
const operations=await readFile(new URL("../../crm/modules/operations.js",import.meta.url),"utf8");

test("completed customers can repeat a service from private tracking",()=>{
  assert.match(trackingHtml,/repeat-service-form/);
  assert.match(trackingJs,/\/repeat/);
  assert.match(dispatch,/repeatService/);
});

test("repeat flow can request the same provider without forcing assignment",()=>{
  assert.match(trackingHtml,/preferSameProvider/);
  assert.match(dispatch,/preferred_provider_uid/);
  assert.match(dispatch,/preferredProvider/);
  assert.match(dispatch,/score\+=20/);
});

test("recurring plans can be paused and resumed from tracking",()=>{
  assert.match(trackingHtml,/recurrence-controls/);
  assert.match(trackingJs,/\/recurrence/);
  assert.match(dispatch,/updateRecurrence/);
  assert.match(dispatch,/recurrence_status/);
});

test("operations sees recurrence context",()=>{
  assert.match(operations,/frequency/);
  assert.match(operations,/recurrence_status/);
});
