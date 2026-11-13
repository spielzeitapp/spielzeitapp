import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, LockKeyhole, MessageCircle, Plus, Send, Shirt, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import type { ClubSeason } from './uscClub';
import { notifyNotificationsReadChanged } from '../../lib/notificationsReadState';
import './clubExchange.css';

type Listing = { id: string; club_id: string; owner_id: string; owner_label: string; title: string; category: string; size: string; condition: string; offer: string; price: number | null; description: string; team_label: string; status: string; photo_paths: string[]; created_at: string; revision: number };
type Thread = { id: string; listing_id: string; requester_id: string; requester_label: string; created_at: string };
type Message = { id: string; thread_id: string; sender_id: string; body: string; created_at: string };
const categories = ['T-Shirt', 'Hose', 'Pulli', 'Trainingsanzug', 'Jacke', 'Schuhe', 'Sonstiges'];
const conditions = ['Wie neu', 'Sehr gut', 'Gut', 'Gebraucht'];
const emptyForm = { title: '', category: 'Pulli', size: '', condition: 'Sehr gut', offer: 'Gratis', price: '', description: '', team_label: '' };
const stamp = (value: string) => new Date(value).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' });
const priceLabel = (item: Listing) => item.offer === 'Verkaufen' ? `${Number(item.price).toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })}` : item.offer;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Das hat nicht geklappt. Bitte erneut versuchen.';

