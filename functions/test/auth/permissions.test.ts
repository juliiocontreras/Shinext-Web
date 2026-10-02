import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPermission,
  listEffectivePermissions,
} from "../../src/auth/permissions.js";

test("director receives every defined permission", () => {
  const permissions = listEffectivePermissions("director");
  assert.ok(permissions.includes("manage_roles"));
  assert.ok(permissions.includes("view_financial_summary"));
  assert.ok(permissions.includes("approve_applications"));
});

test("recruitment can approve candidates but cannot manage roles or margin", () => {
  assert.equal(hasPermission("recruitment", "approve_applications"), true);
  assert.equal(hasPermission("recruitment", "view_workers"), true);
  assert.equal(hasPermission("recruitment", "manage_roles"), false);
  assert.equal(hasPermission("recruitment", "view_financial_summary"), false);
});

test("worker has no CRM permissions by default", () => {
  assert.deepEqual(listEffectivePermissions("worker"), []);
});

test("explicit grants add narrow access and revokes win", () => {
  assert.equal(
    hasPermission("operations", "manage_supplies", {
      grants: ["manage_supplies"],
    }),
    true,
  );

  assert.equal(
    hasPermission("recruitment", "approve_applications", {
      revokes: ["approve_applications"],
    }),
    false,
  );
});
