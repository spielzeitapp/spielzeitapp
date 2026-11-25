import { useRef, useState } from 'react';
import { tournamentLivestreamUrl, TOURNAMENT_LIVESTREAM_POST, TOURNAMENT_RECORDING_POST } from '../../../server/lib/tournamentLivestream.js';
import { publicTeamTournamentPath } from '../../lib/publicTeamTournamentPath';
import { supabase } from '../../lib/supabaseClient';
import { AppButton } from '../ui/AppButton';
import { TournamentPlanQrScannerSheet } from './TournamentPlanQrScannerSheet';

export function TournamentLivestreamShare({ eventId, teamSeasonId, recording }: {
  eventId: string;
  teamSeasonId: string;
  recording: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [scanner, setScanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const publishing = useRef(false);
  const title = 'Jetzt Livestream ansehen';
  const postKind = recording ? TOURNAMENT_RECORDING_POST : TOURNAMENT_LIVESTREAM_POST;
  const action = recording ? 'Aufzeichnung speichern' : 'Livestream teilen';
  const ctaLabel = recording ? 'Aufzeichnung ansehen' : 'Livestream ansehen';
  const failureMessage = recording ? 'Die Aufzeichnung konnte nicht gespeichert werden.' : 'Der Livestream konnte nicht veröffentlicht werden.';
  const message = recording
    ? 'Aufzeichnung des Turniers ansehen.'
    : 'Unsere Spiele beim Turnier im Livestream verfolgen.';

  async function share(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishing.current) return;
    const url = tournamentLivestreamUrl(draft);
    if (!url) {
      setFeedback('Bitte einen gültigen HTTPS-Link eingeben.');
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
      let version;
      if (recording) {
        version = crypto.randomUUID();
      } else {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
        version = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
      }
      const { error } = await supabase.from('team_feed_posts').insert({
        event_id: eventId,
        team_id: season.team_id,
        team_season_id: teamSeasonId,
        post_kind: postKind,
        caption: message,
        payload: {},
        dedupe_key: `${postKind}:${eventId}:${version}`,
        created_by: session.user.id,
        cta_url: url,
        cta_label: ctaLabel,
      });
      if (!recording && error?.code === '23505') {
        setFeedback('Dieser Livestream wurde für das Turnier bereits geteilt.');
        return;
      }
      if (error) throw new Error(error.message);
      if (recording) {
        setFeedback('Aufzeichnung auf der Turnierseite gespeichert.');
        return;
      }
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
        : error instanceof Error ? error.message : failureMessage);
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={share} className="space-y-3 rounded-2xl border border-white/15 p-4">
      <h3 className="text-lg font-bold">{recording ? 'Turnieraufzeichnung' : 'Livestream'}</h3>
      <label className="block space-y-1">
        <span>{recording ? 'Öffentlicher Link zur Aufzeichnung' : 'Öffentlicher Livestream-Link'}</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://…"
          inputMode="url" disabled={busy} className="w-full rounded-xl border border-white/20 bg-black/20 p-3" />
      </label>
      <p className="text-sm text-white/70">{recording
        ? 'Die Aufzeichnung erscheint auf der öffentlichen Turnierseite. Ein weiterer Link ersetzt die bisherige Aufzeichnung.'
        : 'Scanne den QR-Code des Anbieters oder füge den Stream-Link ein. Beim Teilen erscheint der Livestream auf der öffentlichen Turnierseite und in News. Eltern mit aktiviertem Push erhalten eine Benachrichtigung.'}</p>
      <div className="flex flex-wrap gap-2">
        <AppButton type="button" variant="secondary" disabled={busy} onClick={() => setScanner(true)}>QR scannen</AppButton>
        <AppButton type="submit" variant="primary" disabled={busy || !draft.trim()}>{busy ? (recording ? 'Wird gespeichert…' : 'Wird geteilt…') : action}</AppButton>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      <TournamentPlanQrScannerSheet isOpen={scanner} onClose={() => setScanner(false)}
        validateLink={tournamentLivestreamUrl} invalidLinkMessage="Der QR-Code enthält keinen gültigen HTTPS-Link."
        onEnterLink={() => setScanner(false)} onScanSuccess={(url) => { setDraft(url); setScanner(false); }} />
    </form>
  );
}
