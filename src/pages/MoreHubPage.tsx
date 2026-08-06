import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarRange, ChevronRight, Settings, Smartphone, Users, Wrench } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { supabase } from '../lib/supabaseClient';
import { isHapticEnabled, setHapticEnabled, triggerHaptic } from '../lib/hapticFeedback';
import { canPrepareNextSeason, formatTeamSeasonCompactSwitcherLabel, isSeasonArchived, isSeasonActive, isSeasonDraft } from '../lib/seasonLifecycle';
import { canViewParentLinks, normalizeRole } from '../lib/roles';
import { dsGlassToggleTrack, dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { useDemoMode } from '../demo/DemoContext';

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

/** App-Pfad → Demo-Pfad oder null (dann UI-disabled, kein echter App-Zugriff). */
function demoHrefFor(appPath: string): string | null {
  const map: Record<string, string> = {
    '/app/nachrichten': '/demo/mehr',
    '/app/profile': '/demo/mehr',
    '/app/mehr/seasons': '/demo/team',
    '/app/mehr/parent-access': '/demo/team',
    '/app/mehr/trainer/team-push': '/demo/live',
    '/app/mehr/trainer/vorlagen': '/demo/team?tab=training',
    '/app/mehr/trainer/erinnerungen': '/demo/termine',
    '/app/mehr/trainer/preview': '/demo/home',
  };
  return map[appPath] ?? null;
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
    <button
      type="button"
      className={`${className} opacity-70`}
      title="In der Demo nicht verfügbar"
      onClick={() => {
        window.alert('Dieser Bereich ist in der Trainer-Demo noch nicht freigeschaltet.');
      }}
    >
      {children}
    </button>
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
    user,
  } = useSession();
  const effectiveRole = isDemo ? 'trainer' : sessionEffectiveRole;
  const backendRole = isDemo ? 'trainer' : sessionBackendRole;
  const canSwitchTeam =
    !isDemo &&
    (teamSeasons?.length ?? 0) > 1 &&
    (effectiveRole === 'trainer' || effectiveRole === 'head_coach' || effectiveRole === 'co_trainer');

  const showTrainerTools = isTrainerToolsRole(effectiveRole);
  const showSeasonManagement =
    backendRole === 'admin' ||
    canPrepareNextSeason(effectiveRole) ||
    canPrepareNextSeason(backendRole) ||
    isTrainerToolsRole(effectiveRole);
  const showPreviewLink = !isDemo && (backendRole === 'admin' || backendRole === 'head_coach');
  const showParentAccessLink = canViewParentLinks(normalizeRole(effectiveRole));
  /** Push-/Reminder-Debug in der Demo immer aus — keine echten Writes/Pushes. */
  const showDebugHubButtons = !isDemo && showMehrHubDebugButtons(backendRole, effectiveRole);
  const unreadCountRaw = useUnreadCount(user?.id);
  const unreadCount = isDemo ? 0 : unreadCountRaw;

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
          <span className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-red-400" aria-hidden />
            <span>Nachrichten</span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex min-h-[17px] min-w-[17px] translate-y-[-1px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-neutral-900">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
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
                  {showPreviewLink && (
                    <HubRowLink to="/app/mehr/trainer/preview" className={subRowClass} isDemo={isDemo}>
                      <span>Ansicht testen als</span>
                      <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                    </HubRowLink>
                  )}
                </div>
              </PremiumCard>
            )}
          </div>
        )}

        <HubRowLink to="/app/profile" className={dsPanelRowClass()} isDemo={isDemo}>
          <span className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-red-400" aria-hidden />
            <span>Einstellungen</span>
          </span>
          <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
        </HubRowLink>
      </nav>

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
              if (isSeasonArchived(ts.status)) {
                setViewTeamSeasonId(id);
                return;
              }
              if (isSeasonActive(ts.status) || isSeasonDraft(ts.status)) {
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
