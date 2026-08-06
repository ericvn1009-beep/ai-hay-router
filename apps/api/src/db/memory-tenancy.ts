import { randomBytes, randomUUID } from "node:crypto";
import type {
  AuditEvent,
  AuditEventInput,
  InviteRecord,
  MembershipRecord,
  TenancyStore,
  WorkspaceAccess,
} from "./tenancy-types.js";
import type { KeyStore, Organization, User } from "./types.js";

export function createMemoryTenancyStore(keys: KeyStore): TenancyStore {
  const users = new Map<string, User & { passwordHash: string | null }>();
  const memberships: MembershipRecord[] = [];
  const orgs = new Map<string, Organization>();
  const invites: InviteRecord[] = [];
  const audits: AuditEvent[] = [];

  return {
    async countUsers() {
      return users.size;
    },

    async createUser(input) {
      const email = input.email.toLowerCase();
      if ([...users.values()].some((u) => u.email === email)) {
        throw new Error("email_taken");
      }
      const user: User & { passwordHash: string | null } = {
        id: randomUUID(),
        email,
        name: input.name ?? null,
        passwordHash: input.passwordHash,
        createdAt: new Date(),
      };
      users.set(user.id, user);
      return user;
    },

    async findUserByEmail(email) {
      const e = email.toLowerCase();
      return [...users.values()].find((u) => u.email === e) ?? null;
    },

    async findUserById(id) {
      const u = users.get(id);
      if (!u) return null;
      const { passwordHash: _, ...rest } = u;
      return rest;
    },

    async addMembership(input) {
      const m: MembershipRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        createdAt: new Date(),
      };
      memberships.push(m);
      return m;
    },

    async getMembership(organizationId, userId) {
      return (
        memberships.find(
          (m) => m.organizationId === organizationId && m.userId === userId,
        ) ?? null
      );
    },

    async listMembershipsForUser(userId) {
      return memberships.filter((m) => m.userId === userId);
    },

    async listMembers(organizationId) {
      return memberships
        .filter((m) => m.organizationId === organizationId)
        .map((m) => {
          const u = users.get(m.userId);
          return {
            ...m,
            email: u?.email ?? "",
            name: u?.name ?? null,
          };
        });
    },

    async getWorkspaceAccess(userId, workspaceId): Promise<WorkspaceAccess | null> {
      const ws = await keys.getWorkspace(workspaceId);
      if (!ws?.organizationId) return null;
      const m = await this.getMembership(ws.organizationId, userId);
      if (!m) return null;
      return {
        workspace: ws,
        organizationId: ws.organizationId,
        role: m.role,
      };
    },

    async createOrganization(input) {
      const org: Organization = {
        id: randomUUID(),
        name: input.name,
        slug: input.slug,
        createdAt: new Date(),
      };
      orgs.set(org.id, org);
      return org;
    },

    async createInvite(input) {
      const inv: InviteRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        token: randomBytes(24).toString("base64url"),
        invitedByUserId: input.invitedByUserId,
        acceptedAt: null,
        createdAt: new Date(),
      };
      invites.push(inv);
      return inv;
    },

    async findPendingInviteByEmail(email) {
      const e = email.toLowerCase();
      return (
        invites.find((i) => i.email === e && !i.acceptedAt) ?? null
      );
    },

    async acceptInvite(inviteId) {
      const i = invites.findIndex((x) => x.id === inviteId);
      if (i >= 0) invites[i] = { ...invites[i], acceptedAt: new Date() };
    },

    async insertAudit(event: AuditEventInput) {
      audits.push({
        id: randomUUID(),
        createdAt: new Date(),
        ...event,
      });
    },

    async listAudit(opts) {
      return audits
        .filter((a) => {
          if (opts?.organizationId && a.organizationId !== opts.organizationId) return false;
          if (opts?.workspaceId && a.workspaceId !== opts.workspaceId) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, opts?.limit ?? 50);
    },
  };
}
