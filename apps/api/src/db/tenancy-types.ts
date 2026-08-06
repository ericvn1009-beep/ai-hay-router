import type { MembershipRole, Organization, User, Workspace } from "./types.js";

export interface MembershipRecord {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  createdAt: Date;
}

export interface InviteRecord {
  id: string;
  organizationId: string;
  email: string;
  role: MembershipRole;
  token: string;
  invitedByUserId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AuditEventInput {
  organizationId?: string | null;
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  createdAt: Date;
}

export interface WorkspaceAccess {
  workspace: Workspace;
  organizationId: string;
  role: MembershipRole;
}

export interface TenancyStore {
  countUsers(): Promise<number>;
  createUser(input: {
    email: string;
    name?: string | null;
    passwordHash: string;
  }): Promise<User>;
  findUserByEmail(email: string): Promise<(User & { passwordHash: string | null }) | null>;
  findUserById(id: string): Promise<User | null>;
  addMembership(input: {
    organizationId: string;
    userId: string;
    role: MembershipRole;
  }): Promise<MembershipRecord>;
  getMembership(organizationId: string, userId: string): Promise<MembershipRecord | null>;
  listMembershipsForUser(userId: string): Promise<MembershipRecord[]>;
  listMembers(organizationId: string): Promise<Array<MembershipRecord & { email: string; name: string | null }>>;
  getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null>;
  createOrganization(input: { name: string; slug: string }): Promise<Organization>;
  createInvite(input: {
    organizationId: string;
    email: string;
    role: MembershipRole;
    invitedByUserId: string | null;
  }): Promise<InviteRecord>;
  findPendingInviteByEmail(email: string): Promise<InviteRecord | null>;
  acceptInvite(inviteId: string): Promise<void>;
  insertAudit(event: AuditEventInput): Promise<void>;
  listAudit(opts?: { organizationId?: string; workspaceId?: string; limit?: number }): Promise<AuditEvent[]>;
}
