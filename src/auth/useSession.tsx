import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Role, User, FeatureKey } from './rbac';
import { canAccess as canAccessFeature } from './rbac';
import type { TeamSeasonListItem, TeamSeasonTeam, TeamSeasonSeason } from '../services/teamSeasonRepo';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabaseClient';

/** team_seasons.id und memberships.team_season_id als string (UUID), nie Number. */
export type SessionTeamSeasonItem = Omit<TeamSeasonListItem, 'id'> & { id: string };

function normalizeTeamSeasonRow(raw: unknown): SessionTeamSeasonItem | null {
  const row = raw as {
    id: string | number;
    team_id?: number;
    season_id?: number;
    teams?: TeamSeasonTeam | TeamSeasonTeam[] | null;
    seasons?: TeamSeasonSeason | TeamSeasonSeason[] | null;
  };
  const teams = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  const seasons = Array.isArray(row.seasons) ? row.seasons[0] : row.seasons;
  if (teams && seasons) {
    return {
      id: typeof row.id === 'string' ? row.id : String(row.id),
      team_id: row.team_id,
      season_id: row.season_id,
      team: teams,
      season: seasons,
      teams,
      seasons,
    };
  }
  return null;
}

export type Membership = {
  id: string;
  role: string;
  team_season_id: string;
};

/** team_seasons-Join: id (UUID string) + team(name) + season(name). Supabase kann Objekt oder 1-Element-Array liefern. */
export type MembershipTeamSeasonsJoin = {
  id?: string;
  team?: { id: string; name: string };
  season?: { id: string; name: string };
  teams?: { id: string; name: string } | { id: string; name: string }[];
  seasons?: { id: string; name: string } | { id: string; name: string }[];
} | null;

/** Membership mit Join zu team_seasons inkl. team(name) und season(name). */
export type MembershipWithJoin = Membership & {
  team_seasons?: MembershipTeamSeasonsJoin;
};

/** Teamname aus Membership-Join. Null-check: team_seasons kann null sein. */
export function getTeamNameFromMembership(m: MembershipWithJoin | null | undefined): string {
  const ts = m?.team_seasons;
  if (!ts) return '';
  const t = ts.team ?? (Array.isArray(ts.teams) ? ts.teams[0] : ts.teams);
  return t?.name ?? '';
}

/** Saison-Label aus Membership-Join. Null-check; seasons hat nur (id, name), kein year. */
export function getSeasonLabelFromMembership(m: MembershipWithJoin | null | undefined): string {
  const ts = m?.team_seasons;
  if (!ts) return '—';
  const s = ts.season ?? (Array.isArray(ts.seasons) ? ts.seasons[0] : ts.seasons);
  return (s as { name?: string } | null)?.name ?? '—';
}

/** Interne Keys englisch; nur diese fünf. */
const ROLES = ['fan', 'parent', 'player', 'trainer', 'admin'] as const;
export type AllowedRole = (typeof ROLES)[number];

/** Beim Einlesen von membership.role: alte/abweichende Werte mappen, unbekannt -> '' (keine Rolle). */
export function normalizeRole(roleStr: string): string {
  const s = (roleStr ?? '').trim().toLowerCase();
  if (ROLES.includes(s as AllowedRole)) return s;
  if (s === 'eltern') return 'parent';
  if (s === 'spieler') return 'player';
  if (
    s === 'head' ||
    s === 'head_coach' ||
    s === 'headcoach' ||
    s === 'assistant' ||
    s === 'co_trainer' ||
    s === 'co-trainer' ||
    s === 'co trainer'
  )
    return 'trainer';
  return '';
}

function toRole(roleStr: string): Role {
  return normalizeRole(roleStr) as Role;
}

/**
 * Lädt die Rolle aus public.user_roles für den eingeloggten User.
 * Fallback nur wenn kein Eintrag existiert.
 */
export async function fetchUserRole(userId: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[useSession] fetchUserRole error:', error.message);
    return null;
  }
  const role = (data as { role?: string } | null)?.role;
  if (!role || typeof role !== 'string') return null;
  return toRole(role) as Role;
}

/** localStorage-Key für Preview-Rolle (Reset muss denselben Key löschen). */
export const PREVIEW_ROLE_STORAGE_KEY = 'spz_preview_role';

