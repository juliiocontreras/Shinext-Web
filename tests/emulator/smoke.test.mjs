import assert from "node:assert/strict";
import test from "node:test";

const projectId = process.env.GCLOUD_PROJECT || "shinext-local";
const host = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;

test("Firestore emulator is reachable", async () => {
  const response = await fetch(`${base}/__smoke__/probe`);
  assert.notEqual(response.status, 0);
  assert.ok(
    [200, 404].includes(response.status),
    `expected emulator response, got HTTP ${response.status}`,
  );
});

test("unauthenticated protected write is denied", async () => {
  const response = await fetch(`${base}/protected/smoke?updateMask.fieldPaths=createdAt`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        createdAt: { stringValue: new Date(0).toISOString() },
      },
    }),
  });

  assert.equal(
    response.status,
    403,
    `expected Firestore rules to deny write with 403, got ${response.status}: ${await response.text()}`,
  );
});
