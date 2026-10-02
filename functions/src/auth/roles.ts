export const SHINEXT_ROLES = [
  "director",
  "recruitment",
  "operations",
  "accounting",
  "purchasing",
  "sales",
  "worker",
] as const;

export type UserRole = (typeof SHINEXT_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && SHINEXT_ROLES.includes(value as UserRole);
}
