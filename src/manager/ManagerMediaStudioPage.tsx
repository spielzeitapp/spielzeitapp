import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, ImagePlus, Newspaper } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { getClubLogo } from '../lib/teamLogos';
import { matchdayPosterDomToPngBlob } from '../lib/matchdayPosterExport';
import './managerMediaStudio.css';
import './managerSpeakerStudio.css';
import { CommunicationDraftToolbar } from './components/CommunicationDraftToolbar';
import { getClubBrandingForTeamSeason } from '../lib/clubBranding';

type Template = 'matchday' | 'result' | 'news';
type Draft = { template: Template; title: string; team: string; opponent: string; home: boolean; date: string; time: string; venue: string; ownScore: string; opponentScore: string; body: string; caption: string; primary: string; accent: string };
const dateText = (date: string) => date ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date + 'T12:00:00')) : '';
const eventTime = (iso: string, time: boolean) => new Intl.DateTimeFormat('sv-SE', time ? { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' } : { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
function captionFor(d: Draft): string {
  if (d.template === 'news') return [d.title, d.body, '#GEMEINSAMEINTEAM'].filter(Boolean).join('\n\n');
  const teams = d.home ? d.team + ' – ' + d.opponent : d.opponent + ' – ' + d.team;
  if (d.template === 'result') {
    const score = d.home ? d.ownScore + ':' + d.opponentScore : d.opponentScore + ':' + d.ownScore;
    return ['ENDSTAND · ' + teams, score, d.body, '#GEMEINSAMEINTEAM'].filter(Boolean).join('\n\n');
  }
  return ['SPIELTAG · ' + teams, [dateText(d.date), d.time ? d.time + ' Uhr' : '', d.venue].filter(Boolean).join(' · '), d.home ? 'Kommt vorbei und unterstützt unser Team!' : 'Wir freuen uns auf eure Unterstützung beim Auswärtsspiel!', d.body, '#GEMEINSAMEINTEAM'].filter(Boolean).join('\n\n');
}
function MediaEditor({ teamSeasonId, teamName, ageGroup }: { teamSeasonId: string; teamName: string; ageGroup: string }) {
  const { events, loading, error } = useEvents(teamSeasonId);
  const [draft, setDraft] = useState<Draft>({ template: 'matchday', title: 'Vereinsnachricht', team: teamName, opponent: '', home: true, date: '', time: '', venue: '', ownScore: '', opponentScore: '', body: '', caption: '', primary: '#B51226', accent: '#FF4050' });
  const [eventId, setEventId] = useState('');
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const userEditedBrand = useRef(false);
  useEffect(() => { let live=true; void getClubBrandingForTeamSeason(teamSeasonId).then(r => { if(!live||!r.data)return; setClubLogo(r.data.logo_url); if(!userEditedBrand.current) setDraft(d => ({...d,primary:r.data!.primary_color || d.primary,accent:r.data!.accent_color || d.accent})); }); return () => {live=false;}; }, [teamSeasonId]);
  function loadDraft(payload: Record<string,unknown>): boolean {
    const raw=payload.draft;
    if(!raw||typeof raw!=='object'||Array.isArray(raw)){setMessage('Ungültiger Entwurf.');return false;}
    const d=raw as Draft;
    const keys=['title','team','opponent','date','time','venue','ownScore','opponentScore','body','caption','primary','accent'] as const;
    if(!['matchday','result','news'].includes(d.template)||typeof d.home!=='boolean'||keys.some(k=>typeof d[k]!=='string')||!/^#[0-9a-f]{6}$/i.test(d.primary)||!/^#[0-9a-f]{6}$/i.test(d.accent)|| (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date))){setMessage('Ungültiger Entwurf.');return false;}
    userEditedBrand.current=true;setDraft(d);setEventId(typeof payload.eventId==='string'?payload.eventId:'');setFormat(payload.format==='story'?'story':'feed');setPhoto(null);setLogo(null);setMessage('Textentwurf geladen. Eigene Bilddateien bitte erneut auswählen.');return true;
  }
  const [photo, setPhoto] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [format, setFormat] = useState<'feed' | 'story'>('feed');
  const [busy, setBusy] = useState(false);
  const [fits, setFits] = useState(true);
  const [message, setMessage] = useState('');
  const artwork = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = artwork.current;
    if (!root) return;
    const check = () => { const content = root.firstElementChild as HTMLElement | null; setFits(!content || content.scrollHeight <= content.clientHeight + 1); };
    const observer = new ResizeObserver(check); observer.observe(root);
    const frame = requestAnimationFrame(check);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [draft, format, photo]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  const update = <K extends keyof Draft,>(key: K, value: Draft[K]) => { if(key==='primary'||key==='accent')userEditedBrand.current=true; setDraft(d => ({ ...d, [key]: value })); setMessage(''); };
  const matches = events.filter(e => e.kind === 'match' && e.status !== 'canceled' && e.fixture_status !== 'open' && e.fixture_status !== 'agreed');
  function chooseEvent(id: string) {
    setEventId(id);
    const event: EventRow | undefined = matches.find(e => e.id === id);
    if (!event) return;
    setDraft(d => ({ ...d, opponent: event.opponent ?? '', home: event.is_home !== false, date: eventTime(event.starts_at, false), time: eventTime(event.starts_at, true), venue: event.location ?? '', ownScore: '', opponentScore: '', caption: '', body: '' }));
    setMessage('');
  }
  function selectTemplate(template: Template) { setDraft(d => ({ ...d, template, caption: '' })); setMessage(''); }
  function imageFile(file: File | undefined, target: 'photo' | 'logo') {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setMessage('Bitte PNG, JPEG oder WebP bis 8 MB auswählen.'); return; }
    const url = URL.createObjectURL(file);
    if (target === 'photo') setPhoto(url); else setLogo(url);
    setMessage('');
  }
  const scoreValid = /^\d{1,2}$/.test(draft.ownScore) && /^\d{1,2}$/.test(draft.opponentScore);
  const valid = draft.template === 'news' ? Boolean(draft.title.trim() && draft.body.trim()) : Boolean(draft.team.trim() && draft.opponent.trim() && draft.date && (draft.template === 'result' ? scoreValid : draft.time && draft.venue.trim()));
  const caption = draft.caption || captionFor(draft);
  const ownLogo = logo || clubLogo || getClubLogo(draft.team);
  const selected = matches.find(e => e.id === eventId);
  const opponentLogo = getClubLogo(draft.opponent, { logoUrl: selected?.opponent === draft.opponent ? selected?.opponent_logo_url : null });
  const home = draft.home ? { name: draft.team, logo: ownLogo } : { name: draft.opponent, logo: opponentLogo };
  const away = draft.home ? { name: draft.opponent, logo: opponentLogo } : { name: draft.team, logo: ownLogo };
  const score = draft.home ? draft.ownScore + ':' + draft.opponentScore : draft.opponentScore + ':' + draft.ownScore;
  async function download() {
    if (!artwork.current || !valid || !fits || busy) return;
    setBusy(true); setMessage('');
    try {
      const blob = await matchdayPosterDomToPngBlob(artwork.current);
      if (!blob) throw new Error('Die Grafik konnte nicht erstellt werden. Bitte Bilder prüfen und nochmals versuchen.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'vereinsmedien-' + draft.template + '-' + (draft.date || 'beitrag') + '.png'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('Grafik heruntergeladen. Den Beitragstext kannst du separat kopieren.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Download fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(caption); setMessage('Beitragstext kopiert.'); }
    catch { setMessage('Bitte den Text im Textfeld markieren und kopieren.'); }
  }
  const field = (key: 'title' | 'team' | 'opponent' | 'date' | 'time' | 'venue' | 'ownScore' | 'opponentScore', label: string, type = 'text') => <label className="media-studio-field">{label}<input type={type} value={draft[key]} maxLength={key.includes('Score') ? 2 : 120} onChange={e => update(key, e.target.value)} /></label>;
  return <div className="media-studio">
    <header className="media-studio-header"><span className="media-studio-eyebrow">Spielzeit Manager · {teamName}{ageGroup ? ' · ' + ageGroup : ''}</span><h1><Newspaper aria-hidden />Vereinsmedien</h1><p>Spieltag, Ergebnis oder Vereinsnachricht gestalten – Grafik herunterladen und Beitragstext kopieren.</p></header>
    <CommunicationDraftToolbar teamSeasonId={teamSeasonId} kind="media" title={draft.template==='news'?draft.title: draft.team+' – '+(draft.opponent||'Beitrag')} payload={{draft,caption,eventId,format}} onLoad={loadDraft}/>
    <div className="media-studio-templates" aria-label="Beitragsvorlage">
      {([['matchday', 'Spieltag', 'Nächstes Spiel ankündigen'], ['result', 'Ergebnis', 'Endstand und Kurzbericht'], ['news', 'Vereinsnachricht', 'Neuigkeiten, Helfer und Veranstaltungen']] as const).map(([key, title, detail]) => <button key={key} type="button" aria-pressed={draft.template === key} onClick={() => selectTemplate(key)}><strong>{title}</strong><span>{detail}</span></button>)}
    </div>
    <div className="media-studio-grid">
      <section className="media-studio-panel"><h2>1. Inhalt vorbereiten</h2>
        {draft.template !== 'news' ? <>
          <label className="media-studio-field">Spiel übernehmen<select value={eventId} onChange={e => chooseEvent(e.target.value)}><option value="">Manuell ausfüllen</option>{matches.map(e => <option key={e.id} value={e.id}>{eventTime(e.starts_at, false)} · {e.opponent || 'Gegner'}</option>)}</select></label>
          {loading ? <p role="status">Spiele werden geladen…</p> : null}{error ? <p role="alert">Spiele konnten nicht geladen werden. Du kannst die Felder manuell ausfüllen.</p> : null}
          {field('team', 'Unsere Mannschaft')}{field('opponent', 'Gegner')}
          <label className="media-studio-field">Spielort<select value={draft.home ? 'home' : 'away'} onChange={e => update('home', e.target.value === 'home')}><option value="home">Heimspiel</option><option value="away">Auswärtsspiel</option></select></label>
          <div className="media-studio-pair">{field('date', 'Datum', 'date')}{field('time', 'Anpfiff', 'time')}</div>{field('venue', 'Sportplatz')}
          {draft.template === 'result' ? <><div className="media-studio-pair">{field('ownScore', 'Unsere Tore')}{field('opponentScore', 'Tore des Gegners')}</div><p className="media-studio-hint">Endstand bewusst eintragen. Die Auswahl eines Termins übernimmt keine Tore.</p></> : null}
        </> : field('title', 'Überschrift')}
        <label className="media-studio-field">{draft.template === 'result' ? 'Kurzbericht / Torschützen' : draft.template === 'news' ? 'Nachricht' : 'Zusatzinfo'}<textarea rows={4} maxLength={700} value={draft.body} onChange={e => update('body', e.target.value)} /></label>
        <div className="media-studio-pair"><label className="media-studio-field">Hauptfarbe<input type="color" value={draft.primary} onChange={e => update('primary', e.target.value)} /></label><label className="media-studio-field">Akzentfarbe<input type="color" value={draft.accent} onChange={e => update('accent', e.target.value)} /></label></div>
        <p className="media-studio-hint">Diese Farben gelten nur für deinen Grafikentwurf.</p>
        <label className="media-studio-upload"><ImagePlus aria-hidden />Eigenes Foto auswählen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { imageFile(e.target.files?.[0], 'photo'); e.target.value = ''; }} /></label>
        {photo ? <button type="button" className="media-studio-text-button" onClick={() => setPhoto(null)}>Foto entfernen</button> : null}
        <label className="media-studio-field">Vereinslogo ersetzen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { imageFile(e.target.files?.[0], 'logo'); e.target.value = ''; }} /></label>
        {logo ? <button type="button" className="media-studio-text-button" onClick={() => setLogo(null)}>Gespeichertes Logo verwenden</button> : null}
        <p className="media-studio-hint">Texte und Farben kannst du als Entwurf speichern. Eigene Bilddateien werden noch nicht mitgespeichert und müssen nach dem Laden erneut ausgewählt werden.</p>
      </section>
      <section className="media-studio-panel"><h2>2. Vorschau & Export</h2>
        <div className="media-studio-format" aria-label="Bildformat"><button type="button" aria-pressed={format === 'feed'} onClick={() => setFormat('feed')}>Beitrag · 4:5</button><button type="button" aria-pressed={format === 'story'} onClick={() => setFormat('story')}>Story · 9:16</button></div>
        <div ref={artwork} className={'media-studio-artwork media-studio-artwork--' + format} style={{ '--media-primary': draft.primary, '--media-accent': draft.accent } as React.CSSProperties}>
          <div className="media-studio-artwork-content"><p className="media-studio-artwork-team">{draft.team}{ageGroup ? ' · ' + ageGroup : ''}</p><h2>{draft.template === 'matchday' ? 'SPIELTAG' : draft.template === 'result' ? 'ENDSTAND' : draft.title || 'VEREINSNACHRICHT'}</h2>
            {draft.template !== 'news' ? <><div className="media-studio-clubs">{[home, away].map((club, i) => <React.Fragment key={i}>{i === 1 ? <strong className="media-studio-vs">{draft.template === 'result' && scoreValid ? score : 'VS'}</strong> : null}<div><img src={club.logo} alt="" crossOrigin="anonymous" onError={e => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = '/logos/placeholder-shield-a.png'; }} /><span>{club.name || 'Gegner'}</span></div></React.Fragment>)}</div><p className="media-studio-artwork-date">{dateText(draft.date)}{draft.time ? ' · ' + draft.time + ' Uhr' : ''}</p><p className="media-studio-artwork-venue">{draft.venue}</p></> : null}
            {draft.body ? <p className="media-studio-artwork-body">{draft.body}</p> : null}
            {photo ? <img className="media-studio-artwork-photo" src={photo} alt="Beitragsfoto" /> : null}
            <footer>#GEMEINSAM<span>EINTEAM</span></footer>
          </div>
        </div>
        {!valid ? <p className="media-studio-hint">Für den Export bitte {draft.template === 'news' ? 'Überschrift und Nachricht' : draft.template === 'result' ? 'Mannschaften, Datum und beide Torzahlen' : 'Mannschaften, Datum, Anpfiff und Sportplatz'} ausfüllen.</p> : null}
        {!fits ? <p role="alert" className="media-studio-hint">Der Inhalt ist für dieses Format zu lang. Bitte Text kürzen, das Foto entfernen oder das Story-Format wählen.</p> : null}
        <button type="button" className="media-studio-primary" disabled={!valid || !fits || busy} onClick={download}><Download aria-hidden />{busy ? 'Grafik wird erstellt…' : 'Grafik herunterladen'}</button>
        <h3>Beitragstext</h3><label className="media-studio-field"><span className="sr-only">Beitragstext bearbeiten</span><textarea rows={7} value={caption} onChange={e => update('caption', e.target.value)} /></label>
        <button type="button" className="media-studio-secondary" disabled={!valid} onClick={copy}><Copy aria-hidden />Text kopieren</button>
        {draft.caption ? <button type="button" className="media-studio-text-button" onClick={() => update('caption', '')}>Text aus aktuellen Angaben neu erstellen</button> : null}
        {message ? <p role="status" className="media-studio-message">{message}</p> : null}
        <p className="media-studio-hint">Download und Kopieren veröffentlichen keinen Beitrag. Grafik und Text kannst du anschließend auf euren Vereinskanälen verwenden.</p>
      </section>
    </div>
    <aside className="media-studio-panel media-studio-next"><h2>Bereits veröffentlichte Autoposts</h2><p>Im Mannschaftsfeed findest du Kader, Aufstellungen und Ergebnisse mit der bestehenden Teilen-Funktion.</p><Link to="/manager/home">Feed & Beiträge öffnen →</Link></aside>
  </div>;
}
export function ManagerMediaStudioPage(): React.ReactElement {
  const { user, viewTeamSeason, selectedTeamSeason } = useSession();
  const season = viewTeamSeason ?? selectedTeamSeason;
  if (!season) return <p>Bitte oben eine freigegebene Mannschaft und Saison auswählen.</p>;
  return <MediaEditor key={(user?.id??'')+season.id} teamSeasonId={season.id} teamName={season.team.name} ageGroup={season.age_group ?? season.team.age_group ?? ''} />;
}
