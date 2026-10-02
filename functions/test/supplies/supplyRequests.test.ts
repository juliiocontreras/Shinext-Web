import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import {
  normalizeSupplyCategory,
  normalizeSupplyQuantity,
  normalizeSupplyText,
} from "../../src/supplies/createSupplyRequest.js";
import {
  assertSupplyTransition,
} from "../../src/supplies/updateSupplyRequest.js";

test("supply request validates category item and quantity", () => {
  assert.equal(normalizeSupplyCategory("cleaning_products"), "cleaning_products");
  assert.equal(normalizeSupplyQuantity(2), 2);
  assert.equal(normalizeSupplyText("Desengrasante", "item"), "Desengrasante");
  assert.equal(normalizeSupplyText("Queda poco producto.", "note"), "Queda poco producto.");
});

test("supply request rejects invalid input", () => {
  assert.throws(() => normalizeSupplyCategory("other"));
  assert.throws(() => normalizeSupplyQuantity(0));
  assert.throws(() => normalizeSupplyText("", "item"));
});

test("purchasing workflow only advances through approved sequence", () => {
  assert.equal(assertSupplyTransition("reported", "reviewed"), "reviewed");
  assert.equal(
    assertSupplyTransition("reviewed", "preparing_purchasing"),
    "preparing_purchasing",
  );
  assert.equal(
    assertSupplyTransition("preparing_purchasing", "ready_for_delivery"),
    "ready_for_delivery",
  );
  assert.equal(
    assertSupplyTransition("ready_for_delivery", "delivered"),
    "delivered",
  );

  assert.throws(
    () => assertSupplyTransition("reported", "delivered"),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "failed-precondition",
  );
});
