import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CalendarRange, ChevronRight, Link2, Settings, Smartphone, Users, Wrench } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { supabase } from '../lib/supabaseClient';
import { isHapticEnabled, setHapticEnabled, triggerHaptic } from '../lib/hapticFeedback';
import {
  canPrepareNextSeason,
  formatTeamSeasonCompactSwitcherLabel,
  resolveTeamSeasonSwitcherAction,
} from '../lib/seasonLifecycle';
import { canViewParentLinks, normalizeRole } from '../lib/roles';
import { dsGlassToggleTrack, dsPanelRowClass, dsPrimaryCtaClass, dsSecondaryCtaClass } from '../lib/premiumDesignSystem';
import { canAccessManager } from '../manager/canAccessManager';
import { isPlatformAdminBackendRole } from '../manager/managerWorkMode';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { useDemoMode } from '../demo/DemoContext';
import { DemoAiDisclosure } from '../demo/components/DemoAiDisclosure';
import { DEMO_TOUR_STATIONS } from '../demo/demoTourConfig';
import {
  canResumeDemoTour,
  getDemoTourSnapshot,
  pauseDemoTour,
  resetDemoTourState,
  resumeOrStartDemoTour,
  subscribeDemoTour,
} from '../demo/demoTourState';

const RESET_CONFIRM =
  'Demo zurücksetzen? Alle lokalen Änderungen wie Zusagen, Aufstellungen, LIVE-Ereignisse und Ergebnisse werden auf den Ausgangszustand zurückgesetzt.';

function DemoHelpCard(): React.ReactElement {
  const demo = useDemoMode();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(() => getDemoTourSnapshot().phase);

  useEffect(() => subscribeDemoTour(() => setPhase(getDemoTourSnapshot().phase)), []);

  const start = () => {
    navigate('/demo/tour/what');
  };
  const resume = () => {
    const snap = resumeOrStartDemoTour();
    const station = DEMO_TOUR_STATIONS[snap.stepIndex];
    if (station) navigate(station.path);
  };
  const exploreFree = () => {
    pauseDemoTour();
    navigate('/demo/home');
  };
  const reset = () => {
    if (!demo?.resetAllDemo) return;
    if (!window.confirm(RESET_CONFIRM)) return;
    demo.resetAllDemo();
    resetDemoTourState();
    navigate('/demo/home', { replace: true });
  };

  const showResume = canResumeDemoTour(phase);

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-400/90">Demo-Hilfe</p>
      <h2 className="mt-1 text-[16px] font-semibold text-white">Rundgang &amp; Zurücksetzen</h2>
      <p className="mt-1 text-[12px] leading-snug text-white/55">
        Kein Login erforderlich. Alle Aktionen bleiben lokal in dieser Demo. Tour-Fortschritt und
        lokale Änderungen bleiben in der Browser-Session erhalten (auch nach Reload).
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {showResume ? (
          <button
            type="button"
            onClick={resume}
            className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
          >
            Geführte Demo fortsetzen
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className={`${dsPrimaryCtaClass()} inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-full px-4 text-[13px] font-semibold`}
          >
            Geführte Demo starten
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            resetDemoTourState();
            navigate('/demo/tour/what');
          }}
          className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
        >
          Rundgang neu starten
        </button>
        <button
          type="button"
          onClick={exploreFree}
          className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
        >
          Demo frei erkunden
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[40px] touch-manipulation items-center justify-center rounded-full border border-red-500/30 px-4 text-[12px] font-semibold text-red-300 hover:bg-red-500/10"
        >
          Demo zurücksetzen
        </button>
      </div>
      <div className="mt-3">
        <DemoAiDisclosure />
      </div>
    </PremiumCard>
  );
}

const subRowClass = `${dsPanelRowClass()} pl-10`;

function isTrainerToolsRole(role: string): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

/** Reminder-/Push-Debug nur Admin oder Trainer (effectiveRole ist nach normalizeRole u. a. „trainer“ für Co/Head). */
function showMehrHubDebugButtons(backendRole: string, effectiveRole: string): boolean {
  const br = (backendRole ?? '').trim().toLowerCase();
  const er = (effectiveRole ?? '').trim().toLowerCase();
  if (br === 'admin') return true;
  if (er === 'trainer') return true;
  return false;
}

/** App-Pfad → Demo-Pfad oder null (dann „Noch nicht Teil der Demo“). */
function demoHrefFor(appPath: string): string | null {
  // Keine Self-Loops und keine irreführenden Umleitungen für nicht demo-fähige Bereiche.
  void appPath;
  return null;
}

