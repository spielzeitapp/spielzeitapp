import { useRef, useState } from 'react';
import { tournamentLivestreamUrl, TOURNAMENT_LIVESTREAM_POST } from '../../../server/lib/tournamentLivestream.js';
import { publicTeamTournamentPath } from '../../lib/publicTeamTournament';
import { supabase } from '../../lib/supabaseClient';
import { AppButton } from '../ui/AppButton';
import { TournamentPlanQrScannerSheet } from './TournamentPlanQrScannerSheet';

export function TournamentLivestreamShare({ eventId, teamSeasonId }: { eventId: string; teamSeasonId: string }) {
  const [draft, setDraft] = useState('');
  const [scanner, setScanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const publishing = useRef(false);
  const title = 'Jetzt Livestream ansehen';
  const message = 'Unsere Spiele beim Turnier im Livestream verfolgen.';

  async function share(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishing.current) return;
    const url = tournamentLivestreamUrl(draft);
    if (!url) {
      setFeedback('Bitte einen gültigen HTTPS-Link zum Livestream eingeben.');
      return;
    }
    publishing.current = true;
    setBusy(true);
    setFeedback('');
    let published = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Bitte erneut anmelden.');
      const { data: season, error: seasonError } = await supabase.from('team_seasons')
        .select('team_id').eq('id', teamSeasonId).single();
      if (seasonError || !season?.team_id) throw new Error('Die Mannschaft konnte nicht geladen werden.');
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
      const urlKey = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase.from('team_feed_posts').insert({
        event_id: eventId,
        team_id: season.team_id,
        team_season_id: teamSeasonId,
        post_kind: TOURNAMENT_LIVESTREAM_POST,
        caption: message,
        payload: {},
        dedupe_key: `${TOURNAMENT_LIVESTREAM_POST}:${eventId}:${urlKey}`,
        created_by: session.user.id,
        cta_url: url,
        cta_label: 'Livestream ansehen',
      });
      if (error?.code === '23505') {
        setFeedback('Dieser Livestream wurde für das Turnier bereits geteilt.');
        return;
      }
      if (error) throw new Error(error.message);
      published = true;
      const response = await fetch('/api/push/send-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          team_season_id: teamSeasonId,
          recipient_group: 'parents',
          related_event_id: eventId,
          title,
          body: message,
          url: `${publicTeamTournamentPath(eventId)}#livestream`,
        }),
      });
      const push = await response.json();
      if (!response.ok || !push.ok) throw new Error('Benachrichtigung konnte nicht gesendet werden.');
      setFeedback(push.skipped
        ? 'Livestream auf der Turnierseite und in News veröffentlicht. Der Push-Versand ist in TEST deaktiviert.'
        : `Livestream veröffentlicht. Push an ${push.sent ?? 0} Geräte gesendet.${push.failed ? ` ${push.failed} Versandversuch(e) fehlgeschlagen.` : ''}`);
    } catch (error) {
      setFeedback(published
        ? 'Livestream veröffentlicht. Der Eltern-Push konnte nicht bestätigt werden.'
        : error instanceof Error ? error.message : 'Der Livestream konnte nicht veröffentlicht werden.');
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={share} className="space-y-3 rounded-2xl border border-white/15 p-4">
      <h3 className="text-lg font-bold">Livestream</h3>
      <label className="block space-y-1">
        <span>Öffentlicher Livestream-Link</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://…"
          inputMode="url" disabled={busy} className="w-full rounded-xl border border-white/20 bg-black/20 p-3" />
      </label>
      <p className="text-sm text-white/70">Beim Teilen erscheint der Link auf der öffentlichen Turnierseite und in News. Eltern mit aktiviertem Push erhalten eine Benachrichtigung.</p>
      <div className="flex flex-wrap gap-2">
        <AppButton type="button" variant="secondary" disabled={busy} onClick={() => setScanner(true)}>QR scannen</AppButton>
        <AppButton type="submit" variant="primary" disabled={busy || !draft.trim()}>{busy ? 'Wird geteilt…' : 'Livestream teilen'}</AppButton>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      <TournamentPlanQrScannerSheet isOpen={scanner} onClose={() => setScanner(false)}
        validateLink={tournamentLivestreamUrl} invalidLinkMessage="Der QR-Code enthält keinen gültigen HTTPS-Link."
        onEnterLink={() => setScanner(false)} onScanSuccess={(url) => { setDraft(url); setScanner(false); }} />
    </form>
  );
}
