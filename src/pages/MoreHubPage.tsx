import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Settings, Wrench } from 'lucide-react';
import { Card } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { supabase } from '../lib/supabaseClient';
import { isHapticEnabled, setHapticEnabled, triggerHaptic } from '../lib/hapticFeedback';
import {
  dsGlassToggleTrack,
  dsMoreHubPageStyle,
  dsPageAtmosphereClass,
  dsPageContentClass,
  dsPanelRowClass,
} from '../lib/premiumDesignSystem';

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
  // Erweiterbar: z. B. import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG_HUB_BUTTONS === 'true'
  return false;
}

export const MoreHubPage: React.FC = () => {
  const {
    selectedTeamSeason,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    teamSeasons,
    effectiveRole,
    backendRole,
    user,
  } = useSession();
  const canSwitchTeam =
    (teamSeasons?.length ?? 0) > 1 &&
    (effectiveRole === 'trainer' || effectiveRole === 'head_coach' || effectiveRole === 'co_trainer');

  const showTrainerTools = isTrainerToolsRole(effectiveRole);
  const showPreviewLink = backendRole === 'admin' || backendRole === 'head_coach';
  const showDebugHubButtons = showMehrHubDebugButtons(backendRole, effectiveRole);
  const unreadCount = useUnreadCount(user?.id);

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
    <div
      className="page mehr-hub relative min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-6 sm:px-4 md:px-0"
      style={dsMoreHubPageStyle()}
    >
      <div className={dsPageAtmosphereClass()} aria-hidden />
      <div className={dsPageContentClass('mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl')}>
        <h1 className="text-2xl font-bold tracking-tight text-white">Mehr</h1>
        <p className="text-[14px] text-white/60">Einstellungen und weitere Bereiche</p>

        <div className={dsPanelRowClass()}>
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

        <nav className="grid gap-2 md:grid-cols-2 lg:grid-cols-3" aria-label="Mehr-Menü">
          <Link to="/app/nachrichten" className={dsPanelRowClass()}>
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
          </Link>

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
                <>
                  <Link to="/app/mehr/trainer/team-push" className={subRowClass}>
                    <span>Team-Push</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  <Link to="/app/mehr/trainer/vorlagen" className={subRowClass}>
                    <span>Vorlagen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  {showDebugHubButtons && (
                    <button type="button" onClick={runParentsPushDebug} className={subRowClass}>
                      <span>Direkt-Push Debug</span>
                      <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                    </button>
                  )}
                  <Link to="/app/mehr/trainer/erinnerungen" className={subRowClass}>
                    <span>Erinnerungen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  {showPreviewLink && (
                    <Link to="/app/mehr/trainer/preview" className={subRowClass}>
                      <span>Ansicht testen als</span>
                      <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                    </Link>
                  )}
                </>
              )}
            </div>
          )}

          <Link to="/app/profile" className={dsPanelRowClass()}>
            <span className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-red-400" aria-hidden />
              <span>Einstellungen</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
          </Link>
        </nav>

        {canSwitchTeam && (
          <Card className="mt-6 border-white/10 bg-white/5 p-4 text-white">
            <h2 className="text-[16px] font-semibold text-white">Team / Saison</h2>
            <label className="mt-2 block text-[12px] text-white/60" htmlFor="mehr-team-switch">
              Aktive Auswahl
            </label>
            <select
              id="mehr-team-switch"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={selectedTeamSeason?.id ?? ''}
              onChange={(e) => setSelectedTeamSeasonId(e.target.value)}
            >
              {(teamSeasons ?? []).map((ts) => (
                <option key={ts.id} value={ts.id}>
                  {ts.team?.name ?? 'Team'} · {ts.season?.name ?? 'Saison'}
                </option>
              ))}
            </select>
          </Card>
        )}

        {showDebugHubButtons && (
          <button
            type="button"
            onClick={runReminderTest}
            className={`${dsPanelRowClass()} mt-6 shadow-[0_0_28px_rgba(255,40,40,0.12)] hover:shadow-[0_0_32px_rgba(255,40,40,0.16)]`}
          >
            <span>🔔 Reminder testen</span>
          </button>
        )}
      </div>
    </div>
  );
};
