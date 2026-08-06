import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import type {
  AuditEvent,
  AuditEventInput,
  MembershipRecord,
  TenancyStore,
  WorkspaceAccess,
} from "./tenancy-types.js";
import type { KeyStore, MembershipRole, Organization, User } from "./types.js";

function mapUser(row: pg.QueryResultRow): User & { passwordHash: string | null } {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash ?? null,
    createdAt: row.created_at,
  };
}

function mapMembership(row: pg.QueryResultRow): MembershipRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role as MembershipRole,
    createdAt: row.created_at,
  };
}

export function createPgTenancyStore(pool: pg.Pool, keys: KeyStore): TenancyStore {
  return {
    async countUsers() {
      const res = await pool.query(`SELECT count(*)::int AS c FROM users`);
      return res.rows[0]?.c ?? 0;
    },

    async createUser(input) {
      const id = randomUUID();
      const res = await pool.query(
        `INSERT INTO users (id, email, name, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, input.email.toLowerCase(), input.name ?? null, input.passwordHash],
      );
      return mapUser(res.rows[0]);
    },

    async findUserByEmail(email) {
      const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [
        email.toLowerCase(),
      ]);
      if (!res.rows[0]) return null;
      return mapUser(res.rows[0]);
    },

    async findUserById(id) {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (!res.rows[0]) return null;
      const u = mapUser(res.rows[0]);
      return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
    },

    async addMembership(input) {
      const id = randomUUID();
      const res = await pool.query(
        `INSERT INTO memberships (id, organization_id, user_id, role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, input.organizationId, input.userId, input.role],
      );
      return mapMembership(res.rows[0]);
    },

    async getMembership(organizationId, userId) {
      const res = await pool.query(
        `SELECT * FROM memberships WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId],
      );
      if (!res.rows[0]) return null;
      return mapMembership(res.rows[0]);
    },

    async listMembershipsForUser(userId) {
      const res = await pool.query(
        `SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at ASC`,
        [userId],
      );
      return res.rows.map(mapMembership);
    },

    async listMembers(organizationId) {
      const res = await pool.query(
        `SELECT m.*, u.email, u.name
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = $1
         ORDER BY m.created_at ASC`,
        [organizationId],
      );
      return res.rows.map((row) => ({
        ...mapMembership(row),
        email: row.email as string,
        name: (row.name as string | null) ?? null,
      }));
    },

    async getWorkspaceAccess(userId, workspaceId): Promise<WorkspaceAccess | null> {
      const ws = await keys.getWorkspace(workspaceId);
      if (!ws?.organizationId) return null;
      const m = await this.getMembership(ws.organizationId, userId);
      if (!m) return null;
      return { workspace: ws, organizationId: ws.organizationId, role: m.role };
    },

    async createOrganization(input): Promise<Organization> {
      const id = randomUUID();
      const res = await pool.query(
        `INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) RETURNING *`,
        [id, input.name, input.slug],
      );
      return {
        id: res.rows[0].id,
        name: res.rows[0].name,
        slug: res.rows[0].slug,
        createdAt: res.rows[0].created_at,
      };
    },

    async createInvite(input) {
      const id = randomUUID();
      const token = randomBytes(24).toString("base64url");
      const res = await pool.query(
        `INSERT INTO invites (id, organization_id, email, role, token, invited_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, email) DO UPDATE
           SET role = EXCLUDED.role,
               token = EXCLUDED.token,
               invited_by_user_id = EXCLUDED.invited_by_user_id,
               accepted_at = NULL
         RETURNING *`,
        [
          id,
          input.organizationId,
          input.email.toLowerCase(),
          input.role,
          token,
          input.invitedByUserId,
        ],
      );
      const row = res.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        role: row.role,
        token: row.token,
        invitedByUserId: row.invited_by_user_id,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
      };
    },

    async findPendingInviteByEmail(email) {
      const res = await pool.query(
        `SELECT * FROM invites WHERE email = $1 AND accepted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [email.toLowerCase()],
      );
      if (!res.rows[0]) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
        role: row.role as MembershipRole,
        token: row.token,
        invitedByUserId: row.invited_by_user_id,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
      };
    },

    async acceptInvite(inviteId) {
      await pool.query(`UPDATE invites SET accepted_at = now() WHERE id = $1`, [inviteId]);
    },

    async insertAudit(event: AuditEventInput) {
      await pool.query(
        `INSERT INTO audit_events (
          id, organization_id, workspace_id, actor_user_id,
          action, resource_type, resource_id, meta
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          randomUUID(),
          event.organizationId ?? null,
          event.workspaceId ?? null,
          event.actorUserId ?? null,
          event.action,
          event.resourceType ?? null,
          event.resourceId ?? null,
          event.meta ? JSON.stringify(event.meta) : null,
        ],
      );
    },

    async listAudit(opts): Promise<AuditEvent[]> {
      const limit = opts?.limit ?? 50;
      if (opts?.workspaceId) {
        const res = await pool.query(
          `SELECT * FROM audit_events WHERE workspace_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [opts.workspaceId, limit],
        );
        return res.rows.map(mapAudit);
      }
      if (opts?.organizationId) {
        const res = await pool.query(
          `SELECT * FROM audit_events WHERE organization_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [opts.organizationId, limit],
        );
        return res.rows.map(mapAudit);
      }
      const res = await pool.query(
        `SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
      return res.rows.map(mapAudit);
    },
  };
}

function mapAudit(row: pg.QueryResultRow): AuditEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    meta: row.meta,
    createdAt: row.created_at,
  };
}

