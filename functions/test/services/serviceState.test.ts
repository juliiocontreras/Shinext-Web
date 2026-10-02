import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import {
  assertAssignableRequest,
  assertPendingOffer,
  normalizeOfferDecision,
} from "../../src/services/serviceState.js";

test("an unassigned offered request remains assignable", () => {
  assert.doesNotThrow(() =>
    assertAssignableRequest({ status: "offered", assignedWorkerUid: "" }),
  );
});

test("a second worker cannot accept after the request is already assigned", () => {
  assert.throws(
    () =>
      assertAssignableRequest({
        status: "assigned",
        assignedWorkerUid: "worker_first",
      }),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "already-exists",
  );
});

test("worker can only respond to their own pending offer", () => {
  assert.doesNotThrow(() =>
    assertPendingOffer(
      { status: "pending", workerUid: "worker_1" },
      "worker_1",
    ),
  );

  assert.throws(
    () =>
      assertPendingOffer(
        { status: "pending", workerUid: "worker_2" },
        "worker_1",
      ),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "permission-denied",
  );
});

test("only accept or reject are valid offer decisions", () => {
  assert.equal(normalizeOfferDecision("accept"), "accept");
  assert.equal(normalizeOfferDecision("reject"), "reject");
  assert.throws(() => normalizeOfferDecision("maybe"));
});
