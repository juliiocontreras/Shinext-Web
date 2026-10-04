import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../../assets/js/firebase-client.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../../sw.js", import.meta.url), "utf8");
const appJs = await readFile(new URL("../../app.js", import.meta.url), "utf8");
const contentLoader = await readFile(new URL("../../assets/js/content-loader.js", import.meta.url), "utf8");

test("production Firebase config comes from Hosting reserved init JSON", () => {
  assert.match(client, /fetch\("\/__\/firebase\/init\.json"/);
  assert.match(client, /cache:\s*"no-store"/);
  assert.match(client, /window\.SHINEXT_FIREBASE_CONFIG/);
});

test("local Firebase development uses a demo project id", () => {
  assert.match(client, /projectId:\s*"demo-shinext-local"/);
  assert.doesNotMatch(client, /projectId:\s*"shinext-local"/);
});

test("service worker never intercepts Firebase reserved or private app routes", () => {
  assert.match(serviceWorker, /PRIVATE_PREFIXES\s*=\s*\['\/crm\/', '\/portal\/', '\/__\/'\]/);
  assert.match(serviceWorker, /PRIVATE_PREFIXES\.some/);
  assert.match(serviceWorker, /if \(!SHELL_PATHS\.has\(url\.pathname\)\) return/);
});

test("service worker caches only same-origin public shell resources", () => {
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /SHELL_PATHS = new Set\(SHELL\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put\(event\.request, copy\).*portal/s);
});

test("public managed content attempts Firebase on Hosting and keeps fallbacks on failure", () => {
  assert.match(appJs, /loadManagedBanners\(\)/);
  assert.doesNotMatch(appJs, /Boolean\(window\.SHINEXT_FIREBASE_CONFIG\)/);
  assert.match(contentLoader, /loadManagedArticleMedia\(\)\.catch/);
  assert.doesNotMatch(contentLoader, /canUseFirebase/);
});
