import React, { useState } from 'react';
import { adminUpdateTeamDetails, type ClubDetail } from '../lib/platformClubAdmin';
import { formatTeamSeasonContextLabel } from '../lib/seasonLifecycle';

type Season = ClubDetail['team_seasons'][number];
export function ManagerTeamDetailsEditor({ clubId, season, onSaved }: {
  clubId: string; season: Season; onSaved: () => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(season.team_name);
  const [age, setAge] = useState(season.age_group ?? '');
  const [year, setYear] = useState(season.season_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function open() {
    setName(season.team_name); setAge(season.age_group ?? '');
    setYear(season.season_name ?? ''); setError(null); setEditing(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const result = await adminUpdateTeamDetails({ clubId, teamSeasonId: season.id,
        name, ageGroup: age, seasonName: year, expectedName: season.team_name,
        expectedAgeGroup: season.age_group, expectedSeasonName: season.season_name });
      if (result.error) { setError(result.error); return; }
      await onSaved(); setEditing(false);
    } catch {
      setError('Speichern oder Neuladen fehlgeschlagen. Seite neu laden und den gespeicherten Stand prüfen.');
    } finally { setBusy(false); }
  }
  if (!editing) return <button type="button" onClick={open} className="font-semibold text-red-700 hover:underline">Mannschaft bearbeiten</button>;
  const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm';
  return <form onSubmit={save} className="my-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-4">
    <h3 className="font-semibold">Mannschaft bearbeiten</h3>
    <p className="mt-1 text-xs text-slate-600">Der Mannschaftsname gilt für alle Saisonen dieser Mannschaft. Altersklasse und Saison ändern nur diesen Eintrag. Kader, Spiele und Zuordnungen bleiben erhalten; Spieltermine werden nicht verschoben.</p>
    <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-medium">Mannschaftsname<input required maxLength={120} className={fieldClass} value={name} onChange={e=>setName(e.target.value)} /></label>
      <label className="text-sm font-medium">Altersklasse<input required maxLength={40} className={fieldClass} placeholder="U16 oder KM" value={age} onChange={e=>setAge(e.target.value)} /></label>
      <label className="text-sm font-medium">Saison<input required pattern="20[0-9]{2}/[0-9]{2}" className={fieldClass} placeholder="2026/27" value={year} onChange={e=>setYear(e.target.value)} /></label>
    </fieldset>
    <p className="mt-3 text-sm">Anzeige: <strong>{formatTeamSeasonContextLabel({teamName:name, ageGroup:age, seasonName:year})}</strong></p>
    <p className="mt-1 text-xs text-slate-600">Unterscheide mehrere Mannschaften im Namen, z. B. „SC Melk FR U16“ und „SC Melk FR KM“. Die Altersklasse erscheint in der Anzeige nur einmal.</p>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-3 flex gap-2">
      <button disabled={busy || !name.trim() || !age.trim() || !year.trim()} type="submit" className="min-h-11 rounded-full bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Speichert…' : 'Änderungen speichern'}</button>
      <button disabled={busy} type="button" onClick={()=>setEditing(false)} className="min-h-11 rounded-full border border-slate-300 px-4">Abbrechen</button>
    </div>
  </form>;
}
