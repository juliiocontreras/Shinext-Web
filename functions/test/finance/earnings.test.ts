import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import {
  assertClosableService,
  normalizePaymentStatus,
  normalizeWorkerEarning,
} from "../../src/finance/earnings.js";

test("completed assigned service produces normalized earning data", () => {
  assert.deepEqual(
    assertClosableService({
      status: "completed",
      assignedWorkerUid: "worker-1",
      workerEarning: 450.126,
    }),
    {
      workerUid: "worker-1",
      workerEarning: 450.13,
    },
  );
});

test("service cannot close financially before completion", () => {
  assert.throws(
    () =>
      assertClosableService({
        status: "started",
        assignedWorkerUid: "worker-1",
        workerEarning: 450,
      }),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "failed-precondition",
  );
});

test("worker earning amount rejects invalid values", () => {
  assert.equal(normalizeWorkerEarning(0), 0);
  assert.equal(normalizeWorkerEarning("500"), 500);
  assert.throws(() => normalizeWorkerEarning(-1));
  assert.throws(() => normalizeWorkerEarning("not-a-number"));
});

test("payment status is constrained to pending or paid", () => {
  assert.equal(normalizePaymentStatus("pending"), "pending");
  assert.equal(normalizePaymentStatus("paid"), "paid");
  assert.throws(() => normalizePaymentStatus("cancelled"));
});
