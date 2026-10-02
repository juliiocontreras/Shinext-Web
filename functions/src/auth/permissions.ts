import type { UserRole } from "./roles.js";

export const SHINEXT_PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "view_audit",
  "review_applications",
  "approve_applications",
  "view_workers",
  "manage_services",
  "view_financial_summary",
  "manage_payments",
  "manage_supplies",
  "manage_inventory",
  "manage_sales",
  "manage_content",
] as const;

export type Permission = (typeof SHINEXT_PERMISSIONS)[number];

export interface PermissionOverrides {
  grants?: readonly Permission[];
  revokes?: readonly Permission[];
}

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  director: new Set(SHINEXT_PERMISSIONS),
  recruitment: new Set([
    "review_applications",
    "approve_applications",
    "view_workers",
  ]),
  operations: new Set([
    "view_workers",
    "manage_services",
  ]),
  accounting: new Set([
    "view_financial_summary",
    "manage_payments",
  ]),
  purchasing: new Set([
    "manage_supplies",
    "manage_inventory",
  ]),
  sales: new Set([
    "manage_sales",
  ]),
  worker: new Set(),
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
  overrides: PermissionOverrides = {},
): boolean {
  if (overrides.revokes?.includes(permission)) {
    return false;
  }

  if (role === "director") {
    return true;
  }

  return Boolean(
    overrides.grants?.includes(permission) ||
      ROLE_PERMISSIONS[role].has(permission),
  );
}

export function listEffectivePermissions(
  role: UserRole,
  overrides: PermissionOverrides = {},
): Permission[] {
  return SHINEXT_PERMISSIONS.filter((permission) =>
    hasPermission(role, permission, overrides),
  );
}
