import { Check, RotateCcw, X } from 'lucide-react';
import type { Shootout, ShootoutAttempt } from '../../../server/lib/tournamentMatchDecision.js';

interface TournamentShootoutProps {
  shootout: Shootout;
  home: string;
  away: string;
  finished?: boolean;
  controls?: {
    busy: boolean;
    record: (attempt: ShootoutAttempt) => void;
    undo: () => void;
    finish: () => void;
  };
}

export function TournamentShootout({ shootout, home, away, finished, controls }: TournamentShootoutProps) {
  const teams = [['home', home], ['away', away]] as const;

  return (
    <section aria-label="Elfmeterschießen" className="space-y-3 rounded-xl border border-current/15 p-3">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-bold">{finished ? 'Nach Elfmeterschießen' : 'Elfmeterschießen läuft'}</h3>
        <strong aria-live="polite" className="text-xl tabular-nums">{shootout.home}:{shootout.away}</strong>
      </header>
      {teams.map(([side, name]) => {
        const attempts = shootout.attempts.filter(attempt => attempt.side === side);
        return (
          <div key={side} className="space-y-2 border-t border-current/15 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="min-w-0 break-words text-sm font-semibold">{name}</p>
              {attempts.length > 0 ? (
                <ol aria-label={`Schüsse von ${name}`} className="flex flex-wrap gap-1">
                  {attempts.map(({ outcome }, index) => {
                    const goal = outcome === 'goal';
                    const label = `Schuss ${index + 1}: ${goal ? 'Treffer' : 'Fehlschuss'}`;
                    const Icon = goal ? Check : X;
                    return (
                      <li key={index} title={label}
                        className={`grid h-6 w-6 place-items-center rounded-full text-white ${goal ? 'bg-emerald-700' : 'bg-red-700'}`}>
                        <span className="sr-only">{label}</span>
                        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>
            {controls ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={controls.busy} aria-label={`Treffer für ${name} erfassen`}
                  className="min-h-11 rounded-lg bg-emerald-700 px-2 text-sm font-bold text-white disabled:opacity-40"
                  onClick={() => controls.record({ side, outcome: 'goal' })}>
                  <Check aria-hidden="true" className="mr-1 inline h-4 w-4" /> Treffer
                </button>
                <button type="button" disabled={controls.busy} aria-label={`Fehlschuss für ${name} erfassen`}
                  className="min-h-11 rounded-lg bg-red-700 px-2 text-sm font-bold text-white disabled:opacity-40"
                  onClick={() => controls.record({ side, outcome: 'miss' })}>
                  <X aria-hidden="true" className="mr-1 inline h-4 w-4" /> Fehlschuss
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {controls ? (
        <div className="grid gap-2 border-t border-current/15 pt-2 sm:grid-cols-2">
          <button type="button" disabled={controls.busy || !shootout.attempts.length}
            className="min-h-11 rounded-lg border border-current/25 px-2 text-sm font-semibold disabled:opacity-40"
            onClick={controls.undo}>
            <RotateCcw aria-hidden="true" className="mr-1 inline h-4 w-4" /> Letzten Schuss zurück
          </button>
          <button type="button" disabled={controls.busy || shootout.home === shootout.away}
            className="min-h-11 rounded-lg bg-red-700 px-2 text-sm font-bold text-white disabled:opacity-40"
            onClick={controls.finish}>
            Schießen beenden
          </button>
        </div>
      ) : null}
    </section>
  );
}
