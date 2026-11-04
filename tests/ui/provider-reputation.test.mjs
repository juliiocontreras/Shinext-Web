import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const trackingHtml=await readFile(new URL("../../seguimiento/index.html",import.meta.url),"utf8");
const trackingJs=await readFile(new URL("../../assets/js/request-tracking.js",import.meta.url),"utf8");
const dispatch=await readFile(new URL("../../cloudflare/shinext-dispatch.js",import.meta.url),"utf8");
const provider=await readFile(new URL("../../cloudflare/shinext-provider.js",import.meta.url),"utf8");
const portal=await readFile(new URL("../../portal/portal.js",import.meta.url),"utf8");

test("tracking reveals assigned provider trust summary without exposing private data",()=>{
  assert.match(trackingHtml,/tracking-provider/);
  assert.match(trackingJs,/provider_name/);
  assert.match(trackingJs,/provider_rating/);
  assert.doesNotMatch(trackingJs,/assigned_worker_uid/);
});

test("completed customer can submit exactly one rating through private tracking token",()=>{
  assert.match(trackingHtml,/rating-form/);
  assert.match(trackingJs,/\/rating/);
  assert.match(dispatch,/submitRating/);
  assert.match(dispatch,/service_ratings/);
});

test("rating updates provider aggregate used by matching",()=>{
  assert.match(dispatch,/AVG\(rating\)/);
  assert.match(dispatch,/UPDATE providers SET rating/);
});

test("provider portal receives aggregate reputation",()=>{
  assert.match(provider,/rating/);
  assert.match(provider,/completed_services/);
  assert.match(portal,/provider-rating/);
});
