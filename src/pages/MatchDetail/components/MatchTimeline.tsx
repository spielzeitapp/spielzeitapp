import React from 'react';
import type { Match, MatchEvent } from '../../../types/match';

function sortEvents(match: Match): MatchEvent[] {
  return [...match.events].sort((a, b) => {
    const minuteA = a.minute ?? Number.POSITIVE_INFINITY;
    const minuteB = b.minute ?? Number.POSITIVE_INFINITY;
    if (minuteA !== minuteB) {
      return minuteA - minuteB;
    }
    const timeA = new Date(a.timestampISO).getTime();
    const timeB = new Date(b.timestampISO).getTime();
    return timeA - timeB;
  });
}

function eventLabel(type: MatchEvent['type']): string {
  switch (type) {
    case 'kickoff':
      return 'Anpfiff';
    case 'period_start':
      return 'Start Abschnitt';
    case 'period_end':
      return 'Pause';
    case 'final_whistle':
      return 'Abpfiff';
    case 'goal':
      return 'Tor';
    case 'sub':
      return 'Wechsel';
    case 'card':
      return 'Karte';
    case 'note':
    default:
      return 'Info';
  }
}

function playerNameById(match: Match, playerId?: string): string | undefined {
  if (!playerId) return undefined;
  const allPlayers = [...match.home.players, ...match.away.players];
  const player = allPlayers.find((p) => p.id === playerId);
  return player?.display_name ?? player?.name;
}

function cardTypeLabel(cardType?: MatchEvent['cardType']): string {
  switch (cardType) {
    case 'yellow':
      return 'Gelb';
    case 'red':
      return 'Rot';
    case 'blue':
      return 'Blau';
    default:
      return 'Karte';
  }
}

export const MatchTimeline: React.FC<{ match: Match }> = ({ match }) => {
  const events = sortEvents(match);

  if (events.length === 0) {
    return (
      <section>
        <h2 className="card-title mb-2">Timeline</h2>
        <p className="text-sm text-[var(--text-sub)]">Noch keine Ereignisse erfasst.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="card-title mb-2">Timeline</h2>
      <ul className="space-y-1 text-sm">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-center justify-between gap-2 text-[var(--text-main)]"
          >
            <span className="text-xs text-[var(--text-sub)] w-10">
              {event.minute != null ? `${event.minute}'.` : ''}
            </span>
            <span className="flex-1">
              <span className="font-semibold mr-1">
                {eventLabel(event.type)}
                {event.period ? ` ${event.period}` : ''}
              </span>
              <span>
                {(() => {
                  const baseNote = event.note ?? '';
                  if (event.type === 'goal') {
                    const name = playerNameById(match, event.playerId);
                    const isHomeGoal = event.teamId === match.home.id;
                    const isAwayGoal = event.teamId === match.away.id;
                    if (name) {
                      return baseNote
                        ? `Tor: ${name} – ${baseNote}`
                        : `Tor: ${name}`;
                    }
                    if (baseNote) return baseNote;
                    if (isHomeGoal) return 'Tor Heim';
                    if (isAwayGoal) return 'Tor Auswärts';
                    return 'Tor';
                  }
                  if (event.type === 'sub') {
                    const outName = playerNameById(match, event.playerOutId);
                    const inName = playerNameById(match, event.playerInId);
                    const change =
                      outName && inName
                        ? `${outName} → ${inName}`
                        : baseNote || 'Wechsel';
                    if (baseNote && outName && inName) {
                      return `${change} – ${baseNote}`;
                    }
                    return change;
                  }
                  if (event.type === 'card') {
                    const name = playerNameById(match, event.playerId);
                    const card = cardTypeLabel(event.cardType);
                    if (name) {
                      return baseNote
                        ? `${card}: ${name} – ${baseNote}`
                        : `${card}: ${name}`;
                    }
                    return baseNote || card;
                  }
                  // note / kickoff / period_start / period_end / final_whistle
                  return baseNote;
                })()}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