/** Decode + recompress strips EXIF/location and caps upload size before storage. */
async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw Error('Bitte ein Foto mit höchstens 20 MB auswählen.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d'); if (!context) throw Error('Foto konnte nicht verarbeitet werden.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size > 5 * 1024 * 1024) throw Error('Foto ist zu groß. Bitte ein kleineres Bild wählen.');
    return blob;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Foto')) throw error;
    throw Error('Dieses Foto konnte nicht gelesen werden. Bitte als JPG, PNG oder WebP auswählen.');
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function ClubExchange({ clubId, userId, seasons }: { clubId: string; userId: string; seasons: ClubSeason[] }) {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Listing[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState<{ id: string; kind: string }[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [access, setAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'all' | 'mine' | 'requests'>('all');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [team, setTeam] = useState('');
  const [offer, setOffer] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingRevision, setEditingRevision] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [existingPaths, setExistingPaths] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [share, setShare] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const formDialog = useRef<HTMLDialogElement>(null);
  const photoExpiry = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const threadId = params.get('thread');
  const currentThread = threads.find(t => t.id === threadId);
  const detail = items.find(item => item.id === (currentThread?.listing_id || detailId));
  const myItem = detail?.owner_id === userId;
  const otherId = currentThread && detail ? (myItem ? currentThread.requester_id : detail.owner_id) : null;
  const isBlocked = Boolean(otherId && blocked.includes(otherId));

  const dispatchPush = useCallback(async (silent = false) => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const response = await fetch('/api/exchange/push', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      if ((!response.ok || result.pending || result.disabled) && alive.current && !silent) setNotice(result.disabled ? 'Nachricht gespeichert. Push ist in dieser TEST-Umgebung deaktiviert.' : 'Nachricht gespeichert. Push konnte noch nicht zugestellt werden.');
    } catch { if (alive.current && !silent) setNotice('Nachricht gespeichert. Push wird beim nächsten Öffnen erneut versucht.'); }
  }, []);

  const load = useCallback(async () => {
    try {
      const permission = await supabase.rpc('exchange_access', { p_club_id: clubId });
      if (permission.error) throw Error('Tauschbörse konnte nicht geladen werden. Bitte erneut versuchen.');
      if (!alive.current) return;
      setAccess(Boolean(permission.data));
      if (!permission.data) { setLoading(false); return; }
      const [list, chats, notifications, blocks] = await Promise.all([
        supabase.from('exchange_listings').select('*').eq('club_id', clubId).order('created_at', { ascending: false }),
        supabase.from('exchange_threads').select('*').order('created_at', { ascending: false }),
        supabase.from('notifications').select('id,kind').eq('user_id', userId).eq('event_type', 'exchange').eq('read', false),
        supabase.from('exchange_blocks').select('blocked_id').eq('blocker_id', userId).eq('club_id', clubId),
      ]);
      if (list.error || chats.error || notifications.error || blocks.error) throw Error('Angebote oder Anfragen konnten nicht geladen werden.');
      if (!alive.current) return;
      const listings = (list.data || []) as Listing[];
      setItems(listings); setThreads((chats.data || []).filter(t => listings.some(l => l.id === t.listing_id)) as Thread[]);
      setUnread((notifications.data || []) as { id: string; kind: string }[]);
      setBlocked((blocks.data || []).map(b => b.blocked_id));
      const paths = listings.flatMap(item => item.photo_paths);
      if (paths.length && (Date.now() > photoExpiry.current || paths.some(p => !photos[p]))) {
        const signed = await supabase.storage.from('exchange-photos').createSignedUrls(paths, 900);
        if (signed.error) throw Error('Fotos konnten nicht geladen werden. Bitte erneut versuchen.');
        if (alive.current) { setPhotos(Object.fromEntries((signed.data || []).filter(p => p.signedUrl).map(p => [p.path!, p.signedUrl]))); photoExpiry.current = Date.now() + 600_000; }
      }
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { if (alive.current) setLoading(false); }
  }, [clubId, userId, photos]);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    void loadRef.current(); void dispatchPush(true);
    const interval = window.setInterval(() => { if (!document.hidden) void loadRef.current(); }, 15_000);
    return () => window.clearInterval(interval);
  }, [clubId, userId, dispatchPush]);

  useEffect(() => {
    if (!threadId || !currentThread) { setMessages([]); return; }
    let active = true;
    const fetchMessages = async () => {
      const result = await supabase.from('exchange_messages').select('*').eq('thread_id', threadId).order('created_at');
      if (active && !result.error) {
        setMessages((result.data || []) as Message[]);
        const seen = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() })
          .eq('user_id', userId).eq('event_type', 'exchange').eq('kind', `exchange:${threadId}`).eq('read', false);
        if (!seen.error && active) { setUnread(previous => previous.filter(n => n.kind !== `exchange:${threadId}`)); notifyNotificationsReadChanged(); }
      } else if (active) setError('Nachrichten konnten nicht geladen werden.');
    };
    void fetchMessages();
    const timer = window.setInterval(() => { if (!document.hidden) void fetchMessages(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [threadId, currentThread?.id, userId]);
  const openThread = (id: string | null) => {
    setBody(''); setShare(false); setContact('');
    setParams(old => { const next = new URLSearchParams(old); if (id) next.set('thread', id); else next.delete('thread'); return next; });
  };
  const act = async (work: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(errorText(e)); }
    finally { if (alive.current) setBusy(false); }
  };
  const startRequest = () => act(async () => {
    if (!detail || !adult) throw Error('Bitte bestätige, dass du die Anfrage als erwachsene Person verwaltest.');
    let chat = threads.find(t => t.listing_id === detail.id && t.requester_id === userId);
    if (chat) { openThread(chat.id); return; }
    if (!chat) {
      const insert = await supabase.from('exchange_threads').insert({ listing_id: detail.id, requester_id: userId }).select('*').single();
      if (insert.error?.code === '23505') {
        const existing = await supabase.from('exchange_threads').select('*').eq('listing_id', detail.id).eq('requester_id', userId).single();
        if (existing.error) throw Error('Anfrage konnte nicht geöffnet werden.'); chat = existing.data as Thread;
      } else { if (insert.error) throw Error('Anfrage konnte nicht angelegt werden. Ist der Artikel noch verfügbar?'); chat = insert.data as Thread; }
    }
    if (!chat) throw Error('Anfrage konnte nicht geöffnet werden.');
    const result = await supabase.from('exchange_messages').insert({ thread_id: chat.id, sender_id: userId, body: body.trim() || 'Hallo! Ist der Artikel noch verfügbar?' });
    if (result.error) throw Error('Die Nachricht konnte nicht gesendet werden. Bitte erneut versuchen.');
    await loadRef.current(); openThread(chat.id); await dispatchPush();
  });
  const sendMessage = () => act(async () => {
    if (!currentThread || !body.trim() || isBlocked) return;
    const result = await supabase.from('exchange_messages').insert({ thread_id: currentThread.id, sender_id: userId, body: body.trim() });
    if (result.error) throw Error('Nachricht konnte nicht gesendet werden.');
    setBody('');
    const fresh = await supabase.from('exchange_messages').select('*').eq('thread_id', currentThread.id).order('created_at');
    if (!fresh.error) setMessages((fresh.data || []) as Message[]);
    await dispatchPush();
  });
  const shareContact = () => act(async () => {
    if (!currentThread || !contact.trim() || isBlocked) return;
    const result = await supabase.from('exchange_messages').insert({ thread_id: currentThread.id, sender_id: userId, body: `Ich teile freiwillig meine Kontaktdaten für diese Übergabe: ${contact.trim()}` });
    if (result.error) throw Error('Kontaktdaten konnten nicht gesendet werden.');
    setShare(false); setContact(''); setNotice('Deine Kontaktdaten wurden nur in diesem Chat geteilt.'); await dispatchPush();
  });
  const openEditor = (item?: Listing) => {
    setEditingRevision(item?.revision ?? 0);
    setEditing(item?.id || 'new'); setFiles([]); setAdult(false); setExistingPaths(item?.photo_paths || []);
    setForm(item ? { title: item.title, category: item.category, size: item.size, condition: item.condition, offer: item.offer, price: String(item.price ?? ''), description: item.description, team_label: item.team_label } : emptyForm);
    formDialog.current?.showModal();
  };
  const closeEditor = () => { formDialog.current?.close(); setEditing(null); setFiles([]); };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    void act(async () => {
      if (!adult) throw Error('Bitte bestätige die Verwaltung als erwachsene Person.');
      if (!existingPaths.length && !files.length) throw Error('Bitte mindestens ein Foto vom Gewand hinzufügen.');
      const id = editing === 'new' ? crypto.randomUUID() : editing!;
      const values = { ...form, title: form.title.trim(), size: form.size.trim(), price: form.offer === 'Verkaufen' ? Number(form.price.replace(',', '.')) : null };
      if (form.offer === 'Verkaufen' && (!form.price.trim() || !Number.isFinite(values.price) || Number(values.price) < 0 || Number(values.price) > 9999)) throw Error('Bitte einen gültigen Preis eingeben.');
      const paths = [...existingPaths]; const uploaded: string[] = [];
      let published = false;
      try {
        if (editing === 'new') {
          const draft = await supabase.from('exchange_listings').insert({ ...values, id, club_id: clubId, owner_id: userId, status: 'Entwurf' });
          if (draft.error) throw Error('Inserat konnte nicht angelegt werden.');
        }
        for (const file of files) {
          const blob = await preparePhoto(file);
          const path = `${clubId}/${userId}/${id}/${crypto.randomUUID()}.jpg`;
          const upload = await supabase.storage.from('exchange-photos').upload(path, blob, { contentType: 'image/jpeg' });
          if (upload.error) throw Error('Foto-Upload fehlgeschlagen. Bitte erneut versuchen.');
          paths.push(path); uploaded.push(path);
        }
        const previous = items.find(i => i.id === id);
        const result = await supabase.from('exchange_listings').update({ ...values, photo_paths: paths, status: previous?.status === 'Entwurf' ? 'Verfügbar' : previous?.status || 'Verfügbar' }).eq('id', id).eq('owner_id', userId).eq('revision', editingRevision).select('id').single();
        if (result.error) throw Error('Inserat konnte nicht gespeichert werden. Es wurde möglicherweise auf einem anderen Gerät geändert. Bitte neu laden.');
        published = true;
        const removed = existingPaths.length ? (previous?.photo_paths || []).filter(p => !paths.includes(p)) : previous?.photo_paths || [];
        if (removed.length) await supabase.storage.from('exchange-photos').remove(removed);
        closeEditor(); setNotice('Dein Inserat ist gespeichert.'); await loadRef.current();
      } finally {
        if (!published) {
          if (uploaded.length) await supabase.storage.from('exchange-photos').remove(uploaded);
          if (editing === 'new') await supabase.from('exchange_listings').delete().eq('id', id).eq('owner_id', userId);
        }
      }
    });
  };
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const added = [...incoming];
    if (files.length + existingPaths.length + added.length > 5) { setError('Bis zu 5 Fotos pro Inserat.'); return; }
    setFiles(old => [...old, ...added]);
  };
  const status = (value: string) => act(async () => {
    if (!detail) return;
    const result = await supabase.from('exchange_listings').update({ status: value }).eq('id', detail.id).eq('owner_id', userId).eq('revision', detail.revision).select('id').single();
    if (result.error) throw Error('Status konnte nicht geändert werden.'); await loadRef.current();
  });
  const remove = () => act(async () => {
    if (!detail || !window.confirm('Inserat und zugehörige Chats endgültig löschen?')) return;
    const paths = detail.photo_paths;
    const result = await supabase.from('exchange_listings').delete().eq('id', detail.id).eq('owner_id', userId).eq('revision', detail.revision).select('id').single();
    if (result.error) throw Error('Inserat konnte nicht gelöscht werden.');
    if (paths.length) await supabase.storage.from('exchange-photos').remove(paths);
    openThread(null); setDetailId(null); await loadRef.current();
  });
  const toggleBlock = () => act(async () => {
    if (!otherId) return;
    if (!isBlocked && !window.confirm('Diese Person für weitere Nachrichten in der Tauschbörse blockieren?')) return;
    const result = isBlocked
      ? await supabase.from('exchange_blocks').delete().eq('club_id', clubId).eq('blocker_id', userId).eq('blocked_id', otherId)
      : await supabase.from('exchange_blocks').insert({ club_id: clubId, blocker_id: userId, blocked_id: otherId });
    if (result.error) throw Error('Blockierung konnte nicht geändert werden.');
    await loadRef.current();
  });

  const shown = items.filter(item => (view !== 'mine' ? item.status !== 'Entwurf' && item.status !== 'Vergeben' : item.owner_id === userId)
    && (!category || item.category === category) && (!size || item.size === size) && (!team || item.team_label === team) && (!offer || item.offer === offer));
  const previewFiles = files.map(file => ({ file, key: `${file.name}-${file.lastModified}-${file.size}` }));
  return <section className="exchange" aria-label="Vereinsinterne Tauschbörse">
    <header className="exchange-heading"><div><span className="usc-eyebrow">Alle Mannschaften · Ein Verein</span><h2>Tauschbörse</h2><p>Trainingsgewand im Verein weitergeben.</p></div>{access && <button className="exchange-primary" onClick={() => openEditor()}><Plus size={17} /> Inserat</button>}</header>
    {error && <div className="exchange-alert" role="alert">{error}<button onClick={() => { setError(''); void loadRef.current(); }}>Erneut versuchen</button></div>}
    {notice && <p role="status" className="exchange-hint">{notice}</p>}
    {loading ? <p role="status">Tauschbörse wird geladen…</p> : access === false ? <div className="exchange-empty"><LockKeyhole /><h3>Nur für Vereinsmitglieder</h3><p>Für Inserate und Anfragen benötigst du einen zugeordneten Eltern-, Trainer- oder Vereinszugang. Ein Favorit allein reicht dafür nicht.</p></div> : access && <>
      {detail ? <>
        <button className="exchange-back" onClick={() => { openThread(null); setDetailId(null); }}><ArrowLeft size={18} /> Zur Übersicht</button>
        <div className="exchange-gallery">{detail.photo_paths.map(path => <img key={path} src={photos[path]} alt={detail.title} />)}</div>
        <div className="exchange-item-head"><h3>{detail.title}</h3><strong>{priceLabel(detail)}</strong></div>
        <div className="exchange-tags"><span>Größe {detail.size}</span><span>{detail.condition}</span><span>{detail.status}</span></div>
        <p className="exchange-owner">{detail.owner_label}{detail.team_label ? ` · ${detail.team_label}` : ''}</p><p className="exchange-description">{detail.description}</p>
        {myItem && <div className="exchange-owner-tools"><button onClick={() => openEditor(detail)}>Bearbeiten</button><select aria-label="Status des Inserats" disabled={busy} value={detail.status} onChange={e => void status(e.target.value)}>{['Entwurf', 'Verfügbar', 'Reserviert', 'Vergeben'].map(s => <option key={s}>{s}</option>)}</select><button disabled={busy} onClick={() => void remove()}><Trash2 size={16} /> Löschen</button></div>}
        {currentThread ? <div className="exchange-chat"><h3><LockKeyhole size={17} /> Privater Chat mit {myItem ? currentThread.requester_label : detail.owner_label}</h3><p>Nur ihr beide seht diese Nachrichten.</p>
          <div className="exchange-messages" aria-label="Nachrichten">{messages.map(message => <div className={`exchange-message ${message.sender_id === userId ? 'exchange-message-own' : ''}`} key={message.id}><p>{message.body}</p><small>{stamp(message.created_at)}</small></div>)}{!messages.length && <p>Noch keine Nachrichten.</p>}</div>
          {isBlocked ? <p className="exchange-hint">Diese Person ist blockiert. Neue Nachrichten sind gesperrt.</p> : <><form onSubmit={e => { e.preventDefault(); void sendMessage(); }} className="exchange-compose"><label className="exchange-sr" htmlFor="exchange-reply">Nachricht</label><textarea id="exchange-reply" maxLength={2000} placeholder="Nachricht schreiben…" value={body} onChange={e => setBody(e.target.value)} /><button className="exchange-primary" disabled={busy || !body.trim()} aria-label="Nachricht senden"><Send size={18} /></button></form>
          <button className="exchange-back" onClick={() => setShare(!share)}>Kontaktdaten freiwillig teilen</button></>}
          {share && <form className="exchange-contact" onSubmit={e => { e.preventDefault(); void shareContact(); }}><p>Teile nur deine eigenen Daten. Sie werden als Nachricht ausschließlich an diese Person gesendet.</p><label>Telefonnummer oder E-Mail<input value={contact} maxLength={200} onChange={e => setContact(e.target.value)} required /></label><button className="exchange-primary" disabled={busy}>Jetzt nur in diesem Chat teilen</button></form>}
          <button className="exchange-back" disabled={busy} onClick={() => void toggleBlock()}>{isBlocked ? 'Blockierung aufheben' : 'Person blockieren'}</button>
        </div> : myItem ? <div className="exchange-chat"><h3>Anfragen zu diesem Artikel</h3>{threads.filter(t => t.listing_id === detail.id).map(t => <button className="exchange-thread" key={t.id} onClick={() => openThread(t.id)}><MessageCircle size={19} /><span>{t.requester_label}<small>Privaten Chat öffnen</small></span>{unread.some(n => n.kind === `exchange:${t.id}`) && <b>Neu</b>}</button>)}{!threads.some(t => t.listing_id === detail.id) && <p>Noch keine Anfragen.</p>}</div> : <div className="exchange-chat"><h3>Interesse an diesem Artikel?</h3><textarea aria-label="Deine Anfrage" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="Hallo! Ist der Artikel noch verfügbar?" /><label className="exchange-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} />Ich verwalte diese Anfrage als erwachsene Person.</label><button className="exchange-primary" disabled={busy || !adult || detail.status !== 'Verfügbar'} onClick={() => void startRequest()}><MessageCircle size={17} />{busy ? 'Wird gesendet…' : 'Interesse senden'}</button><p><LockKeyhole size={13} /> Telefonnummer und E-Mail bleiben verborgen.</p></div>}
      </> : <>
        <div className="exchange-tabs">{([['all','Entdecken'],['mine','Meine Inserate'],['requests','Anfragen']] as const).map(([id,label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}{id === 'requests' && unread.length > 0 && <b>{unread.length}</b>}</button>)}</div>
        {threadId && !currentThread && <p className="exchange-hint">Diese Anfrage ist nicht verfügbar oder du hast keinen Zugriff mehr.</p>}
        {view === 'requests' ? <div>{threads.map(t => { const item = items.find(l => l.id === t.listing_id); return item ? <button key={t.id} className="exchange-thread" onClick={() => openThread(t.id)}><MessageCircle size={22} /><span>{item.title}<small>{item.owner_id === userId ? t.requester_label : item.owner_label} · {stamp(t.created_at)}</small></span>{unread.some(n => n.kind === `exchange:${t.id}`) && <b>Neu</b>}</button> : null; })}{!threads.length && <div className="exchange-empty"><MessageCircle /><h3>Noch keine Anfragen</h3><p>Deine Anfragen und Antworten erscheinen hier.</p></div>}</div> : <>
          <div className="exchange-filters"><select aria-label="Mannschaft filtern" value={team} onChange={e => setTeam(e.target.value)}><option value="">Alle Mannschaften</option>{[...new Set(items.map(i => i.team_label).filter(Boolean))].sort().map(t => <option key={t}>{t}</option>)}</select><div><select aria-label="Artikel filtern" value={category} onChange={e => setCategory(e.target.value)}><option value="">Artikel</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Größe filtern" value={size} onChange={e => setSize(e.target.value)}><option value="">Größe</option>{[...new Set(items.map(i => i.size))].sort((a,b) => a.localeCompare(b,'de',{numeric:true})).map(s => <option key={s}>{s}</option>)}</select><select aria-label="Angebotsart filtern" value={offer} onChange={e => setOffer(e.target.value)}><option value="">Alle Angebote</option>{['Gratis','Tauschen','Verkaufen'].map(o => <option key={o}>{o}</option>)}</select></div>{(team || category || size || offer) && <button className="exchange-back" onClick={() => { setTeam(''); setCategory(''); setSize(''); setOffer(''); }}>Filter zurücksetzen</button>}</div>
          <div className="exchange-grid">{shown.map(item => <button key={item.id} className="exchange-card" onClick={() => { setDetailId(item.id); setBody(''); setAdult(false); }}><div className="exchange-card-image">{photos[item.photo_paths[0]] ? <img src={photos[item.photo_paths[0]]} alt={item.title} loading="lazy" /> : <Shirt size={42} />}<span>{item.status}</span></div><div className="exchange-card-copy"><h3>{item.title}</h3><p>Größe {item.size} · {item.condition}</p><strong>{priceLabel(item)}</strong><small>{item.owner_label}{item.team_label ? ` · ${item.team_label}` : ''}</small></div></button>)}</div>
          {!shown.length && <div className="exchange-empty"><Shirt size={36} /><h3>{items.length ? 'Keine passenden Angebote' : 'Zu klein? Gib es weiter.'}</h3><p>{items.length ? 'Ändere die Filter oder stelle selbst ein Inserat ein.' : 'Sei der Erste und stelle Trainingsgewand für andere Familien im Verein ein.'}</p><button className="exchange-primary" onClick={() => openEditor()}><Plus size={17} /> Inserat erstellen</button></div>}
        </>}
      </>}
      <p className="exchange-privacy"><LockKeyhole size={14} /> Nur für Vereinsmitglieder · Übergabe und Bezahlung direkt vereinbaren.</p>
    </>}
    <dialog ref={formDialog} className="exchange-dialog" aria-labelledby="exchange-editor-title" onCancel={e => { if (busy) e.preventDefault(); else closeEditor(); }}>
      <form onSubmit={save}><header className="exchange-heading"><h2 id="exchange-editor-title">{editing === 'new' ? 'Inserat erstellen' : 'Inserat bearbeiten'}</h2><button type="button" disabled={busy} onClick={closeEditor} aria-label="Schließen"><X size={21} /></button></header>
        {error && <p role="alert" className="exchange-alert">{error}</p>}
        <p>Bis zu 5 eigene Fotos. Bitte nur das Gewand fotografieren.</p>
        <div className="exchange-photo-actions"><button type="button" disabled={busy} onClick={() => camera.current?.click()}><Camera size={19} /> Fotografieren</button><button type="button" disabled={busy} onClick={() => gallery.current?.click()}><ImagePlus size={19} /> Galerie</button></div>
        <input hidden type="file" accept="image/*" capture="environment" ref={camera} onChange={e => { addFiles(e.target.files); e.target.value=''; }} /><input hidden type="file" accept="image/*" multiple ref={gallery} onChange={e => { addFiles(e.target.files); e.target.value=''; }} />
        <div className="exchange-upload-list">{existingPaths.map((p,index) => <div key={p}><img src={photos[p]} alt={`Foto ${index+1}`} /><button type="button" disabled={busy} aria-label={`Foto ${index+1} entfernen`} onClick={() => setExistingPaths(old => old.filter(path => path !== p))}><X size={15}/></button></div>)}{previewFiles.map(({file,key},index) => <UploadPreview key={key} file={file} disabled={busy} onRemove={() => setFiles(old => old.filter((_,i) => i !== index))} />)}</div>
        <fieldset disabled={busy}><label>Bezeichnung<input required minLength={3} maxLength={80} value={form.title} placeholder="z. B. USC Trainingspulli" onChange={e => setForm({...form,title:e.target.value})} /></label>
        <div className="exchange-form-row"><label>Artikel<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Größe<input required maxLength={15} value={form.size} placeholder="z. B. 140 oder 35" onChange={e => setForm({...form,size:e.target.value})} /></label></div>
        <div className="exchange-form-row"><label>Zustand<select value={form.condition} onChange={e => setForm({...form,condition:e.target.value})}>{conditions.map(c => <option key={c}>{c}</option>)}</select></label><label>Angebot<select value={form.offer} onChange={e => setForm({...form,offer:e.target.value})}>{['Gratis','Tauschen','Verkaufen'].map(o => <option key={o}>{o}</option>)}</select></label></div>
        {form.offer === 'Verkaufen' && <label>Preis in Euro<input required inputMode="decimal" value={form.price} onChange={e => setForm({...form,price:e.target.value})} /></label>}
        <label>Derzeitige Mannschaft<select value={form.team_label} onChange={e => setForm({...form,team_label:e.target.value})}><option value="">Ohne Mannschaftsangabe</option>{[...new Set([...seasons.map(s => s.age_group || s.display_name || s.team.name), ...(form.team_label ? [form.team_label] : [])])].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Beschreibung / Tauschwunsch<textarea maxLength={1500} value={form.description} placeholder="Zustand, Tauschwunsch, mögliche Übergabe…" onChange={e => setForm({...form,description:e.target.value})} /></label>
        <label className="exchange-check"><input type="checkbox" required checked={adult} onChange={e => setAdult(e.target.checked)} />Ich verwalte dieses Inserat als erwachsene Person.</label>
        <p className="exchange-hint">Dein Vorname ist sichtbar. Telefonnummer und E-Mail werden nicht veröffentlicht.</p>
        <button className="exchange-primary exchange-full" disabled={busy}>{busy ? 'Fotos werden hochgeladen…' : 'Inserat speichern'}</button></fieldset>
      </form>
    </dialog>
  </section>;
}

function UploadPreview({file,disabled,onRemove}: {file: File;disabled: boolean;onRemove:()=>void}) {
  const [url,setUrl] = useState('');
  useEffect(() => { const objectUrl=URL.createObjectURL(file); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file]);
  return <div><img src={url} alt={file.name} /><button type="button" disabled={disabled} aria-label={`${file.name} entfernen`} onClick={onRemove}><X size={15} /></button></div>;
}
