import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const trackingHtml=await readFile(new URL("../../seguimiento/index.html",import.meta.url),"utf8");
const trackingJs=await readFile(new URL("../../assets/js/request-tracking.js",import.meta.url),"utf8");
const dispatch=await readFile(new URL("../../cloudflare/shinext-dispatch.js",import.meta.url),"utf8");
const reminders=await readFile(new URL("../../cloudflare/shinext-reminders.js",import.meta.url),"utf8");
const operations=await readFile(new URL("../../crm/modules/operations.js",import.meta.url),"utf8");

test("assigned customer can confirm upcoming service from tracking",()=>{
  assert.match(trackingHtml,/service-confirmation-card/);
  assert.match(trackingJs,/confirm-service/);
  assert.match(dispatch,/confirmUpcomingService/);
  assert.match(dispatch,/client_confirmation_status/);
});

test("customer can flag reschedule need instead of silently cancelling",()=>{
  assert.match(trackingJs,/needs-reschedule/);
  assert.match(dispatch,/needs_reschedule/);
});

test("reminder worker queues 48h and 3h reminders idempotently",()=>{
  assert.match(reminders,/48h/);
  assert.match(reminders,/3h/);
  assert.match(reminders,/INSERT OR IGNORE INTO service_reminders/);
  assert.match(reminders,/scheduled\(/);
});

test("operations sees confirmation and reminder state",()=>{
  assert.match(operations,/client_confirmation_status/);
  assert.match(operations,/Recordatorios/);
  assert.match(operations,/needs_reschedule/);
});
