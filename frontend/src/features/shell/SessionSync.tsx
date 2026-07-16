'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAppDispatch, useAppStore } from '@/store/hooks';
import { useGetProjectsQuery, useGetUsersQuery } from '@/store/api/backendApi';
import { setSessionUser } from '@/store/slices/sessionSlice';
import { reconcileLists, DEFAULT_SPACE_ID } from '@/store/slices/hierarchySlice';
import { ensureMembers, setMemberMeta } from '@/store/slices/orgSlice';

/**
 * The seam between the real backend and the client-persisted domain. It:
 *  1. mirrors the authenticated user into the store (for presence, authorship);
 *  2. folds the authoritative project list into the client hierarchy as Lists;
 *  3. seeds member metadata for every real user (default role + capacity).
 * Renders nothing.
 */
export function SessionSync() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { user } = useAuth();
  const { data: projects } = useGetProjectsQuery();
  const { data: users } = useGetUsersQuery();

  useEffect(() => {
    dispatch(setSessionUser(user));
  }, [dispatch, user]);

  // Every workspace needs an Admin. If none exists yet, promote the signed-in
  // user — this is what unlocks the Admin panel for the person running the app.
  useEffect(() => {
    if (!user || !users) return;
    const members = store.getState().org.members;
    const hasAdmin = Object.values(members).some((m) => m.roleId === 'role-admin');
    if (!hasAdmin) {
      const meta = members[user.id];
      dispatch(
        setMemberMeta({ userId: user.id, roleId: 'role-admin', capacityHours: meta?.capacityHours ?? 40, status: meta?.status ?? 'active' })
      );
    }
  }, [dispatch, store, user, users]);

  useEffect(() => {
    if (projects) {
      dispatch(reconcileLists({ projects, defaultSpaceId: DEFAULT_SPACE_ID, createdAt: new Date().toISOString() }));
    }
  }, [dispatch, projects]);

  useEffect(() => {
    if (users) {
      dispatch(ensureMembers({ userIds: users.map((u) => u.id), defaultRoleId: 'role-member' }));
    }
  }, [dispatch, users]);

  return null;
}
