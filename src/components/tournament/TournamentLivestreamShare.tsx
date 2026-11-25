import { useEffect, useRef, useState } from 'react';
import { tournamentLivestreamUrl, TOURNAMENT_LIVESTREAM_POST, TOURNAMENT_RECORDING_POST } from '../../../server/lib/tournamentLivestream.js';
import { publicTeamTournamentPath } from '../../lib/publicTeamTournamentPath';
import { supabase } from '../../lib/supabaseClient';
import { uploadTeamFeedImage } from '../../lib/updateEventPosterFeedPost';
import type { TournamentParticipant } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';
import { TournamentPlanQrScannerSheet } from './TournamentPlanQrScannerSheet';

export function TournamentLivestreamShare({ eventId, teamSeasonId, recording, participants = [], coverUrl }: {
  eventId: string;
  teamSeasonId: string;
  recording: boolean;
  participants?: TournamentParticipant[];
  coverUrl?: string | null;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [draft, setDraft] = useState('');
  const [scanner, setScanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanningPhoto, setScanningPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoScan = useRef<AbortController | null>(null);
  const pending = busy || scanningPhoto;
  useEffect(() => () => photoScan.current?.abort(), []);
  const [feedback, setFeedback] = useState('');
  const publishing = useRef(false);
  const title = 'Jetzt Livestream ansehen';
  const postKind = recording ? TOURNAMENT_RECORDING_POST : TOURNAMENT_LIVESTREAM_POST;
  const action = recording ? 'Aufzeichnung speichern' : 'Livestream teilen';
  const ctaLabel = recording ? 'Aufzeichnung ansehen' : 'Zur Turnierseite';
  const failureMessage = recording ? 'Die Aufzeichnung konnte nicht gespeichert werden.' : 'Der Livestream konnte nicht veröffentlicht werden.';
  const message = recording
    ? 'Aufzeichnung des Turniers ansehen.'
    : 'Unsere Spiele beim Turnier im Livestream verfolgen.';

  async function scanPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || photoScan.current || publishing.current) return;
    const scan = new AbortController();
    photoScan.current = scan;
    setScanningPhoto(true);
    setFeedback('Linktext wird erkannt …');
    let timeout: number | undefined;
    try {
      const { scanTournamentLivestreamPhoto } = await import('../../lib/tournamentLivestreamPhotoOcr');
      const links = await Promise.race([
        scanTournamentLivestreamPhoto(file, scan.signal),
        new Promise<never>((_, reject) => {
          timeout = window.setTimeout(() => reject(new Error('Texterkennung dauert zu lange.')), 25_000);
        }),
      ]);
      if (scan.signal.aborted) return;
      if (links.length === 1) {
        setDraft(links[0]);
        setFeedback('Link übernommen. Bitte prüfe ihn vor dem Teilen.');
      } else {
        setFeedback(links.length > 1
          ? 'Mehrere Links erkannt. Fotografiere nur die gewünschte Adresse.'
          : 'Kein vollständiger Link erkannt. Fotografiere die Adresse möglichst nah und scharf.');
      }
    } catch {
      if (!scan.signal.aborted) setFeedback('Linktext konnte nicht gelesen werden. Versuche es erneut oder füge den Link ein.');
    } finally {
      window.clearTimeout(timeout);
      if (!scan.signal.aborted) setScanningPhoto(false);
      scan.abort();
      photoScan.current = null;
    }
  }

  async function share(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishing.current || photoScan.current) return;
    const url = tournamentLivestreamUrl(draft);
    if (!url) {
      setFeedback('Bitte einen gültigen HTTPS-Link eingeben.');
      return;
    }
    publishing.current = true;
    setBusy(true);
    setFeedback('');
    let published = false;
    let uploadedImagePath: string | null = null;
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
      if (!recording && image) {
        const uploaded = await uploadTeamFeedImage(teamSeasonId, image);
        if (!uploaded.path) throw new Error(uploaded.error ?? 'Das Bild konnte nicht hochgeladen werden.');
        uploadedImagePath = uploaded.path;
      }
      const cover = recording ? null : uploadedImagePath ?? coverUrl ?? null;
      const { error } = await supabase.from('team_feed_posts').insert({
        event_id: eventId,
        team_id: season.team_id,
        team_season_id: teamSeasonId,
        post_kind: postKind,
        caption: message,
        payload: recording ? {} : {
          participants: participants.map(({ team_name, logo_url }) => ({ name: team_name, logoUrl: logo_url ?? null })),
        },
        media_type: cover ? 'image' : null,
        media_url: cover,
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
      if (uploadedImagePath && !published) {
        await supabase.storage.from('team-feed').remove([uploadedImagePath]).catch(() => {});
      }
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
          inputMode="url" disabled={pending} className="w-full rounded-xl border border-white/20 bg-black/20 p-3" />
      </label>
      <div className="flex flex-wrap gap-2">
        <AppButton type="button" variant="secondary" disabled={pending}
          onClick={() => { setFeedback(''); setScanner(true); }}>QR-Code scannen</AppButton>
        <AppButton type="button" variant="secondary" disabled={pending}
          onClick={() => photoInput.current?.click()}>Linktext scannen</AppButton>
        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden
          aria-label="Linktext fotografieren" onChange={scanPhoto} />
      </div>
      <p className="text-sm text-white/70">{recording
        ? 'Die Aufzeichnung erscheint auf der öffentlichen Turnierseite. Ein weiterer Link ersetzt die bisherige Aufzeichnung.'
        : 'Scanne den QR-Code, fotografiere die ausgeschriebene Adresse oder füge den Link ein. Beim Teilen erscheint der Livestream auf der öffentlichen Turnierseite und in News. Eltern mit aktiviertem Push erhalten eine Benachrichtigung.'}</p>
      {!recording ? (
        <label className="block space-y-1 text-sm">
          <span>{coverUrl ? 'Anderes Titelbild wählen' : 'Titelbild hinzufügen'} (optional)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending}
            onChange={event => setImage(event.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-white/20 p-2" />
          {participants.length > 0 ? <span className="block text-white/65">Die Wappen der {participants.length} Teilnehmer erscheinen im News-Beitrag.</span> : null}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <AppButton type="submit" variant="primary" disabled={pending || !draft.trim()}>{busy ? (recording ? 'Wird gespeichert…' : 'Wird geteilt…') : action}</AppButton>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      <TournamentPlanQrScannerSheet isOpen={scanner} onClose={() => setScanner(false)}
        validateLink={tournamentLivestreamUrl} invalidLinkMessage="Der QR-Code enthält keinen gültigen HTTPS-Link."
        onEnterLink={() => setScanner(false)} onScanSuccess={(url) => { setDraft(url); setScanner(false); }} />
    </form>
  );
}
