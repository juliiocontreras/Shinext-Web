import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import { validateApplicationForApproval } from "../../src/recruitment/approveWorker.js";

test("approval requires identity and proof of address", () => {
  assert.throws(
    () =>
      validateApplicationForApproval({
        status: "in_review",
        fullName: "Persona Prueba",
        email: "persona@example.com",
        documentsPending: false,
        documents: { identity: { path: "id.pdf" } },
      }),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "failed-precondition",
  );
});

test("complete application is eligible for approval validation", () => {
  assert.doesNotThrow(() =>
    validateApplicationForApproval({
      status: "in_review",
      fullName: "Persona Prueba",
      email: "persona@example.com",
      documentsPending: false,
      documents: {
        identity: { path: "id.pdf" },
        address: { path: "address.pdf" },
      },
    }),
  );
});

test("rejected application must be reopened before approval", () => {
  assert.throws(() =>
    validateApplicationForApproval({
      status: "rejected",
      fullName: "Persona Prueba",
      email: "persona@example.com",
      documentsPending: false,
      documents: {
        identity: { path: "id.pdf" },
        address: { path: "address.pdf" },
      },
    }),
  );
});
