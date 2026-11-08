import React, { useState } from "react";
import { useOefbLiveReport } from "../../components/match/OefbLiveReport";
import {
  finishedOefbFallback,
  OefbFinishedMatchSection,
} from "../../components/match/OefbFinishedMatchSection";
export function UscMatchReport({
  matchId,
  score,
  finished,
}: {
  matchId: string;
  score: string | null;
  finished: boolean;
}) {
  const [view, setView] = useState<"timeline" | "lineup" | "stats">("timeline");
  const source = useOefbLiveReport(matchId, finished);
  const verified = finishedOefbFallback(
    source,
    score,
    { lineup: false, events: false },
    finished,
  ).source;
  if (!finished) return null;
  return (
    <section className="usc-report">
      <h2>Spielbericht</h2>
      <div className="usc-tabs">
        {(["timeline", "lineup", "stats"] as const).map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {
              {
                timeline: "Spielverlauf",
                lineup: "Aufstellung",
                stats: "Spielminuten",
              }[key]
            }
          </button>
        ))}
      </div>
      <OefbFinishedMatchSection
        source={verified}
        view={view}
        matchId={matchId}
        players={[]}
      />
      {!verified.loading && !verified.error && !verified.report ? (
        <p>Für dieses Spiel ist noch kein ÖFB-Spielbericht verfügbar.</p>
      ) : null}
    </section>
  );
}
