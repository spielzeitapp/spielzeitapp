import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../DemoContext';
import { demoFixtures } from '../demoFixtures';
import { finishDemoTour, getDemoTourJourney, subscribeDemoTour } from '../demoTourState';
import { DEMO_SELF_PLAYER_ID } from '../demoPlayers';
import {
  buildDemoSessionParticipations,
  buildDemoStatsByPlayerId,
  computeDemoSquadParticipationPct,
  getDemoPastTrainingEvents,
} from '../demoTrainingStats';

/**
 * Station 14 — lokale U12-Saisonbilanz (Demo-Vorschau).
 * Kennzahlen klar getrennt: Session-Ø (~84 %), Saisonquote (~83 %), Noah 93 %.
 */
export function DemoTourSeasonPage(): React.ReactElement {
  const navigate = useNavigate();
  const demo = useDemoMode();
  const [, bump] = useState(0);
  React.useEffect(() => subscribeDemoTour(() => bump((n) => n + 1)), []);

  const journey = getDemoTourJourney();

  const metrics = useMemo(() => {
    const events = demo?.data.events ?? [];
    const attendance = demo?.attendanceRows ?? [];
    const playerIds = demoFixtures.players.map((p) => p.id);
    const past = getDemoPastTrainingEvents(events);
    const sessions = buildDemoSessionParticipations(past, playerIds, attendance);
    const sessionPct = computeDemoSquadParticipationPct(sessions);
    const byPlayer = buildDemoStatsByPlayerId(playerIds, past, attendance);
    const seasonRates = playerIds
      .map((id) => byPlayer.get(id)?.teamRatePct)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const seasonPct =
      seasonRates.length > 0
        ? Math.round(seasonRates.reduce((a, b) => a + b, 0) / seasonRates.length)
        : 83;
    return {
      sessionAvg: sessionPct != null ? Math.round(sessionPct) : 84,
      seasonAvg: seasonPct,
      trainingCount: past.length,
    };
  }, [demo?.data.events, demo?.attendanceRows]);

  const noah = demoFixtures.players.find((p) => p.id === DEMO_SELF_PLAYER_ID);

  const finish = () => {
    finishDemoTour();
    navigate('/demo/mehr');
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-1 pb-28 pt-2">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
          Demo-Vorschau · keine echte Saison
        </p>
        <h1 className="text-[20px] font-bold text-white">Saisonbilanz U12</h1>
        <p className="text-[13px] text-white/60">
          Am Saisonende erkennst du Beteiligung, Einsätze und Spielzeiten jedes Kindes auf einen Blick.
        </p>
      </header>

      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-[13px] font-semibold text-white">Mannschaft</h2>
        <p className="text-[12px] text-white/65">
          Gewertete Trainings:{' '}
          <span className="font-semibold text-white">{metrics.trainingCount}</span>
        </p>
        <p className="text-[12px] text-white/65">
          Ø Trainingsbeteiligung (Session):{' '}
          <span className="font-semibold text-white">ca. {metrics.sessionAvg} %</span>
        </p>
        <p className="text-[12px] text-white/65">
          Ø Trainingsquote (Saison):{' '}
          <span className="font-semibold text-white">ca. {metrics.seasonAvg} %</span>
        </p>
        <p className="text-[11px] leading-snug text-white/40">
          Session = Mittel der Dabei/(Dabei+Abwesend) je Training · Saison = Mittel der persönlichen
          Quoten.
        </p>
        {journey.localTraining || journey.localMatchReady ? (
          <p className="text-[12px] text-emerald-200/90">
            In dieser Demo: Training {journey.localTraining ? 'angelegt' : '—'} · Spiel{' '}
            {journey.localMatchReady ? 'vorbereitet' : '—'}
          </p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="text-[13px] font-semibold text-white">Spieler</h2>
        <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto">
          {demoFixtures.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/5 px-2.5 py-2 text-[12px]"
            >
              <span className="font-medium text-white">
                {p.firstName} {p.lastInitial}
                {p.id === DEMO_SELF_PLAYER_ID ? ' · Fokus' : ''}
              </span>
              <span className="tabular-nums text-white/70">{p.trainingPct} %</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-white/55">
          Noah ({noah?.firstName}): persönliche Trainingsquote{' '}
          <span className="font-semibold text-white">{noah?.trainingPct ?? 93} %</span>
        </p>
        <p className="text-[11px] text-white/40">
          Die vergangene Saison bleibt lesbar. Spieler und Trainer können anschließend in eine neue
          Saison übernommen werden (hier nur Vorschau).
        </p>
      </section>

      <button
        type="button"
        onClick={finish}
        className={`${dsPrimaryCtaClass()} inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[14px] font-semibold`}
      >
        Rundgang abschließen
      </button>
      <button
        type="button"
        onClick={() => navigate('/demo/home')}
        className={`${dsSecondaryCtaClass()} inline-flex min-h-[40px] w-full touch-manipulation items-center justify-center rounded-full px-4 text-[12px] font-semibold`}
      >
        Demo frei weiter testen
      </button>
    </div>
  );
}
