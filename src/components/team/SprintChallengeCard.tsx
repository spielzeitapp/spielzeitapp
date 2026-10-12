import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Timer } from 'lucide-react';
import { PremiumCard } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
import { ChallengeAwardList } from './ChallengeAwardList';
import { ChallengeParticipantList } from './ChallengeParticipantList';
import { useSprintChallenge } from '../../hooks/useSprintChallenge';
import type { PlayerItem } from '../../hooks/usePlayers';
import { bestSprintTime, formatSprintTime, rankSprintResults, sprintProgress, sprintDevelopmentRanking, type SprintAttempts } from '../../lib/sprintChallenge';

type Props = { eventId?: string; disabled?: boolean; teamSeasonId?: string; players?: PlayerItem[] };
const EMPTY: SprintAttempts = [null, null, null];
export function SprintChallengeCard({ eventId, disabled = false, teamSeasonId, players = [] }: Props) {
  const showAwards = Boolean(teamSeasonId) && !disabled;
  const challenge = useSprintChallenge(teamSeasonId ?? null, showAwards, eventId ?? null);
  const test = challenge.tests.find(row => row.id === challenge.testId);
  const ranking = rankSprintResults(players.map(player => ({
    playerId: player.id, playerName: player.display_name, attempts: challenge.results[player.id] ?? EMPTY,
  })));
  const progress = test ? players.map(player => ({
    playerId: player.id, playerName: player.display_name,
    ...sprintProgress(challenge.history, {
      testId: test.id, playerId: player.id, date: test.start_date, createdAt: test.created_at,
      method: test.measurement_method, attempts: challenge.results[player.id] ?? EMPTY,
      participation: challenge.participation[player.id] ?? null,
    }),
  })) : [];
  const fastest = ranking[0];
  const absoluteRanking = sprintDevelopmentRanking(progress, 'seconds');
  const percentRanking = sprintDevelopmentRanking(progress, 'percent');
  const riser = absoluteRanking[0];
  const development = percentRanking[0];
  return <PremiumCard variant="subtle" showAmbientGlow={false} className="w-full min-w-0 sm:p-5">
    <div className="flex min-w-0 items-center gap-2"><Timer className="sz-club-accent-text h-5 w-5 shrink-0" aria-hidden /><h3 className="min-w-0 text-lg font-semibold tracking-tight text-white">Sprint-Challenge</h3></div>
    <p className="mt-1.5 text-xs leading-relaxed text-white/55">Torlinie → 16er · 16,5 m<br />3 Versuche · beste Zeit zählt</p>
    {showAwards ? <>
      {test ? <p className="mt-2 text-[11px] text-white/45">Letzter Test{test.start_date ? ' · ' + new Date(test.start_date + 'T12:00:00').toLocaleDateString('de-AT') : ''} · {test.measurement_method === 'light_gate' ? 'Lichtschranke' : test.measurement_method === 'hand' ? 'Handmessung' : 'Messart offen'}</p> : null}
      {challenge.error ? <p className="mt-3 text-xs text-amber-200" role="alert">Wertungen konnten nicht geladen werden.</p> : <ChallengeAwardList loading={challenge.loading} awards={[
        { emoji: '🏆', label: 'Schnellste Zeit', name: fastest?.playerName ?? null, value: fastest ? formatSprintTime(fastest.best) : null },
        { emoji: '🚀', label: 'Größte Verbesserung', name: riser?.playerName ?? null, value: riser ? formatSprintTime(riser.improvementMs) + ' schneller' : null },
        { emoji: '⭐', label: 'Beste Entwicklung', name: development?.playerName ?? null, value: development?.improvementPercent != null ? development.improvementPercent.toFixed(2).replace('.', ',') + ' %' : null },
      ]} />}
      {!challenge.loading && !challenge.error ? <ChallengeParticipantList rankings={[
        {id:'time',label:'Bestzeit',rows:ranking.map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:formatSprintTime(row.best),detail:row.attempts.filter(value => value != null).length + ' von 3 Versuchen'}))},
        {id:'seconds',label:'Verbesserung',rows:absoluteRanking.map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:formatSprintTime(row.improvementMs),detail:'Schneller als bei der letzten vergleichbaren Messung'}))},
        {id:'percent',label:'Entwicklung',rows:percentRanking.map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:(row.improvementPercent ?? 0).toFixed(2).replace('.',',') + ' %',detail:'Verbesserung zur letzten vergleichbaren Messung'}))},
      ]} participants={players.map(player => {
        const best = bestSprintTime(challenge.results[player.id] ?? EMPTY);
        const improvement = progress.find(row => row.playerId === player.id)?.improvementMs;
        return {id:player.id,name:player.display_name,detail:best == null
          ? challenge.participation[player.id] === 'absent' ? 'Nicht dabei · Keine Messwerte' : 'Noch keine Messwerte'
          : formatSprintTime(best) + (improvement == null ? ' · Noch keine vergleichbare frühere Messung' : ' · Keine positive Verbesserung')};
      })} /> : null}
    </> : null}
    {disabled ? <p className="mt-3 text-xs text-white/50">In der Demo und im Archiv nicht bearbeitbar.</p> : <Link to={'/app/team/sprint-challenge' + (eventId ? '?event=' + encodeURIComponent(eventId) : '')} className={dsPanelRowClass() + ' mt-3 flex min-h-11 items-center justify-between gap-3'}>
      <span className="min-w-0 break-words text-sm font-semibold text-white">Sprint-Challenge öffnen</span><ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
    </Link>}
  </PremiumCard>;
}
