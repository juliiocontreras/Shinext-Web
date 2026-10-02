import assert from "node:assert/strict";
import test from "node:test";

import { HttpsError } from "firebase-functions/v2/https";

import { normalizeServiceNoteText } from "../../src/services/addServiceNote.js";
import { normalizeIncidentDescription } from "../../src/services/reportIncident.js";

test("service note validation keeps useful short context", () => {
  assert.equal(
    normalizeServiceNoteText("  Cliente pidió atención en cocina.  "),
    "Cliente pidió atención en cocina.",
  );
});

test("service note rejects empty or excessively long text", () => {
  assert.throws(
    () => normalizeServiceNoteText(" "),
    (error: unknown) =>
      error instanceof HttpsError && error.code === "invalid-argument",
  );
  assert.throws(() => normalizeServiceNoteText("x".repeat(1501)));
});

test("incident requires meaningful context", () => {
  assert.equal(
    normalizeIncidentDescription("No hay acceso al área de oficinas."),
    "No hay acceso al área de oficinas.",
  );
  assert.throws(() => normalizeIncidentDescription("no"));
});
