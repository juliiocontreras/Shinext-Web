import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(
  new URL("../../scripts/production-hosting-smoke.mjs", import.meta.url),
  "utf8",
);

test("hosting-only smoke check validates public and private shells", () => {
  for (const path of ["/", "/blog/", "/portal/", "/crm/"]) {
    assert.match(script, new RegExp(`expectHtml\\(\"\\${path.replaceAll("/", "\\/")}\"`));
  }
});

test("hosting-only smoke check validates Firebase Hosting config without requiring Functions", () => {
  assert.match(script, /\/__\/firebase\/init\.json/);
  assert.match(script, /projectId\.startsWith\("demo-"\)/);
  assert.doesNotMatch(script, /\/api\/healthz/);
});
