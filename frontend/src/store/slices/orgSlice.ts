import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { AuditEntry, MemberMeta, Permission, Role, Tag, Team } from '@/lib/domain/types';
import { defaultRoles } from '@/lib/domain/defaults';

/**
 * Enterprise/org state — roles, permissions, member metadata, tags, and an audit
 * log. All CLIENT-ONLY: the backend has no authorization model (any valid token
 * can do anything), so roles/permissions here gate the UI only and are clearly
 * labeled as such. Member metadata augments the real `GET /users` roster with
 * client-side role + capacity used by the Workload view.
 */
export interface OrgState {
  roles: Role[];
  members: Record<number, MemberMeta>;
  tags: Tag[];
  audit: AuditEntry[];
  teams: Team[];
}

const initialState: OrgState = {
  roles: defaultRoles(),
  members: {},
  tags: [
    { id: 'tag-bug', label: 'bug', hue: 0 },
    { id: 'tag-feature', label: 'feature', hue: 142 },
    { id: 'tag-design', label: 'design', hue: 291 },
    { id: 'tag-urgent', label: 'urgent', hue: 28 },
  ],
  audit: [],
  teams: [],
};

const MAX_AUDIT = 300;

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    addRole: {
      reducer(state, action: PayloadAction<Role>) {
        state.roles.push(action.payload);
      },
      prepare(input: { name: string; color: string; permissions: Permission[] }) {
        return {
          payload: {
            id: `role-${nanoid(6)}`,
            name: input.name.trim(),
            color: input.color,
            permissions: input.permissions,
          } satisfies Role,
        };
      },
    },
    updateRole(state, action: PayloadAction<{ id: string; changes: Partial<Role> }>) {
      const r = state.roles.find((x) => x.id === action.payload.id);
      if (r && !r.system) Object.assign(r, action.payload.changes);
      else if (r && action.payload.changes.permissions) r.permissions = action.payload.changes.permissions;
    },
    removeRole(state, action: PayloadAction<string>) {
      state.roles = state.roles.filter((r) => r.id !== action.payload || r.system);
    },
    setMemberMeta(state, action: PayloadAction<MemberMeta>) {
      state.members[action.payload.userId] = action.payload;
    },
    /** Ensure every real user has default member metadata (Member role, 40h/week). */
    ensureMembers(state, action: PayloadAction<{ userIds: number[]; defaultRoleId: string }>) {
      for (const id of action.payload.userIds) {
        if (!state.members[id]) {
          state.members[id] = {
            userId: id,
            roleId: action.payload.defaultRoleId,
            capacityHours: 40,
            status: 'active',
          };
        }
      }
    },
    addTag: {
      reducer(state, action: PayloadAction<Tag>) {
        state.tags.push(action.payload);
      },
      prepare(input: { label: string; hue: number }) {
        return { payload: { id: `tag-${nanoid(6)}`, label: input.label.trim(), hue: input.hue } satisfies Tag };
      },
    },
    /** Admin: remove a member's metadata (client-only "delete user"). */
    removeMember(state, action: PayloadAction<number>) {
      delete state.members[action.payload];
    },
    addTeam: {
      reducer(state, action: PayloadAction<Team>) {
        state.teams.push(action.payload);
      },
      prepare(input: { name: string; color: string; memberIds?: number[] }) {
        return {
          payload: {
            id: `team-${nanoid(6)}`,
            name: input.name.trim() || 'Team',
            color: input.color,
            memberIds: input.memberIds ?? [],
          } satisfies Team,
        };
      },
    },
    updateTeam(state, action: PayloadAction<{ id: string; changes: Partial<Team> }>) {
      const t = state.teams.find((x) => x.id === action.payload.id);
      if (t) Object.assign(t, action.payload.changes);
    },
    removeTeam(state, action: PayloadAction<string>) {
      state.teams = state.teams.filter((t) => t.id !== action.payload);
    },
    toggleTeamMember(state, action: PayloadAction<{ teamId: string; userId: number }>) {
      const t = state.teams.find((x) => x.id === action.payload.teamId);
      if (!t) return;
      t.memberIds = t.memberIds.includes(action.payload.userId)
        ? t.memberIds.filter((id) => id !== action.payload.userId)
        : [...t.memberIds, action.payload.userId];
    },
    logAudit: {
      reducer(state, action: PayloadAction<AuditEntry>) {
        state.audit.unshift(action.payload);
        if (state.audit.length > MAX_AUDIT) state.audit.length = MAX_AUDIT;
      },
      prepare(input: { actorId: number; action: string; target: string; at: string }) {
        return {
          payload: {
            id: `au-${nanoid(8)}`,
            actorId: input.actorId,
            action: input.action,
            target: input.target,
            at: input.at,
          } satisfies AuditEntry,
        };
      },
    },
  },
});

export const {
  addRole,
  updateRole,
  removeRole,
  setMemberMeta,
  ensureMembers,
  removeMember,
  addTeam,
  updateTeam,
  removeTeam,
  toggleTeamMember,
  addTag,
  logAudit,
} = orgSlice.actions;
export default orgSlice.reducer;
