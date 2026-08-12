import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  isParentInviteTokenShape,
  linkParentSelfService,
  listMyLinkedChildren,
  listParentOnboardingClubs,
  listParentOnboardingRoster,
  listParentOnboardingSeasons,
  listParentOnboardingTeams,
  normalizeParentInviteToken,
  persistParentRoleChoice,
  redeemParentLinkInvite,
  setParentLinkDeferred,
  userHasPlayerGuardian,
  type LinkedChildOption,
  type ParentOnboardingClubOption,
  type ParentOnboardingPlayerOption,
  type ParentOnboardingSeasonOption,
  type ParentOnboardingTeamOption,
} from '../lib/parentChildLink';

function isLinkMode(
  searchParams: URLSearchParams,
  locationState: unknown,
): boolean {
  if (searchParams.get('mode') === 'link') return true;
  if (
    locationState &&
    typeof locationState === 'object' &&
    'mode' in locationState &&
    (locationState as { mode?: unknown }).mode === 'link'
  ) {
    return true;
  }
  return false;
}

export const ParentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setPreviewRole } = useSession();
  const linkMode = isLinkMode(searchParams, location.state);

  const [userId, setUserId] = useState<string | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildOption[]>([]);
  const [clubs, setClubs] = useState<ParentOnboardingClubOption[]>([]);
  const [teams, setTeams] = useState<ParentOnboardingTeamOption[]>([]);
  const [seasons, setSeasons] = useState<ParentOnboardingSeasonOption[]>([]);
  const [players, setPlayers] = useState<ParentOnboardingPlayerOption[]>([]);

  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deferring, setDeferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [successHint, setSuccessHint] = useState<string | null>(null);

  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      setLoadError(null);
      setSuccessHint(null);

      const { data: userRes, error: authError } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!alive) return;

      if (authError || !user) {
        const msg = authError?.message ?? 'Kein Benutzer angemeldet.';
        setError(msg);
        setLoadError(msg);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const rolePersist = await persistParentRoleChoice();
      if (!alive) return;
      if (rolePersist.error) {
        setError(rolePersist.error);
        setLoadError(rolePersist.error);
        setLoading(false);
        return;
      }
      setPreviewRole('parent');

      const { hasGuardian, error: guardianError } = await userHasPlayerGuardian(user.id);
      if (!alive) return;

      if (guardianError) {
        setError(guardianError);
        setLoadError(guardianError);
        setLoading(false);
        return;
      }

      if (hasGuardian && !linkMode) {
        navigate('/app/home', { replace: true });
        return;
      }

      const linked = await listMyLinkedChildren();
      if (!alive) return;
      if (linked.error) {
        console.warn('[PARENT ONBOARDING] linked children', linked.error);
      }
      setLinkedChildren(linked.data);

      const clubRes = await listParentOnboardingClubs();
      if (!alive) return;

      if (clubRes.error) {
        setError(clubRes.error);
        setLoadError(clubRes.error);
        setClubs([]);
        setLoading(false);
        return;
      }

      setClubs(clubRes.data);
      if (clubRes.data.length === 1) {
        setSelectedClubId(clubRes.data[0].id);
      } else {
        setSelectedClubId('');
      }
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      const msg = e?.message ?? 'Unbekannter Fehler beim Laden.';
      setError(msg);
      setLoadError(msg);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [navigate, linkMode, setPreviewRole]);

  useEffect(() => {
    let alive = true;

    async function loadTeams() {
      if (!selectedClubId) {
        setTeams([]);
        setTeamsLoading(false);
        setTeamsError(null);
        setSelectedTeamId('');
        return;
      }

      setTeamsLoading(true);
      setTeamsError(null);
      setSelectedTeamId('');
      setSelectedTeamSeasonId('');
      setSelectedPlayerId('');
      setSeasons([]);
      setPlayers([]);

      const res = await listParentOnboardingTeams(selectedClubId);
      if (!alive) return;

      if (res.error) {
        setTeams([]);
        setTeamsError(res.error);
        setTeamsLoading(false);
        return;
      }

      setTeams(res.data);
      if (res.data.length === 1) {
        setSelectedTeamId(res.data[0].id);
      }
      setTeamsLoading(false);
    }

    loadTeams().catch((e) => {
      if (!alive) return;
      setTeams([]);
      setTeamsError(e?.message ?? 'Mannschaften konnten nicht geladen werden.');
      setTeamsLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [selectedClubId]);

  useEffect(() => {
    let alive = true;

    async function loadSeasons() {
      if (!selectedTeamId) {
        setSeasons([]);
        setSeasonsLoading(false);
        setSeasonsError(null);
        setSelectedTeamSeasonId('');
        return;
      }

      setSeasonsLoading(true);
      setSeasonsError(null);
      setSelectedTeamSeasonId('');
      setSelectedPlayerId('');
      setPlayers([]);

      const res = await listParentOnboardingSeasons(selectedTeamId);
      if (!alive) return;

      if (res.error) {
        setSeasons([]);
        setSeasonsError(res.error);
        setSeasonsLoading(false);
        return;
      }

      setSeasons(res.data);
      if (res.data.length > 0) {
        setSelectedTeamSeasonId(res.data[0].id);
      }
      setSeasonsLoading(false);
    }

    loadSeasons().catch((e) => {
      if (!alive) return;
      setSeasons([]);
      setSeasonsError(e?.message ?? 'Saisons konnten nicht geladen werden.');
      setSeasonsLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [selectedTeamId]);

  useEffect(() => {
    let alive = true;

    async function loadPlayers() {
      if (!selectedTeamSeasonId) {
        setPlayers([]);
        setPlayersLoading(false);
        setPlayersError(null);
        setSelectedPlayerId('');
        return;
      }

      setPlayersLoading(true);
      setPlayersError(null);
      setSelectedPlayerId('');

      const res = await listParentOnboardingRoster(selectedTeamSeasonId);
      if (!alive) return;

      if (res.error) {
        setPlayers([]);
        setPlayersError(res.error);
        setPlayersLoading(false);
        return;
      }

      setPlayers(res.data);
      setPlayersLoading(false);
    }

    loadPlayers().catch((e) => {
      if (!alive) return;
      setPlayers([]);
      setPlayersError(e?.message ?? 'Spieler konnten nicht geladen werden.');
      setPlayersLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [selectedTeamSeasonId]);

  const noClubs = !loading && !loadError && clubs.length === 0;
  const noTeams =
    !loading &&
    !loadError &&
    !!selectedClubId &&
    !teamsLoading &&
    !teamsError &&
    teams.length === 0;
  const noSeasons =
    !loading &&
    !loadError &&
    !!selectedTeamId &&
    !seasonsLoading &&
    !seasonsError &&
    seasons.length === 0;
  const noPlayersForSeason =
    !loading &&
    !loadError &&
    !!selectedTeamSeasonId &&
    !playersLoading &&
    !playersError &&
    players.length === 0;
  const noChildSelectable =
    noClubs || noTeams || noSeasons || noPlayersForSeason;

  const TEAM_SEASON_STORAGE_KEY = 'spielzeit_team_season_id';

  /** Harte Navigation nach Home — vermeidet Reload auf falscher URL / Onboarding-Schleife. */
  const goHome = (preferredTeamSeasonId?: string | null) => {
    try {
      if (preferredTeamSeasonId) {
        window.localStorage.setItem(TEAM_SEASON_STORAGE_KEY, preferredTeamSeasonId);
      }
    } catch {
      // ignore
    }
    window.location.assign('/app/home');
  };

  const handleDefer = async () => {
    if (saving || deferring) return;
    setDeferring(true);
    setError(null);

    const { error: roleError } = await persistParentRoleChoice();
    if (roleError) {
      setError(roleError);
      setDeferring(false);
      return;
    }

    const { error: deferError } = await setParentLinkDeferred(true);
    if (deferError) {
      setError(deferError);
      setDeferring(false);
      return;
    }

    // Session/User neu laden, damit parent_link_deferred im Gate ankommt
    await supabase.auth.getUser();
    setPreviewRole('parent');
    goHome();
  };

  const handleSave = async () => {
    if (saving || deferring) return;
    if (!userId || !selectedTeamSeasonId || !selectedPlayerId) {
      setError('Bitte Verein, Mannschaft, Saison und Kind auswählen.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessHint(null);

    try {
      const result = await linkParentSelfService(selectedTeamSeasonId, selectedPlayerId);
      if (result.status !== 'linked' && result.status !== 'already_linked') {
        console.warn('[PARENT ONBOARDING] link_parent_self_service failed', {
          status: result.status,
        });
        setError(result.message ?? 'Verknüpfung fehlgeschlagen.');
        setSaving(false);
        return;
      }

      await clearParentLinkDeferred();
      await supabase.auth.getUser();
      setPreviewRole('parent');
      setSuccessHint('Kind erfolgreich verknüpft.');

      // Kurz Erfolgsmeldung zeigen, dann Home mit frischer Session
      window.setTimeout(() => {
        goHome(result.teamSeasonId ?? selectedTeamSeasonId);
      }, 700);
    } catch (e) {
      console.warn('[PARENT ONBOARDING] link exception', {
        name: e instanceof Error ? e.name : 'unknown',
      });
      setError('Verknüpfung fehlgeschlagen. Bitte erneut versuchen.');
      setSaving(false);
    }
  };

  const handleRedeem = async () => {
    if (saving || deferring) return;
    if (!userId) {
      setError('Kein Benutzer angemeldet.');
      return;
    }

    const token = normalizeParentInviteToken(inviteCode);
    if (!isParentInviteTokenShape(token)) {
      setError('Bitte den vollständigen Einladungscode eingeben.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessHint(null);

    try {
      const result = await redeemParentLinkInvite(token);
      if (result.status !== 'linked' && result.status !== 'already_linked') {
        console.warn('[PARENT ONBOARDING] redeem failed', { status: result.status });
        setError(result.message ?? 'Verknüpfung fehlgeschlagen.');
        setSaving(false);
        return;
      }

      await clearParentLinkDeferred();
      await supabase.auth.getUser();
      setPreviewRole('parent');
      setSuccessHint('Kind erfolgreich verknüpft.');
      window.setTimeout(() => {
        goHome(result.teamSeasonId);
      }, 700);
    } catch (e) {
      console.warn('[PARENT ONBOARDING] redeem exception', {
        name: e instanceof Error ? e.name : 'unknown',
      });
      setError('Verknüpfung fehlgeschlagen. Bitte erneut versuchen.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page relative min-h-[60vh] px-4 pt-6">
        <div className="mx-auto max-w-[720px]">
          <Card>
            <div className="space-y-4">
              <CardTitle>Kind verknüpfen</CardTitle>
              <p className="text-sm text-[var(--text-sub)]">Lade…</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Kind verknüpfen</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              {linkMode
                ? 'Verknüpfe ein weiteres Kind mit deinem Eltern-Konto.'
                : 'Wähle Verein, Mannschaft, Saison und dein Kind aus.'}
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}
            {successHint && (
              <p className="text-sm text-emerald-400" role="status">
                {successHint}
              </p>
            )}

            {loadError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Es gab ein Problem beim Laden der Onboarding-Daten.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => window.location.reload()}
                  >
                    Erneut laden
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await supabase.auth.signOut();
                        navigate('/login', { replace: true });
                      } catch (e) {
                        console.error('[PARENT ONBOARDING] Abmelden fehlgeschlagen', e);
                      }
                    }}
                  >
                    Abmelden
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {linkedChildren.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--text-main)]">Bereits verknüpft</p>
                    <ul className="space-y-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                      {linkedChildren.map((child) => (
                        <li key={child.playerId} className="text-sm text-[var(--text-main)]">
                          {child.displayName}
                          {child.teamLabel ? (
                            <span className="text-[var(--text-sub)]"> · {child.teamLabel}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {noClubs ? (
                  <p className="text-sm text-[var(--text-sub)]">
                    Derzeit ist kein Verein für die Kind-Verknüpfung verfügbar. Du kannst diesen
                    Schritt überspringen oder später erneut versuchen.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-main)]">
                        Verein auswählen
                      </label>
                      <select
                        className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                        value={selectedClubId}
                        onChange={(e) => setSelectedClubId(e.target.value)}
                        disabled={clubs.length === 1}
                      >
                        {clubs.length > 1 && <option value="">Bitte wählen…</option>}
                        {clubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedClubId && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-main)]">
                          Mannschaft auswählen
                        </label>
                        {teamsLoading ? (
                          <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                        ) : teamsError ? (
                          <p className="text-sm text-red-400">{teamsError}</p>
                        ) : noTeams ? (
                          <p className="text-sm text-[var(--text-sub)]">
                            Für diesen Verein ist derzeit keine Mannschaft verfügbar.
                          </p>
                        ) : (
                          <select
                            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            disabled={teams.length === 1}
                          >
                            {teams.length > 1 && <option value="">Bitte wählen…</option>}
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {selectedTeamId && !noTeams && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-main)]">
                          Saison auswählen
                        </label>
                        {seasonsLoading ? (
                          <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                        ) : seasonsError ? (
                          <p className="text-sm text-red-400">{seasonsError}</p>
                        ) : noSeasons ? (
                          <p className="text-sm text-[var(--text-sub)]">
                            Für diese Mannschaft ist derzeit keine aktive Saison verfügbar.
                          </p>
                        ) : (
                          <select
                            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                            value={selectedTeamSeasonId}
                            onChange={(e) => setSelectedTeamSeasonId(e.target.value)}
                            disabled={seasons.length === 1}
                          >
                            {seasons.map((season) => (
                              <option key={season.id} value={season.id}>
                                {season.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {selectedTeamSeasonId && !noSeasons && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-[var(--text-main)]">
                          Kind auswählen
                        </label>
                        {playersLoading ? (
                          <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                        ) : playersError ? (
                          <p className="text-sm text-[var(--text-sub)]">
                            Spieler konnten nicht geladen werden.
                          </p>
                        ) : noPlayersForSeason ? (
                          <p className="text-sm text-[var(--text-sub)]">
                            Derzeit ist kein Kind auswählbar. Bereits verknüpfte Kinder werden nicht
                            erneut angeboten.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[260px] overflow-y-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                            {players.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-center justify-between gap-3 py-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="child"
                                    className="h-4 w-4"
                                    checked={selectedPlayerId === p.id}
                                    onChange={() => setSelectedPlayerId(p.id)}
                                  />
                                  <span className="text-sm text-[var(--text-main)]">
                                    {p.display_name}
                                  </span>
                                </div>
                                {p.jersey_number != null && (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--text-sub)]">
                                    #{p.jersey_number}
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!noChildSelectable && (
                      <div className="pt-2">
                        <Button
                          variant="primary"
                          className="w-full"
                          onClick={() => void handleSave()}
                          disabled={
                            saving ||
                            deferring ||
                            playersLoading ||
                            !selectedTeamSeasonId ||
                            !selectedPlayerId
                          }
                        >
                          {saving ? 'Wird gespeichert …' : 'Verknüpfung speichern'}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                <div className="pt-2">
                  <Button
                    variant={noChildSelectable ? 'primary' : 'ghost'}
                    className="w-full"
                    onClick={() => void handleDefer()}
                    disabled={saving || deferring}
                  >
                    {deferring ? 'Weiter …' : 'Später verknüpfen'}
                  </Button>
                </div>

                <div className="border-t border-[var(--glass-border)] pt-4">
                  {!showInviteCode ? (
                    <button
                      type="button"
                      className="text-sm text-[var(--text-sub)] underline-offset-2 hover:underline"
                      onClick={() => setShowInviteCode(true)}
                    >
                      Ich habe einen Einladungscode
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--text-sub)]">
                        Optional: Code vom Trainer eingeben (getrennt vom Spieler-Login).
                      </p>
                      <div className="space-y-2">
                        <label
                          htmlFor="parent-invite-code"
                          className="block text-sm font-medium text-[var(--text-main)]"
                        >
                          Einladungscode
                        </label>
                        <input
                          id="parent-invite-code"
                          type="text"
                          inputMode="text"
                          autoComplete="one-time-code"
                          spellCheck={false}
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          placeholder="Code vom Trainer"
                          className="h-12 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => void handleRedeem()}
                        disabled={saving || deferring || !inviteCode.trim()}
                      >
                        {saving ? 'Verknüpfe…' : 'Mit Code verknüpfen'}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