interface SessionContextValue {
  user: User | null;
  role: Role;
  setRole: (role: Role) => void;
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
  teamSeasons: SessionTeamSeasonItem[];
  selectedTeamSeasonId: string | null;
  selectedTeamSeason: SessionTeamSeasonItem | null;
  setSelectedTeamSeasonId: (id: string | null) => void;
  canAccess: (feature: FeatureKey) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  memberships: MembershipWithJoin[];
  /** Fehler beim Laden der Memberships (z. B. RLS) – für UI-Hinweis, kein Retry-Loop. */
  membershipError: string | null;
  /** Globale Rolle aus public.user_roles. */
  globalRole: string;
  /** Rolle der aktuell gewählten Membership (team_season). */
  membershipRole: string | null;
  backendRole: string;
  previewRole: string | null;
  setPreviewRole: (role: string | null) => void;
  effectiveRole: string;
  /** Ausgewählte Membership (für Teamname aus Join). */
  selectedMembership: MembershipWithJoin | null;
  /** True, wenn es mindestens eine pending Spieler-Anfrage (join_requests.requested_role='player') gibt. */
  hasPendingPlayerRequest: boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY_ROLE = 'spielzeit_role';
const LOCAL_STORAGE_KEY_TEAM = 'spielzeit_team';
const LOCAL_STORAGE_KEY_TEAM_SEASON_ID = 'spielzeit_team_season_id';

const defaultTeamId = 'u11';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [roleFromUserRoles, setRoleFromUserRoles] = useState<Role | null>(null);
  const [selectedTeamId, setSelectedTeamIdState] = useState<string>(defaultTeamId);
  const [teamSeasons, setTeamSeasons] = useState<SessionTeamSeasonItem[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonIdState] = useState<string | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [memberships, setMemberships] = useState<MembershipWithJoin[]>([]);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  /** Kein Restore aus localStorage: Preview darf den Login-Flow nicht überschreiben. */
  const [previewRole, setPreviewRoleState] = useState<string | null>(null);
  const [hasPendingPlayerRequest, setHasPendingPlayerRequest] = useState(false);

  const selectedTeamSeason = useMemo(
    () => teamSeasons.find((ts) => ts.id === selectedTeamSeasonId) ?? null,
    [teamSeasons, selectedTeamSeasonId],
  );

  const loading = authLoading || (!!authUser && membershipLoading);

  const selectedMembership = useMemo(
    () => memberships.find((m) => m.team_season_id === selectedTeamSeasonId) ?? null,
    [memberships, selectedTeamSeasonId],
  );

  /** Globale Rolle aus public.user_roles (leer bis nach Fetch). */
  const globalRole = roleFromUserRoles ?? '';

  /** Rolle der gewählten Membership; null wenn keine oder nicht geladen. */
  const membershipRole = selectedMembership?.role ?? null;

  /** Anzeige-Backend-Rolle (global); erst nach Fetch gesetzt, sonst leer. */
  const backendRole = globalRole;

  /**
   * UI-Rolle (Badge, Tabs, …): strikt Preview ODER Membership zur aktiven team_season_id.
   * user_roles (backendRole) steuert nur Admin-/Staff-Features, ersetzt keine Team-Rolle.
   */
  const effectiveRole = useMemo((): string => {
    if (authUser && membershipLoading) {
      return '';
    }

    // Nur ohne Team-Membership: gewählte Rolle aus Role-Choice / Preview (nicht aus localStorage beim Start)
    if (memberships.length === 0 && previewRole) {
      const p = toRole(previewRole);
      if (p) return p;
    }

    const fromMembership =
      selectedMembership?.role && String(selectedMembership.role).trim() !== ''
        ? toRole(selectedMembership.role)
        : '';
    if (fromMembership) {
      return fromMembership;
    }

    // Ohne Team-Membership: pending Spieler-Anfrage → Fan-UI
    if (
      hasPendingPlayerRequest &&
      memberships.length === 0 &&
      roleFromUserRoles &&
      toRole(roleFromUserRoles) === 'player'
    ) {
      return 'fan';
    }

    // Keine Memberships: globale Rolle, aber kein Admin als App-Einstieg
    if (memberships.length === 0) {
      const g = roleFromUserRoles ? toRole(roleFromUserRoles) : null;
      if (g === 'player' || g === 'admin') return '';
      return (g ?? '') || '';
    }

    // Memberships da, aber selectedTeamSeasonId passt zu keiner Zeile: Rolle aus Membership (Trainer > Eltern > erste)
    const validSeasonIds = new Set(teamSeasons.map((ts) => ts.id));
    const firstTrainer = memberships.find(
      (m) => normalizeRole(m.role) === 'trainer' && validSeasonIds.has(m.team_season_id),
    );
    if (firstTrainer) return toRole(firstTrainer.role);
    const firstParent = memberships.find(
      (m) => normalizeRole(m.role) === 'parent' && validSeasonIds.has(m.team_season_id),
    );
    if (firstParent) return toRole(firstParent.role);
    const firstAny = memberships.find((m) => validSeasonIds.has(m.team_season_id));
    if (firstAny) return toRole(firstAny.role);
    return '';
  }, [
    authUser,
    membershipLoading,
    selectedMembership?.role,
    selectedTeamSeasonId,
    roleFromUserRoles,
    hasPendingPlayerRequest,
    memberships,
    teamSeasons,
    previewRole,
  ]);

