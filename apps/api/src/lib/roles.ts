import type { MembershipRole } from "../db/types.js";

export function roleAtLeast(role: MembershipRole, min: MembershipRole): boolean {
  const order: MembershipRole[] = ["viewer", "member", "admin", "owner"];
  return order.indexOf(role) >= order.indexOf(min);
}

export function canManageKeys(role: MembershipRole): boolean {
  return roleAtLeast(role, "member");
}

export function canAdminWorkspace(role: MembershipRole): boolean {
  return roleAtLeast(role, "admin");
}

export function canInvite(role: MembershipRole): boolean {
  return roleAtLeast(role, "admin");
}
