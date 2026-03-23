import React, { ChangeEvent, Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession, PREVIEW_ROLE_STORAGE_KEY } from '../auth/useSession';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, profileHeadingLine } from '../auth/useProfile';
import { supabase } from '../lib/supabaseClient';
import { Card, CardTitle } from '../app/components/ui/Card';
import { PushNotificationsButton } from '../components/PushNotificationsButton';
import { PushTeamSendPanel } from '../components/PushTeamSendPanel';
import { TeamReminderSettingsPanel } from '../components/TeamReminderSettingsPanel';

const PREVIEW_ROLE_OPTIONS = ['fan', 'parent', 'player', 'trainer', 'co_trainer', 'head_coach', 'admin'] as const;

const ROLE_LABELS: Record<string, string> = {
  fan: 'Fan',
  parent: 'Parent',
  player: 'Player',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
  head_coach: 'Head Coach',
  admin: 'Admin',
};

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
          <p className="mt-2 rounded-md border border-red-500/30 bg-red-950/30 px-2 py-2 text-xs text-red-200" role="alert">
            Dieser Bereich konnte nicht geladen werden ({this.props.label}).
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
    user,
    backendRole,
    effectiveRole,
    previewRole,
    setPreviewRole,
    selectedTeamSeason,
    selectedTeamSeasonId,
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

  const showPreviewSwitch = backendRole === 'admin' || backendRole === 'head_coach';
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

  /** Team-Push nur für Staff + Admin mit gewählter Saison (war vorher undefiniert → ReferenceError → „App lädt…“). */
  const showTeamPushSend =
    selectedTeamSeasonId != null &&
    (effectiveRole === 'trainer' || effectiveRole === 'co_trainer' || effectiveRole === 'head_coach' || effectiveRole === 'admin');

  const selectedTeamName = getTeamName(selectedTeamSeason);
  const email = authUser?.email ?? user?.name ?? '–';
  const headingMain = profileHeadingLine(profile, email);
  const emailLo = email.trim().toLowerCase();
  const headingLo = headingMain.trim().toLowerCase();
  const showEmailRow = email !== '–' && headingLo !== emailLo;

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
    try {
      const raw = window.localStorage.getItem(PREVIEW_ROLE_STORAGE_KEY);
      if (raw) console.log('[ProfilePage] preview role restored from storage', raw);
    } catch (e) {
      console.warn('[ProfilePage] preview role storage read failed', e);
    }
  }, []);

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
          .in('id', playerIds);

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

  const handlePreviewRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const v = event.target.value;
    try {
      setPreviewRole(v === '' ? null : v);
      console.log('[ProfilePage] preview role changed', v || '(reset)');
    } catch (e) {
      console.error('[ProfilePage] preview role change failed', e);
    }
  };

  const handleResetPreview = () => {
    try {
      setPreviewRole(null);
      window.localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      console.log('[ProfilePage] preview role reset');
    } catch (e) {
      console.warn('[ProfilePage] preview reset failed', e);
    }
  };

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
      <div
        className="mt-2 rounded-md border border-amber-500/50 bg-amber-950/50 px-3 py-3 text-sm text-amber-100"
        role="alert"
      >
        <p className="font-medium">Profil konnte nicht vollständig geladen werden.</p>
        <p className="mt-1 text-xs text-amber-200/90">Bitte Seite neu laden oder später erneut versuchen.</p>
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
      <div className="mx-auto max-w-[480px] space-y-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profil</h1>

        <Card className="text-white">
          <CardTitle className="text-lg">Profil</CardTitle>
          <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{headingMain}</p>
          {showEmailRow && (
            <p className="mt-1 text-sm text-[var(--text-sub)]">
              E-Mail: <span className="font-medium text-[var(--text-main)]">{email}</span>
            </p>
          )}

          {slowLoadBanner}

          {(profileLoading || (!profileLoading && profileError && !profile)) && (
            <p className="mt-2 text-[11px] leading-relaxed text-white/45" role="status">
              {profileLoading ? 'Profil wird geladen…' : 'Profilinformationen werden aktualisiert.'}
            </p>
          )}

          {membershipError && (
            <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-950/40 px-2 py-2 text-xs text-amber-200" role="alert">
              Team-Zuordnung konnte nicht geladen werden. Bitte Seite neu laden oder später erneut versuchen.
            </p>
          )}

          <p className="mt-3 text-sm text-[var(--text-sub)]">
            Backend-Rolle: <span className="font-medium text-[var(--text-main)]">{backendRole}</span>
          </p>

          <p className="mt-1 text-sm text-[var(--text-sub)]">
            UI-Ansicht: <span className="font-medium text-[var(--text-main)]">{effectiveRole}</span>
            {previewRole != null && previewRole !== backendRole && (
              <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
                Preview
              </span>
            )}
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
                  <p className="mt-0.5 text-xs text-red-400">{childrenError}</p>
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
          <Card className="text-white">
            <CardTitle className="text-lg">Benachrichtigungen</CardTitle>
            <ProfileSectionErrorBoundary label="Push-Benachrichtigungen">
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <PushNotificationsButton isAdminToolsVisible={isAdminToolsVisible} />
              </div>
            </ProfileSectionErrorBoundary>
          </Card>
        )}

        {showTeamPushSend && mountPushUi && (
          <Card className="text-white">
            <CardTitle className="text-lg">Team-Push</CardTitle>
            <p className="mt-1 text-xs text-white/55">Nachricht an Eltern/Spieler mit Push (manuell).</p>
            <ProfileSectionErrorBoundary label="Team-Push senden">
              <div className="mt-3">
                <PushTeamSendPanel teamSeasonId={selectedTeamSeasonId} />
              </div>
            </ProfileSectionErrorBoundary>
          </Card>
        )}

        {showTeamPushSend && (
          <ProfileSectionErrorBoundary label="Erinnerungen">
            <Card className="text-white">
              <CardTitle className="text-lg">Erinnerungen</CardTitle>
              <p className="mt-1 text-xs text-white/55">Automatische Termin-Erinnerungen für das Team.</p>
              <TeamReminderSettingsPanel teamSeasonId={selectedTeamSeasonId} embedded />
            </Card>
          </ProfileSectionErrorBoundary>
        )}

        {showPreviewSwitch && (
          <ProfileSectionErrorBoundary label="Rollen-Vorschau">
            <Card className="text-white">
              <CardTitle className="text-lg">Ansicht testen als</CardTitle>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  id="preview-role-select"
                  value={previewRole ?? ''}
                  onChange={handlePreviewRoleChange}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-black/40 px-2 py-1.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                >
                  <option value="">— Backend-Rolle —</option>
                  {PREVIEW_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-[var(--text-main)] hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </Card>
          </ProfileSectionErrorBoundary>
        )}
      </div>
    </div>
  );
};
