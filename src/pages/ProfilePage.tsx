import React, { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useSession,
  getTeamNameFromMembership,
  getSeasonLabelFromMembership,
  normalizeRole,
} from '../auth/useSession';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, profileDisplayName } from '../auth/useProfile';
import { supabase } from '../lib/supabaseClient';
import { Card, CardTitle } from '../app/components/ui/Card';
import { PushNotificationsButton } from '../components/PushNotificationsButton';

/** Profil-Lade-Timeout: danach Fallback-Karte statt stiller Blockade */
const PROFILE_LOAD_TIMEOUT_MS = 12000;

/** Push-UI erst nach kurzer Verzögerung mounten (vermeidet Blockaden beim ersten Paint). */
const PUSH_MOUNT_DELAY_MS = 400;

/** Optional: Push-Bereich komplett überspringen (z. B. VITE_DISABLE_PROFILE_PUSH=true) */
const DISABLE_PROFILE_PUSH =
  typeof import.meta !== 'undefined' && String(import.meta.env?.VITE_DISABLE_PROFILE_PUSH ?? '') === 'true';

/** Sichere Team-Namen-Extraktion (Supabase kann team als Objekt oder Array liefern). */
function getTeamName(ts: { team?: { name?: string } | Array<{ name?: string }> } | null | undefined): string {
  if (!ts?.team) return '–';
  const t = ts.team;
  const name = Array.isArray(t) ? t[0]?.name : (t as { name?: string })?.name;
  return name ?? '–';
}

type SectionBoundaryProps = { children: ReactNode; label: string; fallback?: ReactNode };

