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

/** Beim Einlesen von membership.role: alte/abweichende Werte mappen, unbekannt -> 'fan'. */
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
  return 'fan';
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

const LOCAL_STORAGE_KEY_PREVIEW_ROLE = 'spz_preview_role';

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
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY_ROLE = 'spielzeit_role';
const LOCAL_STORAGE_KEY_TEAM = 'spielzeit_team';
const LOCAL_STORAGE_KEY_TEAM_SEASON_ID = 'spielzeit_team_season_id';

const defaultTeamId = 'u11';

function readPreviewRole(): string | null {
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY_PREVIEW_ROLE);
    return stored ? toRole(stored) : null;
  } catch {
    return null;
  }
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [roleFromUserRoles, setRoleFromUserRoles] = useState<Role | null>(null);
  const [selectedTeamId, setSelectedTeamIdState] = useState<string>(defaultTeamId);
  const [teamSeasons, setTeamSeasons] = useState<SessionTeamSeasonItem[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonIdState] = useState<string | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [memberships, setMemberships] = useState<MembershipWithJoin[]>([]);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [previewRole, setPreviewRoleState] = useState<string | null>(readPreviewRole);

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

  /** effectiveRole: normalisiert über toRole(), keine Altlasten (head_coach etc.) im UI.
   *  Wichtig: Kein hartes Fallback mehr auf "fan" – "Fan" soll nicht Default sein,
   *  wenn der User noch keine Rolle hat. */
  const effectiveRole = useMemo((): string => {
    const normalizedBackend = toRole(roleFromUserRoles ?? '');
    const normalizedPreview = previewRole ? toRole(previewRole) : null;
    const normalizedMembership = selectedMembership?.role ? toRole(selectedMembership.role) : null;
    if (normalizedBackend === 'admin') return normalizedPreview ?? 'admin';
    // Wenn weder Preview noch Membership gesetzt sind, bleibt effectiveRole leer.
    // Die Aufrufer entscheiden dann selbst, was passieren soll (z. B. RoleChoicePage).
    return normalizedPreview ?? normalizedMembership ?? '';
  }, [roleFromUserRoles, previewRole, selectedMembership?.role]);

  /** Speichert immer den Key (via toRole), nie deutsche Labels. */
  const setPreviewRole = useCallback((role: string | null) => {
    const key = role ? toRole(role) : null;
    setPreviewRoleState(key);
    try {
      if (key) window.localStorage.setItem(LOCAL_STORAGE_KEY_PREVIEW_ROLE, key);
      else window.localStorage.removeItem(LOCAL_STORAGE_KEY_PREVIEW_ROLE);
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
      return;
    }
  }, [authUser]);

  // A) Memberships first, then team_seasons by membership ids. selectedTeamSeasonId always string | null.
  useEffect(() => {
    if (!authUser) {
      setMembershipError(null);
      setTeamSeasons([]);
      setSelectedTeamSeasonIdState(null);
      return;
    }
    let cancelled = false;
    setMembershipLoading(true);
    setMembershipError(null);

    const run = async () => {
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

      // Kein Default "fan" mehr: Wenn keine DB-Rolle existiert, lassen wir roleFromUserRoles leer.
      const roleToSet = dbRole ?? ('' as Role | '');
      setRoleFromUserRoles(roleToSet || null);
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
        // Bei Fehler ebenfalls kein hartes "fan"-Fallback – Rolle bleibt leer.
        setRoleFromUserRoles(null);
        setMembershipError(error.message);
        setMembershipLoading(false);
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
        setMembershipLoading(false);
        return;
      }

      const teamSeasonIds = list.map((m) => m.team_season_id).filter(Boolean) as string[];
      if (teamSeasonIds.length === 0) {
        setTeamSeasons([]);
        setSelectedTeamSeasonIdState(null);
        setMembershipLoading(false);
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
        setMembershipLoading(false);
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
        let selectedId: string;
        try {
          const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY_TEAM_SEASON_ID);
          const valid = stored != null && normalized.some((ts) => ts.id === stored);
          selectedId = valid && stored != null ? stored : normalized[0].id;
        } catch {
          selectedId = normalized[0].id;
        }
        setSelectedTeamSeasonIdState(selectedId);
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY_TEAM_SEASON_ID, selectedId);
        } catch {
          // ignore
        }
      } else {
        setSelectedTeamSeasonIdState(null);
      }

      setMembershipLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

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
      if (id !== '') {
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

