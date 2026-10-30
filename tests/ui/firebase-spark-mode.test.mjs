import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../../assets/js/firebase-client.js", import.meta.url), "utf8");
const application = await readFile(new URL("../../assets/js/worker-application.js", import.meta.url), "utf8");
const portal = await readFile(new URL("../../portal/portal.js", import.meta.url), "utf8");
const content = await readFile(new URL("../../crm/modules/content.js", import.meta.url), "utf8");

test("production defaults billing-backed Firebase capabilities off while emulators keep them on", () => {
  assert.match(client, /SHINEXT_FIREBASE_CAPABILITIES/);
  assert.match(client, /functions:\s*isLocal\s*\|\|/);
  assert.match(client, /storage:\s*isLocal\s*\|\|/);
});

test("worker application blocks document submission when Storage is unavailable", () => {
  assert.match(application, /firebaseCapabilities/);
  assert.match(application, /firebaseCapabilities\.storage/);
  assert.match(application, /modo gratuito|modo Spark/i);
});

test("portal callables fail closed when Functions are unavailable", () => {
  assert.match(portal, /firebaseCapabilities/);
  assert.match(portal, /firebaseCapabilities\.functions/);
  assert.match(portal, /modo gratuito|modo Spark/i);
});

test("CRM content writes fail closed when Functions are unavailable", () => {
  assert.match(content, /firebaseCapabilities/);
  assert.match(content, /firebaseCapabilities\.functions/);
  assert.match(content, /modo gratuito|modo Spark/i);
});
