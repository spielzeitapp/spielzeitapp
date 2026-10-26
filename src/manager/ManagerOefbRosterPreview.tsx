import React, { useEffect, useState } from 'react';

type Candidate = { externalPlayerId: string; name: string };
export function ManagerOefbRosterPreview({ seasonId }: { seasonId: string }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setUrl(''); setPlayers([]); setNotice(''); setError(''); }, [seasonId]);
  async function preview() {
    setBusy(true); setPlayers([]); setError(''); setNotice('');
    try {
      const response = await fetch('/api/oefb/roster?url=' + encodeURIComponent(url.trim()), { cache: 'no-store' });
      const result = await response.json() as { error?: string; players?: Candidate[]; notice?: string };
      if (!response.ok || result.error) throw Error(result.error || 'ÖFB-Kader konnte nicht geladen werden.');
      setPlayers(result.players || []);
      setNotice(result.notice || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler beim Laden'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
    <h2 className="text-lg font-semibold text-slate-900">ÖFB-Kaderseite prüfen</h2>
    <p className="text-sm text-slate-600">Zusätzliche ÖFB-Spieler-IDs aus öffentlichen Kaderprofilen suchen. Nur Vorschau – es werden keine Spieler erstellt oder verknüpft.</p>
    <label className="block text-sm font-medium text-slate-700">ÖFB-Kaderlink
      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://vereine.oefb.at/.../Kader/" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <button type="button" disabled={busy || !url.trim()} onClick={() => void preview()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'ÖFB-Kader wird geprüft…' : 'Kader-IDs prüfen'}</button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-slate-700">{notice}</p> : null}
    {players.length > 0 ? <div className="space-y-1"><p className="text-sm font-semibold">{players.length} ÖFB-Profile erkannt</p>
      <ul className="divide-y divide-slate-100">{players.map(p => <li key={p.externalPlayerId} className="flex justify-between gap-3 py-2 text-sm"><span>{p.name}</span><span className="font-mono text-slate-600">{p.externalPlayerId}</span></li>)}</ul>
    </div> : null}
  </section>;
}