function HubRowLink({
  to,
  className,
  isDemo,
  children,
}: {
  to: string;
  className: string;
  isDemo: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  if (!isDemo) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  const demoTo = demoHrefFor(to);
  if (demoTo) {
    return (
      <Link to={demoTo} className={className} title="Demo-Bereich">
        {children}
      </Link>
    );
  }
  return (
    <div
      className={`${className} cursor-default opacity-65`}
      title="Noch nicht Teil der Demo"
      aria-disabled="true"
    >
      {children}
    </div>
  );
}

export const MoreHubPage: React.FC = () => {
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const {
    selectedTeamSeason,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    setViewTeamSeasonId,
    teamSeasons,
    effectiveRole: sessionEffectiveRole,
    backendRole: sessionBackendRole,
    memberships,
    user,
  } = useSession();
  const effectiveRole = isDemo ? 'trainer' : sessionEffectiveRole;
  const backendRole = isDemo ? 'trainer' : sessionBackendRole;
  /** Alle Rollen mit >1 Saison: Archiv/Historie muss erreichbar bleiben (nicht nur Trainer). */
  const canSwitchTeam =
    !isDemo && (teamSeasons?.length ?? 0) > 1 && normalizeRole(effectiveRole) !== 'parent';

  const showTrainerTools = !isDemo && isTrainerToolsRole(effectiveRole);
  const showSeasonManagement =
    !isDemo &&
    (backendRole === 'admin' ||
      canPrepareNextSeason(effectiveRole) ||
      canPrepareNextSeason(backendRole) ||
      isTrainerToolsRole(effectiveRole));
  /** Rollen-Vorschau: nur echte Plattformadmin-Rolle aus user_roles, nie Preview/Membership. */
  const showPreviewLink = !isDemo && isPlatformAdminBackendRole(backendRole);
  const showManagerLink = !isDemo && canAccessManager(backendRole, memberships ?? []);
  const showParentAccessLink = !isDemo && canViewParentLinks(normalizeRole(effectiveRole));
  /** Push-/Reminder-Debug in der Demo immer aus — keine echten Writes/Pushes. */
  const showDebugHubButtons = !isDemo && showMehrHubDebugButtons(backendRole, effectiveRole);
  const unreadCountRaw = useUnreadCount(user?.id);
  const unreadCount = isDemo ? 0 : unreadCountRaw;

  const [hasLinkedChildren, setHasLinkedChildren] = useState(false);
  useEffect(() => {
    if (isDemo) {
      setHasLinkedChildren(false);
      return;
    }
    if (normalizeRole(effectiveRole) !== 'parent') {
      setHasLinkedChildren(false);
      return;
    }
    if (!user?.id) {
      setHasLinkedChildren(false);
      return;
    }

    let cancelled = false;
    void supabase
      .from('player_guardians')
      .select('player_id')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[MoreHubPage] guardian count load failed', error.message ?? error);
          setHasLinkedChildren(false);
          return;
        }
        setHasLinkedChildren(Array.isArray(data) && data.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setHasLinkedChildren(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemo, effectiveRole, user?.id]);

  const [teamAdminOpen, setTeamAdminOpen] = useState(false);
  const [trainerToolsOpen, setTrainerToolsOpen] = useState(false);
  const [hapticOn, setHapticOn] = useState(true);

  useEffect(() => {
    setHapticOn(isHapticEnabled());
  }, []);

  const runParentsPushDebug = async () => {
    console.log('[direct-push-debug] direct push start');
    const teamSeasonId = selectedTeamSeasonId ?? selectedTeamSeason?.id ?? '';
    if (!teamSeasonId) {
      alert('Keine aktive Team-Saison gewählt.');
      return;
    }
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const accessToken = sessionRes.session?.access_token;
      const uid = sessionRes.session?.user?.id;
      console.log('[direct-push-debug] current user id (Trainer)', uid);
      if (!accessToken) {
        console.error('[direct-push-debug] no access token');
        alert('Nicht angemeldet.');
        return;
      }
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ debugParents: true, teamSeasonId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        logs?: string[];
        teamSeasonId?: string;
        parentUserCount?: number;
        subscriptionsFoundCount?: number;
        pushAttempted?: boolean;
        pushSentCount?: number;
        pushErrorExact?: string | null;
        sendErrors?: { error?: string }[];
      };
      console.log('[direct-push-debug] response status', res.status);
      console.log('[direct-push-debug] response body', data);
      if (data.logs && Array.isArray(data.logs)) {
        for (const line of data.logs) {
          console.log('[direct-push-debug]', line);
        }
      }
      if (data.sendErrors?.length) {
        for (const e of data.sendErrors) {
          console.error('[direct-push-debug] send error', e);
        }
      }
      const errText = data.pushErrorExact?.trim() || data.error?.trim() || '';
      const lines = [
        `teamSeasonId: ${data.teamSeasonId ?? teamSeasonId}`,
        `Eltern (User): ${data.parentUserCount ?? '—'}`,
        `Subscriptions: ${data.subscriptionsFoundCount ?? '—'}`,
        `Push versucht: ${data.pushAttempted ? 'ja' : 'nein'}`,
        `Gesendet: ${data.pushSentCount ?? '—'}`,
      ];
      if (errText) lines.push(`Fehler: ${errText}`);
      if (!res.ok) {
        alert(lines.join('\n'));
        return;
      }
      alert(lines.join('\n'));
    } catch (err) {
      console.error('[direct-push-debug] exception', err);
      alert(`Direkt-Push-Debug Fehler: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const runReminderTest = async () => {
    try {
      const res = await fetch('/api/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const raw = await res.text();
      console.log('REMINDER STATUS', res.status);
      console.log('REMINDER RAW RESPONSE', raw);

      let data: { error?: string; message?: string; raw?: string } | null = null;
      try {
        data = raw ? (JSON.parse(raw) as { error?: string; message?: string; raw?: string }) : null;
      } catch {
        data = { raw };
      }

      if (!res.ok) {
        alert(
          `Reminder Fehler: ${data?.error || data?.message || data?.raw || `HTTP ${res.status}`}`,
        );
        return;
      }

      alert(`Reminder erfolgreich: ${data?.message || 'OK'}`);
    } catch (err) {
      console.error(err);
      alert(`Reminder Fehler: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <PageShell
      background="more"
      className="page mehr-hub min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl"
    >
      <SectionTitle subtitle="Einstellungen und weitere Bereiche">Mehr</SectionTitle>

      <nav className="grid gap-2 md:grid-cols-2 lg:grid-cols-3" aria-label="Mehr-Menü">
        <HubRowLink to="/app/nachrichten" className={dsPanelRowClass()} isDemo={isDemo}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-400" aria-hidden />
              <span>Nachrichten</span>
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex min-h-[17px] min-w-[17px] translate-y-[-1px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-neutral-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            {isDemo ? (
              <span className="pl-8 text-[11px] font-normal text-white/40">Noch nicht Teil der Demo</span>
            ) : null}
          </span>
          <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
        </HubRowLink>

        {showSeasonManagement && (
          <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
            <button
              type="button"
              className={dsPanelRowClass()}
              onClick={() => setTeamAdminOpen((v) => !v)}
              aria-expanded={teamAdminOpen}
            >
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-red-400" aria-hidden />
                <span>Teamverwaltung</span>
              </span>
              <ChevronRight
                className={[
                  'h-5 w-5 text-white/40 transition-transform',
                  teamAdminOpen ? 'rotate-90' : '',
                ].join(' ')}
                aria-hidden
              />
            </button>
            {teamAdminOpen && (
              <PremiumCard variant="subtle" showAmbientGlow={false} className="!p-1.5">
                <HubRowLink to="/app/mehr/seasons" className={subRowClass} isDemo={isDemo}>
                  <span className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-red-400/90" aria-hidden />
                    Saisonverwaltung
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                </HubRowLink>
                {showParentAccessLink ? (
                  <HubRowLink to="/app/mehr/parent-access" className={subRowClass} isDemo={isDemo}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 shrink-0 text-red-400/90" aria-hidden />
                        Eltern &amp; Spielerzugänge
                      </span>
                      <span className="pl-6 text-[11px] font-normal leading-snug text-white/45">
                        Verknüpfungen, Push &amp; Spieler-App prüfen
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
                  </HubRowLink>
                ) : null}
              </PremiumCard>
            )}
          </div>
        )}

        {showTrainerTools && (
          <div className="space-y-1.5 pt-1 md:col-span-2 lg:col-span-3">
            <button
              type="button"
              className={dsPanelRowClass()}
              onClick={() => setTrainerToolsOpen((v) => !v)}
              aria-expanded={trainerToolsOpen}
            >
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-red-400" aria-hidden />
                <span>Trainer-Tools</span>
              </span>
              <ChevronRight
                className={[
                  'h-5 w-5 text-white/40 transition-transform',
                  trainerToolsOpen ? 'rotate-90' : '',
                ].join(' ')}
                aria-hidden
              />
            </button>

            {trainerToolsOpen && (
              <PremiumCard variant="subtle" showAmbientGlow={false} className="!p-1.5">
                <div className="flex flex-col gap-1.5">
                  <HubRowLink to="/app/mehr/trainer/team-push" className={subRowClass} isDemo={isDemo}>
                    <span>Team-Push</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </HubRowLink>
                  <HubRowLink to="/app/mehr/trainer/vorlagen" className={subRowClass} isDemo={isDemo}>
                    <span>Vorlagen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </HubRowLink>
                  {showDebugHubButtons && (
                    <button type="button" onClick={runParentsPushDebug} className={subRowClass}>
                      <span>Direkt-Push Debug</span>
                      <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                    </button>
                  )}
                  <HubRowLink to="/app/mehr/trainer/erinnerungen" className={subRowClass} isDemo={isDemo}>
                    <span>Erinnerungen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </HubRowLink>
                  {showManagerLink && (
                    <HubRowLink to="/manager" className={subRowClass} isDemo={isDemo}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span>Spielzeit Manager öffnen</span>
                        <span className="text-[11px] font-normal leading-snug text-white/45">
                          Bestehende Anmeldung bleibt erhalten
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
                    </HubRowLink>
                  )}
                  {showPreviewLink && (
                    <HubRowLink to="/app/mehr/trainer/preview" className={subRowClass} isDemo={isDemo}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span>Rollen-Vorschau (nur Plattformadmin)</span>
                        <span className="text-[11px] font-normal leading-snug text-white/45">
                          Ändert nur die Darstellung, nicht deine Berechtigungen.
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
                    </HubRowLink>
                  )}
                </div>
              </PremiumCard>
            )}
          </div>
        )}

        {(effectiveRole === 'parent' ||
          normalizeRole(effectiveRole) === 'parent' ||
          normalizeRole(sessionEffectiveRole) === 'parent') && (
          <HubRowLink
            to="/app/parent-onboarding?mode=link"
            className={dsPanelRowClass()}
            isDemo={isDemo}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-red-400" aria-hidden />
                <span>{hasLinkedChildren ? 'Weiteres Kind verknüpfen' : 'Kind verknüpfen'}</span>
              </span>
              <span className="pl-8 text-[11px] font-normal text-white/45">
                Aktive Saison und verfügbare Spieler
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
          </HubRowLink>
        )}

        <HubRowLink to="/app/profile" className={dsPanelRowClass()} isDemo={isDemo}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-red-400" aria-hidden />
              <span>Einstellungen</span>
            </span>
            {isDemo ? (
              <span className="pl-8 text-[11px] font-normal text-white/40">Noch nicht Teil der Demo</span>
            ) : null}
          </span>
          <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
        </HubRowLink>
      </nav>

      {isDemo ? <DemoHelpCard /> : null}

      <PremiumCard variant="subtle" showAmbientGlow={false}>
        <div className="flex items-center justify-between gap-3 text-[16px] font-semibold text-white">
          <span className="flex items-center gap-3">
            <span className="text-lg leading-none" aria-hidden>
              🔘
            </span>
            <span>Vibration bei Aktionen</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={hapticOn}
            className={dsGlassToggleTrack(hapticOn)}
            onClick={() => {
              const next = !hapticOn;
              setHapticEnabled(next);
              setHapticOn(next);
              if (next) triggerHaptic();
            }}
          >
            <span
              className={[
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out',
                hapticOn ? 'left-5' : 'left-0.5',
              ].join(' ')}
              aria-hidden
            />
          </button>
        </div>
      </PremiumCard>

      {canSwitchTeam && (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="mt-6 text-white">
          <SectionTitle as="h2" variant="subtle" className="!text-[16px] !font-semibold !text-white">
            Team / Saison
          </SectionTitle>
          <label className="mt-2 block text-[12px] text-white/60" htmlFor="mehr-team-switch">
            Anzeige / Historie (Archiv ändert die aktive Saison nicht)
          </label>
          <select
            id="mehr-team-switch"
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            value={viewTeamSeasonId ?? selectedTeamSeasonId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              if (!id) {
                setViewTeamSeasonId(null);
                return;
              }
              const ts = (teamSeasons ?? []).find((row) => row.id === id);
              if (!ts) return;
              const action = resolveTeamSeasonSwitcherAction(ts.status);
              if (action === 'select-work') {
                setSelectedTeamSeasonId(id);
                return;
              }
              setViewTeamSeasonId(id);
            }}
          >
            {(teamSeasons ?? []).map((ts) => (
              <option key={ts.id} value={ts.id}>
                {formatTeamSeasonCompactSwitcherLabel(
                  {
                    displayName: ts.display_name,
                    ageGroup: ts.age_group,
                    teamName: ts.team?.name,
                    seasonName: ts.season?.name,
                    status: ts.status,
                  },
                  {
                    markArchived: true,
                    markCurrent: ts.id === selectedTeamSeasonId,
                  },
                )}
              </option>
            ))}
          </select>
        </PremiumCard>
      )}

      {showDebugHubButtons && (
        <PremiumButton
          type="button"
          variant="subtle"
          fullWidth
          onClick={runReminderTest}
          className={cn(
            'mt-6 text-[16px] font-semibold',
            'shadow-[0_0_28px_rgba(255,40,40,0.12)] hover:shadow-[0_0_32px_rgba(255,40,40,0.16)]',
          )}
        >
          <span>🔔 Reminder testen</span>
        </PremiumButton>
      )}
    </PageShell>
  );
};