class ProfileSectionErrorBoundary extends Component<SectionBoundaryProps, { hasError: boolean }> {
  constructor(props: SectionBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ProfilePage] section error', this.props.label, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="mt-2 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/60">
            Dieser Bereich ist aktuell nicht verfügbar ({this.props.label}).
          </p>
        )
      );
    }
    return this.props.children;
  }
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    backendRole,
    effectiveRole,
    selectedTeamSeason,
    selectedMembership,
    signOut,
    hasPendingPlayerRequest,
    loading: sessionLoading,
    membershipError,
  } = useSession();

  const [linkedChildren, setLinkedChildren] = useState<string[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  const { profile, loading: profileLoading, error: profileError } = useProfile(authUser?.id);

  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);
  const [mountPushUi, setMountPushUi] = useState(false);

  const currentUIView = effectiveRole;
  const isAdminToolsVisible = backendRole === 'admin' && currentUIView === 'admin';

  const showPushSection =
    !DISABLE_PROFILE_PUSH &&
    (effectiveRole === 'parent' ||
      effectiveRole === 'player' ||
      effectiveRole === 'trainer' ||
      effectiveRole === 'co_trainer' ||
      effectiveRole === 'head_coach' ||
      effectiveRole === 'admin');

  const selectedTeamName = useMemo(() => {
    const fromTs = getTeamName(selectedTeamSeason);
    if (fromTs && fromTs !== '–') return fromTs;
    const t = getTeamNameFromMembership(selectedMembership)?.trim();
    const s = getSeasonLabelFromMembership(selectedMembership)?.trim();
    if (t && s && s !== '—') return `${t} (${s})`;
    if (t) return t;
    return '–';
  }, [selectedTeamSeason, selectedMembership]);

  const profileBackendRoleLabel = useMemo(() => {
    const mr = selectedMembership?.role;
    if (mr && String(mr).trim() !== '') {
      const n = normalizeRole(String(mr));
      return n !== '' ? n : String(mr).trim();
    }
    return backendRole || '–';
  }, [selectedMembership, backendRole]);
  const email = authUser?.email?.trim() || '–';
  const nameLine = profileDisplayName(profile);
  const headingMain = nameLine ?? email;
  const showEmailRow = nameLine != null && email !== '–';

  /** Nur Session-Gate; Profil lädt im Hintergrund (kein globales Blockieren). */
  const blockingLoad = !!(authUser && sessionLoading);

  useEffect(() => {
    console.log('[ProfilePage] mounted');
  }, []);

  useEffect(() => {
    if (authUser?.id) console.log('[ProfilePage] auth loaded', authUser.id);
  }, [authUser?.id]);

  useEffect(() => {
    if (!profileLoading && authUser) {
      console.log('[ProfilePage] profile loaded', { id: profile?.id, error: profileError });
    }
  }, [profileLoading, profile, profileError, authUser]);

  useEffect(() => {
    if (!sessionLoading) {
      console.log('[ProfilePage] memberships / session slice loaded', { membershipError });
    }
  }, [sessionLoading, membershipError]);

  useEffect(() => {
    if (!blockingLoad && authUser) {
      console.log('[ProfilePage] loading finished (profile + session)');
    }
  }, [blockingLoad, authUser]);

  useEffect(() => {
    if (!blockingLoad) {
      setProfileLoadTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => {
      console.warn('[ProfilePage] profile load timeout — showing fallback');
      setProfileLoadTimedOut(true);
    }, PROFILE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [blockingLoad]);

  useEffect(() => {
    if (DISABLE_PROFILE_PUSH) {
      console.log('[ProfilePage] push section skipped (VITE_DISABLE_PROFILE_PUSH)');
      return;
    }
    console.log('[ProfilePage] push section init scheduled', PUSH_MOUNT_DELAY_MS, 'ms');
    const t = window.setTimeout(() => {
      console.log('[ProfilePage] push section init start');
      setMountPushUi(true);
      console.log('[ProfilePage] push section init end');
    }, PUSH_MOUNT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setLinkedChildren([]);
      setChildrenError(null);
      setChildrenLoading(false);
      return;
    }

    const userId = authUser.id;
    let cancelled = false;

    async function loadChildren() {
      setChildrenLoading(true);
      setChildrenError(null);

      try {
        const { data: guardianRows, error: guardianError } = await supabase
          .from('player_guardians')
          .select('player_id')
          .eq('user_id', userId);

        console.log('[PROFILE CHILDREN GUARDIANS]', { data: guardianRows, error: guardianError });

        if (cancelled) return;

        if (guardianError) {
          setLinkedChildren([]);
          setChildrenError(guardianError.message ?? 'Kind-Verknüpfungen konnten nicht geladen werden.');
          return;
        }

        const playerIds = Array.from(
          new Set((guardianRows ?? []).map((row: { player_id?: string }) => row.player_id).filter(Boolean)),
        );

        if (playerIds.length === 0) {
          setLinkedChildren([]);
          return;
        }

        const { data: playerRows, error: playerError } = await supabase
          .from('players')
          .select('id, first_name, last_name')
          .in('id', playerIds)
          .or('status.eq.active,and(status.is.null,is_active.eq.true)');

        console.log('[PROFILE CHILDREN PLAYERS]', { data: playerRows, error: playerError });

        if (cancelled) return;

        if (playerError) {
          setLinkedChildren([]);
          setChildrenError(playerError.message ?? 'Spielerdaten konnten nicht geladen werden.');
          return;
        }

        const names = (playerRows ?? []).map((row: { first_name?: string; last_name?: string }) => {
          const first = (row.first_name ?? '').toString().trim();
          const last = (row.last_name ?? '').toString().trim();
          const label = `${first} ${last}`.trim() || 'Spieler';
          return label;
        });

        if (!cancelled) setLinkedChildren(names);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('[PROFILE CHILDREN LOAD ERROR]', e);
          setLinkedChildren([]);
          setChildrenError(e instanceof Error ? e.message : 'Kind-Verknüpfungen konnten nicht geladen werden.');
        }
      } finally {
        setChildrenLoading(false);
      }
    }

    void loadChildren().catch((e) => {
      console.error('[PROFILE CHILDREN] unhandled', e);
      setChildrenLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (e) {
      console.error('[ProfilePage] signOut failed', e);
    }
  };

  const slowLoadBanner = useMemo(() => {
    if (!profileLoadTimedOut || !blockingLoad) return null;
    return (
      <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
        Profilinformationen werden weiterhin geladen.
      </div>
    );
  }, [profileLoadTimedOut, blockingLoad]);

  return (
    <div
      className="page profile-page relative min-h-[60vh] w-full px-4 py-6"
      style={{
        background: 'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[480px] space-y-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profil</h1>

        <Card className="text-white shadow-lg shadow-black/20">
          <CardTitle className="text-lg">Profil</CardTitle>
          <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{headingMain}</p>
          {showEmailRow && (
            <p className="mt-1 text-sm text-[var(--text-sub)]">
              E-Mail: <span className="font-medium text-[var(--text-main)]">{email}</span>
            </p>
          )}

          {slowLoadBanner}

          {profileLoading && (
            <p className="mt-2 text-[10px] leading-relaxed text-white/40" role="status">
              Profilinformationen werden aktualisiert.
            </p>
          )}

          {membershipError && (
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              Team-Zuordnung wird geladen oder ist kurz nicht verfügbar.
            </p>
          )}

          <p className="mt-3 text-sm text-[var(--text-sub)]">
            Backend-Rolle:{' '}
            <span className="font-medium text-[var(--text-main)]">{profileBackendRoleLabel}</span>
          </p>

          <p className="mt-1 text-sm text-[var(--text-sub)]">
            UI-Ansicht:{' '}
            <span className="font-medium text-[var(--text-main)]">
              {effectiveRole !== '' ? effectiveRole : '–'}
            </span>
          </p>

          {hasPendingPlayerRequest && effectiveRole === 'fan' && (
            <p className="mt-2 text-xs text-amber-300">
              Deine Spieleranfrage wurde an den Trainer gesendet. Du erhältst Spielerzugriff, sobald sie bestätigt wurde.
            </p>
          )}

          <p className="mt-2 text-sm text-[var(--text-sub)]">
            Team: <span className="font-medium text-[var(--text-main)]">{selectedTeamName}</span>
          </p>

          {effectiveRole === 'parent' && (
            <ProfileSectionErrorBoundary label="Verknüpfte Kinder">
              <div className="mt-4 border-t border-white/10 pt-3 text-sm text-[var(--text-sub)]">
                <div className="font-medium text-[var(--text-main)]">Verknüpfte Kinder</div>
                {childrenLoading ? (
                  <p className="mt-0.5 text-xs text-[var(--text-sub)]">Lade Kind-Verknüpfung…</p>
                ) : childrenError ? (
                  <p className="mt-0.5 text-xs text-[var(--text-sub)]">Kind-Verknüpfung aktuell nicht verfügbar.</p>
                ) : linkedChildren.length === 0 ? (
                  <p className="mt-0.5 text-xs text-[var(--text-sub)]">Kein Kind verknüpft.</p>
                ) : (
                  <ul className="mt-0.5 list-disc pl-4 text-xs text-[var(--text-main)]">
                    {linkedChildren.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </ProfileSectionErrorBoundary>
          )}

          <p className="mt-4 text-xs text-[var(--text-sub)]">
            Später kannst du hier Kontaktinformationen, Benachrichtigungen und verknüpfte Kinder verwalten.
          </p>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            Abmelden
          </button>

          {import.meta.env.DEV && (
            <p className="mt-3 text-xs">
              <Link to="/admin/setup" className="text-[var(--primary)] hover:underline">
                Admin Setup
              </Link>
            </p>
          )}
        </Card>

        {showPushSection && mountPushUi && (
          <Card className="text-white shadow-lg shadow-black/20">
            <CardTitle className="text-lg">Benachrichtigungen</CardTitle>
            <ProfileSectionErrorBoundary label="Push-Benachrichtigungen">
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <PushNotificationsButton isAdminToolsVisible={isAdminToolsVisible} />
              </div>
            </ProfileSectionErrorBoundary>
          </Card>
        )}

      </div>
    </div>
  );
};
