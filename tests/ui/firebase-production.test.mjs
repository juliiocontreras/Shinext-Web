import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../../assets/js/firebase-client.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../../sw.js", import.meta.url), "utf8");

test("production Firebase config comes from Hosting reserved init JSON", () => {
  assert.match(client, /fetch\("\/__\/firebase\/init\.json"/);
  assert.match(client, /cache:\s*"no-store"/);
  assert.match(client, /window\.SHINEXT_FIREBASE_CONFIG/);
});

test("local Firebase development uses a demo project id", () => {
  assert.match(client, /projectId:\s*"demo-shinext-local"/);
  assert.doesNotMatch(client, /projectId:\s*"shinext-local"/);
});

test("service worker never intercepts Firebase reserved Hosting namespace", () => {
  assert.match(serviceWorker, /pathname\.startsWith\('\/__\/'\)/);
  assert.match(serviceWorker, /return;/);
});
