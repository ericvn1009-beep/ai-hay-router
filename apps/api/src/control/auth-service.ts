import { randomUUID } from "node:crypto";
import type { TenancyStore } from "../db/tenancy-types.js";
import type { KeyStore, MembershipRole, User } from "../db/types.js";
import { openaiError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

export async function registerUser(
  tenancy: TenancyStore,
  keys: KeyStore,
  input: { email: string; password: string; name?: string },
): Promise<{ user: User; organizationId: string; workspaceId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || input.password.length < 8) {
    throw openaiError(400, "Invalid email or password (min 8 chars)", "invalid_request_error");
  }
  if (await tenancy.findUserByEmail(email)) {
    throw openaiError(400, "Email already registered", "email_taken");
  }

  const passwordHash = await hashPassword(input.password);
  const countBefore = await tenancy.countUsers();
  const created = await tenancy.createUser({
    email,
    name: input.name ?? null,
    passwordHash,
  });
  const publicUser: User = {
    id: created.id,
    email: created.email,
    name: created.name,
    createdAt: created.createdAt,
  };

  const pending = await tenancy.findPendingInviteByEmail(email);
  if (pending) {
    await tenancy.addMembership({
      organizationId: pending.organizationId,
      userId: publicUser.id,
      role: pending.role as MembershipRole,
    });
    await tenancy.acceptInvite(pending.id);
    const workspaces = await keys.listWorkspaces(pending.organizationId);
    const workspaceId =
      workspaces[0]?.id ??
      (
        await keys.createWorkspace({
          name: "default",
          organizationId: pending.organizationId,
          slug: "default",
        })
      ).id;
    await tenancy.insertAudit({
      organizationId: pending.organizationId,
      actorUserId: publicUser.id,
      action: "user.registered_via_invite",
      resourceType: "user",
      resourceId: publicUser.id,
    });
    return {
      user: publicUser,
      organizationId: pending.organizationId,
      workspaceId,
    };
  }

  if (countBefore === 0) {
    const boot = await keys.ensureTenancyBootstrap();
    await tenancy.addMembership({
      organizationId: boot.organizationId,
      userId: publicUser.id,
      role: "owner",
    });
    await tenancy.insertAudit({
      organizationId: boot.organizationId,
      actorUserId: publicUser.id,
      action: "user.registered_bootstrap_owner",
      resourceType: "user",
      resourceId: publicUser.id,
    });
    return {
      user: publicUser,
      organizationId: boot.organizationId,
      workspaceId: boot.workspaceId,
    };
  }

  const org = await tenancy.createOrganization({
    name: `${input.name ?? email.split("@")[0]} org`,
    slug: `org-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
  });
  const ws = await keys.createWorkspace({
    name: "default",
    organizationId: org.id,
    slug: "default",
  });
  await tenancy.addMembership({
    organizationId: org.id,
    userId: publicUser.id,
    role: "owner",
  });
  await tenancy.insertAudit({
    organizationId: org.id,
    actorUserId: publicUser.id,
    action: "user.registered_new_org",
    resourceType: "user",
    resourceId: publicUser.id,
  });
  return {
    user: publicUser,
    organizationId: org.id,
    workspaceId: ws.id,
  };
}

export async function loginUser(
  tenancy: TenancyStore,
  input: { email: string; password: string },
): Promise<User> {
  const row = await tenancy.findUserByEmail(input.email.trim().toLowerCase());
  if (!row?.passwordHash) {
    throw openaiError(401, "Invalid email or password", "invalid_credentials");
  }
  const ok = await verifyPassword(input.password, row.passwordHash);
  if (!ok) {
    throw openaiError(401, "Invalid email or password", "invalid_credentials");
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
  };
}