  const selectedMembershipRoleForDebug = selectedMembership?.role ?? null;

  /** Temporäres Debug-Logging (nur DEV); primitive deps — keine Loops durch Objekt-Identität */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[Session]', {
      email: authUser?.email,
      user_id: authUser?.id,
      membershipCount: memberships.length,
      selectedTeamSeasonId,
      selectedMembershipRole: selectedMembershipRoleForDebug,
      membershipLoading,
      finalRole: effectiveRole,
    });
  }, [
    authUser?.email,
    authUser?.id,
    memberships.length,
    selectedTeamSeasonId,
    selectedMembershipRoleForDebug,
    membershipLoading,
    effectiveRole,
  ]);

  /** Speichert immer den Key (via toRole), nie deutsche Labels. */
  const setPreviewRole = useCallback((role: string | null) => {
    const key = role ? toRole(role) : null;
    setPreviewRoleState(key);
    try {
      if (key) window.localStorage.setItem(PREVIEW_ROLE_STORAGE_KEY, key);
      else window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const storedTeam = window.localStorage.getItem(LOCAL_STORAGE_KEY_TEAM);
      if (storedTeam) setSelectedTeamIdState(storedTeam);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      setRoleFromUserRoles(null);
      setHasPendingPlayerRequest(false);
      setPreviewRoleState(null);
      try {
        window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }
  }, [authUser]);

  // A) Memberships first, then team_seasons by membership ids. selectedTeamSeasonId always string | null.
  useEffect(() => {
    if (!authUser) {
      setMembershipLoading(false);
      setMembershipError(null);
      setTeamSeasons([]);
      setSelectedTeamSeasonIdState(null);
      setMemberships([]);
      setHasPendingPlayerRequest(false);
      return;
    }

    let cancelled = false;
    setMembershipLoading(true);
    setMembershipError(null);
    console.info('[startup] memberships fetch start');

    const run = async () => {
      try {
        const [dbRole, membershipsRes] = await Promise.all([
          fetchUserRole(authUser.id),
          supabase
            .from('memberships')
            .select(`
  id,
  role,
  team_season_id,
  team_seasons (
    id,
    team:teams ( id, name ),
    season:seasons ( id, name )
  )
`)
            .eq('user_id', authUser.id)
            .order('id', { ascending: true }),
        ]);

        if (cancelled) return;

        const roleToSet = dbRole ?? null;
        setRoleFromUserRoles(roleToSet);
        try {
          if (roleToSet) {
            window.localStorage.setItem(LOCAL_STORAGE_KEY_ROLE, roleToSet);
          } else {
            window.localStorage.removeItem(LOCAL_STORAGE_KEY_ROLE);
          }
        } catch {
          // ignore
        }

        const { data, error } = membershipsRes;
        if (error) {
          console.error('[useSession] memberships error:', error.message);
          setMemberships([]);
          setTeamSeasons([]);
          setSelectedTeamSeasonIdState(null);
          setMembershipError(error.message);
          return;
        }

        setMembershipError(null);
        const list = ((data ?? []) as MembershipWithJoin[]).map((m) => ({
          ...m,
          role: normalizeRole(m.role),
        }));
        setMemberships(list);

        if (list.length === 0) {
          setTeamSeasons([]);
          setSelectedTeamSeasonIdState(null);
          return;
        }

        const teamSeasonIds = list.map((m) => m.team_season_id).filter(Boolean) as string[];
        if (teamSeasonIds.length === 0) {
          setTeamSeasons([]);
          setSelectedTeamSeasonIdState(null);
          return;
        }

        const { data: tsData, error: tsError } = await supabase
          .from('team_seasons')
          .select(`
  id,
  team_id,
  season_id,
  teams:teams ( id, name, age_group ),
  seasons:seasons ( id, name )
`)
          .in('id', teamSeasonIds)
          .order('id', { ascending: true });

        if (cancelled) return;

        if (tsError) {
          console.error('[useSession] team_seasons error:', tsError.message);
          setTeamSeasons([]);
          setSelectedTeamSeasonIdState(null);
          return;
        }

        const rawRows = (tsData ?? []) as unknown[];
        const normalized: SessionTeamSeasonItem[] = [];
        for (const raw of rawRows) {
          const item = normalizeTeamSeasonRow(raw);
          if (item) normalized.push(item);
        }
        setTeamSeasons(normalized);

        if (normalized.length > 0) {
          const validIds = new Set(normalized.map((ts) => ts.id));
          const pickPreferredTeamSeasonId = (): string => {
            const t = list.find(
              (m) => normalizeRole(m.role) === 'trainer' && validIds.has(m.team_season_id),
            );
            if (t) return t.team_season_id;
            const p = list.find(
              (m) => normalizeRole(m.role) === 'parent' && validIds.has(m.team_season_id),
            );
            if (p) return p.team_season_id;
            const any = list.find((m) => validIds.has(m.team_season_id));
            if (any) return any.team_season_id;
            return normalized[0].id;
          };
          const selectedId = pickPreferredTeamSeasonId();
          setSelectedTeamSeasonIdState(selectedId);
          try {
            window.localStorage.setItem(LOCAL_STORAGE_KEY_TEAM_SEASON_ID, selectedId);
          } catch {
            // ignore
          }
        } else {
          setSelectedTeamSeasonIdState(null);
        }

        // Pending Spieler-Anfragen (nach team_seasons, vor Loading-Ende)
        try {
          if (!cancelled) {
            const { data: jrData, error: jrError } = await supabase
              .from('join_requests')
              .select('id')
              .eq('user_id', authUser.id)
              .eq('requested_role', 'player')
              .eq('status', 'pending')
              .limit(1);
            if (jrError) {
              console.warn('[useSession] join_requests(player,pending) error:', jrError.message);
              setHasPendingPlayerRequest(false);
            } else {
              setHasPendingPlayerRequest((jrData ?? []).length > 0);
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[useSession] join_requests(player,pending) exception:', msg);
          if (!cancelled) setHasPendingPlayerRequest(false);
        }
      } finally {
        if (!cancelled) {
          console.info('[startup] memberships fetch end');
          setMembershipLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  /** Falls Membership-Fetch hängt: nach 3s Loading beenden (Shell bleibt nutzbar). */
  useEffect(() => {
    if (!authUser || !membershipLoading) return;
    const t = window.setTimeout(() => {
      console.warn('[startup] membership load safety timeout — forcing membershipLoading false');
      setMembershipLoading(false);
      setMembershipError((prev) => prev ?? 'Zeitüberschreitung beim Laden der Team-Daten.');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [authUser?.id, membershipLoading]);

  const setRole = (next: Role) => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_ROLE, next);
    } catch {
      // ignore
    }
  };

  const setSelectedTeamId = (teamId: string) => {
    setSelectedTeamIdState(teamId);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_TEAM, teamId);
    } catch {
      // ignore
    }
  };

  const setSelectedTeamSeasonId = (id: string | null) => {
    setSelectedTeamSeasonIdState(id === '' || id == null ? null : id);
    try {
      if (id != null && id !== '') {
        window.localStorage.setItem(LOCAL_STORAGE_KEY_TEAM_SEASON_ID, id);
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY_TEAM_SEASON_ID);
      }
    } catch {
      // ignore
    }
  };

  const user: User | null = useMemo(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.email ?? authUser.id,
      role: toRole(effectiveRole),
    };
  }, [authUser, effectiveRole]);

  const derivedTeamId = selectedTeamSeason?.team.id ?? selectedTeamId;

  const value: SessionContextValue = {
    user,
    role: toRole(effectiveRole),
    setRole,
    selectedTeamId: derivedTeamId,
    setSelectedTeamId,
    teamSeasons,
    selectedTeamSeasonId,
    selectedTeamSeason,
    setSelectedTeamSeasonId,
    canAccess: (feature) => canAccessFeature(user, feature),
    loading,
    signOut,
    memberships,
    membershipError,
    globalRole,
    membershipRole,
    backendRole,
    previewRole,
    setPreviewRole,
    effectiveRole,
    selectedMembership,
    hasPendingPlayerRequest,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}

