import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const portalHtml = await readFile(new URL("../../portal/index.html", import.meta.url), "utf8");
const loginHtml = await readFile(new URL("../../portal/login.html", import.meta.url), "utf8");
const portalJs = await readFile(new URL("../../portal/portal.js", import.meta.url), "utf8");

test("worker portal exposes the five approved primary sections", () => {
  for (const view of ["home", "services", "calendar", "earnings", "supplies"]) {
    assert.match(portalHtml, new RegExp(`data-nav-view=["']${view}["']`));
  }
});

test("worker portal keeps the official Shinext brand asset", () => {
  assert.match(portalHtml, /\/brand\/shinext-logo-original\.webp/);
  assert.match(loginHtml, /\/brand\/shinext-logo-original\.webp/);
});

test("portal guard requires worker role and active profile", () => {
  assert.match(portalJs, /token\.claims\.role !== "worker"/);
  assert.match(portalJs, /worker\.active !== true/);
  assert.match(portalJs, /window\.location\.replace\("\/portal\/login\.html"\)/);
});

test("login uses email and password authentication", () => {
  assert.match(loginHtml, /type="email"/);
  assert.match(loginHtml, /type="password"/);
  assert.match(portalJs, /signInWithEmailAndPassword/);
});

test("portal connects worker offers to callable accept/reject flow", () => {
  assert.match(portalJs, /httpsCallable\(functions, "respondToOffer"\)/);
  assert.match(portalJs, /where\("workerUid", "==", user\.uid\)/);
  assert.match(portalJs, /data-offer-action="accept"/);
  assert.match(portalJs, /data-offer-action="reject"/);
});

test("portal never renders client price or Shinext margin in offer cards", () => {
  assert.doesNotMatch(portalJs, /clientPrice|shinextMargin|marginShinext/);
});
