import { useEffect, useState } from 'react';
import type { RosterPlayer } from '../../lib/rosterService';
import { usePlayers } from '../../hooks/usePlayers';
import { fetchKickoffLineupPlayerIds, fetchLineupForLiveMatch, fetchMatchById, fetchMatchEvents } from '../../lib/liveMatchService';
import { isOurTournamentScheduleSlot, type TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { sumTournamentPlaytime, tournamentMatchPlaytime } from '../../lib/tournamentPlaytime';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

async function loadMatchPlaytime(matchId: string) {
  const [match, kickoff, events, lineup] = await Promise.all([
    fetchMatchById(matchId),
    fetchKickoffLineupPlayerIds(matchId),
    fetchMatchEvents(matchId),
    fetchLineupForLiveMatch(matchId),
  ]);
  if (match.error || events.error || lineup.error) throw new Error('Einsatzzeiten konnten nicht geladen werden.');
  if (match.data?.status !== 'finished' || !kickoff) return null;

  return tournamentMatchPlaytime({
    kickoffPlayerIds: kickoff,
    squadPlayerIds: lineup.data.squadPlayerIds,
    events: events.data,
    elapsedSeconds: match.data.live_elapsed_seconds,
  });
}

type Props = {
  slots: TournamentMatchSlotView[];
  players: RosterPlayer[];
  teamSeasonId: string | null;
  loading: boolean;
};

export function TournamentPlaytimeStats({ slots, players, teamSeasonId, loading }: Props) {
  const { players: seasonPlayers } = usePlayers(teamSeasonId, { mode: 'all' });
  const finishedSlots = slots.filter((slot) => isOurTournamentScheduleSlot(slot) && (
    slot.match_status === 'finished' || (slot.match_status !== 'live' && slot.official_status === 'finished')
  ));
  const ids = [...new Set(finishedSlots.flatMap((slot) => slot.match_id ? [slot.match_id] : []))].sort();
  const scope = ids.join(',');
  const finishedCount = ids.length + finishedSlots.filter((slot) => !slot.match_id).length;
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    scope: string;
    reload: number;
    matches: Record<string, number>[];
    failed: number;
  } | null>(null);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    void Promise.allSettled(scope.split(',').map(loadMatchPlaytime)).then((outcomes) => {
      if (cancelled) return;
      setResult({
        scope,
        reload,
        matches: outcomes.flatMap((outcome) => outcome.status === 'fulfilled' && outcome.value ? [outcome.value] : []),
        failed: outcomes.filter((outcome) => outcome.status === 'rejected').length,
      });
    });
    return () => { cancelled = true; };
  }, [scope, reload]);

  const current = result?.scope === scope && result.reload === reload ? result : null;
  const names = new Map([...seasonPlayers, ...players].map((player) => [player.id, player.display_name]));
  const rows = sumTournamentPlaytime(current?.matches ?? [])
    .map((row) => ({ ...row, name: names.get(row.playerId) || 'Unbekannter Spieler' }))
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name, 'de-AT'));

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <h2 className={TC_SECTION_LABEL}>Einsatzzeit im Turnier</h2>
        {loading || (scope && !current) ? (
          <p className="mt-2 text-white/65" role="status">Lade Einsatzzeiten…</p>
        ) : finishedCount === 0 ? (
          <p className="mt-2 text-white/65">Es gibt noch keine abgeschlossenen Spiele deiner Mannschaft.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-white/65">
              Spielzeit aus {current?.matches.length ?? 0} von {finishedCount} abgeschlossenen Spielen.
            </p>
            {current && current.failed > 0 && (
              <button type="button" className="mt-2 min-h-11 text-sm font-semibold underline" onClick={() => setReload((n) => n + 1)}>
                Einsatzzeiten erneut laden
              </button>
            )}
            {rows.length ? (
              <table className="mt-4 w-full table-auto text-left leading-tight">
                <thead className="text-sm text-white/70">
                  <tr>
                    <th scope="col" className="pb-2 pr-2">Spieler</th>
                    <th scope="col" className="pb-2 text-right">Min:Sek</th>
                    <th scope="col" className="pb-2 pl-3 text-right">Einsätze</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ playerId, name, seconds, appearances }) => (
                    <tr key={playerId} className="border-t border-white/10">
                      <th scope="row" className="py-3 pr-2 font-semibold">{name}</th>
                      <td className="whitespace-nowrap py-3 text-right font-bold tabular-nums">
                        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                      </td>
                      <td className="py-3 pl-3 text-right tabular-nums">{appearances}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-white/65">Für diese Spiele sind noch keine auswertbaren Einsatzzeiten erfasst.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
