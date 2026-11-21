import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useMarketManagerAccess } from '../features/marketManager/useMarketManagerAccess';
import { useManagerClubModules } from './ManagerClubModulesContext';
import { MarketTeamsSettings } from './MarketTeamsSettings';
import './managerMarketDesktop.css';

export function ManagerMarketPage() {
  const { user } = useAuth();
  const { clubId: contextClubId } = useManagerClubModules();
  const [params, setParams] = useSearchParams();
  const access = useMarketManagerAccess(user?.id);
  const clubs = access.clubs.filter(club => club.teams);
  const requestedClubId = params.get('club');
  const club = clubs.find(item => item.id === (requestedClubId ?? contextClubId))
    ?? (!requestedClubId && clubs.length === 1 ? clubs[0] : undefined);
  const unlisted = Boolean(requestedClubId && !club);

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Vereinsmarkt</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Mannschaftsauswahl für Eltern</h1>
          <p className="mt-2 text-sm text-slate-600">Wähle die Mannschaften für den Beitritt zum Vereinsmarkt und passe ihre Anzeigenamen an.</p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          to={club ? `/vereinsmarkt-manager/${club.id}?section=teams` : '/vereinsmarkt-manager'}
        >
          Zum Vereinsmarkt-Manager
        </Link>
      </header>
      {access.loading && <p role="status" className="text-sm text-slate-600">Vereine werden geladen …</p>}
      {access.error && <p role="alert" className="text-sm text-red-700">{access.error}</p>}
      {!access.loading && !access.error && <>
        {clubs.length > 0 && <label className="block w-full max-w-sm text-sm font-semibold text-slate-900">
          Verein
          <select
            className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            value={club?.id ?? ''}
            onChange={event => setParams(event.target.value ? { club: event.target.value } : {})}
          >
            <option value="">Verein auswählen</option>
            {clubs.map(item => <option key={item.id} value={item.id}>{item.sourceName ?? item.name}</option>)}
          </select>
        </label>}
        {unlisted ? <p role="alert" className="text-sm text-slate-600">Für diesen Verein fehlt dir die Freigabe zur Mannschaftsauswahl.</p>
          : club ? <MarketTeamsSettings key={club.id} clubId={club.id} desktop />
          : clubs.length === 0 ? <p className="text-sm text-slate-600">Für dein Konto ist keine Mannschaftsauswahl freigegeben.</p>
          : null}
      </>}
    </div>
  );
}
