import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const trackingHtml=await readFile(new URL("../../seguimiento/index.html",import.meta.url),"utf8");
const trackingJs=await readFile(new URL("../../assets/js/request-tracking.js",import.meta.url),"utf8");
const dispatch=await readFile(new URL("../../cloudflare/shinext-dispatch.js",import.meta.url),"utf8");

test("recurring tracking shows next suggested service date",()=>{
  assert.match(trackingHtml,/next-service-card/);
  assert.match(trackingJs,/next_suggested_date/);
  assert.match(dispatch,/nextSuggestedDate/);
});

test("client must explicitly confirm the next recurring service before lead creation",()=>{
  assert.match(trackingJs,/confirm-next/);
  assert.match(dispatch,/confirmNextRecurring/);
  assert.match(dispatch,/persistLead/);
});

test("client can skip the next recurring occurrence without cancelling the plan",()=>{
  assert.match(trackingJs,/skip-next/);
  assert.match(dispatch,/skipNextRecurring/);
  assert.match(dispatch,/next_suggested_date/);
});

test("recurrence suggestion respects weekly biweekly and monthly frequencies",()=>{
  assert.match(dispatch,/weekly/);
  assert.match(dispatch,/biweekly/);
  assert.match(dispatch,/monthly/);
  assert.match(dispatch,/addMonths/);
});
