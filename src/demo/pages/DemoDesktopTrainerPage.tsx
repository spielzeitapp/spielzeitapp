import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Check, ClipboardList, Download, FileText, Home, Monitor, Plus, RotateCcw, Smartphone } from 'lucide-react';
import { TrainingSessionExerciseCard } from '../../components/training/TrainingSessionExerciseCard';
import { TrainingExerciseDetailModal } from '../../components/training/TrainingExerciseDetailModal';
import { Modal } from '../../app/ui/Modal';
import { TRAINING_PHASES, TRAINING_PHASE_LABELS, EXERCISE_FOCUS_LABELS, type TrainingPhase } from '../../lib/trainingPhases';
import type { TrainingExerciseRow } from '../../lib/trainingExercises';
import type { TrainingSessionExerciseRow } from '../../lib/trainingSessions';
import { createTrainingSessionHandoutHtml } from '../../lib/trainingSessionHandout';
import { createDemoDesktopItems, createDemoDesktopSession, DEMO_DESKTOP_EXERCISES, DEMO_DESKTOP_SKETCHES, demoDesktopItem, orderDemoDesktopItems } from '../demoDesktopTraining';
import '../../manager/managerShell.css';
import './demoDesktopTrainer.css';

type View = 'overview' | 'plan' | 'library' | 'documentation' | 'pitch';
const views = [
  { id: 'overview', label: 'Übersicht', Icon: Home },
  { id: 'plan', label: 'Trainingsplan', Icon: ClipboardList },
  { id: 'library', label: 'Übungsbibliothek', Icon: BookOpen },
  { id: 'documentation', label: 'Trainerdokumentation', Icon: FileText },
] as const;

/** Public sandbox: no session hooks, database reads, writes, uploads or real invitations. */
export function DemoDesktopTrainerPage(): React.ReactElement {
  const [view, setView] = useState<View>('overview');
  const [session, setSession] = useState(createDemoDesktopSession);
  const [items, setItems] = useState(createDemoDesktopItems);
  const [exercises, setExercises] = useState(DEMO_DESKTOP_EXERCISES);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState<TrainingPhase | ''>('');
  const [picker, setPicker] = useState<{ phase: TrainingPhase; replaceId?: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ exercise: TrainingExerciseRow; item: TrainingSessionExerciseRow } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const nextId = useRef(10);
  const heading = useRef<HTMLHeadingElement>(null);
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));
  const ordered = orderDemoDesktopItems(items);
  const total = items.reduce((sum, item) => sum + item.duration_minutes, 0);
  const dateIso = '2026-10-20T15:00:00Z';
  const activeExercise = detail ? exerciseMap[detail] : null;
  const shown = exercises.filter(e => (!phase || e.suitable_phases.includes(phase)) && `${e.title} ${e.description} ${EXERCISE_FOCUS_LABELS[e.focus]}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));

  useEffect(() => {
    const previous = document.title;
    document.title = 'Trainer-Desktopdemo · SpielzeitApp';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [view]);

  function changeItems(next: TrainingSessionExerciseRow[]) {
    setItems(next);
    setSession(s => ({ ...s, status: 'draft' }));
  }
  function updateItem(id: string, patch: Partial<TrainingSessionExerciseRow>) {
    changeItems(items.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  function chooseExercise(exercise: TrainingExerciseRow) {
    const targetPhase = picker?.phase ?? exercise.suitable_phases[0];
    if (picker?.replaceId) {
      updateItem(picker.replaceId, { exercise_id: exercise.id });
    } else {
      const item = demoDesktopItem(exercise, `desktop-demo-item-${nextId.current++}`, items.length ? Math.max(...items.map(i => i.sort_order)) + 1 : 0);
      changeItems([...items, { ...item, phase: targetPhase }]);
    }
    setPicker(null);
    setMessage('Übung im lokalen Demoplan übernommen. Es wurde nichts an ein Team gesendet.');
    setView('plan');
  }
  function moveItem(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const group = ordered.filter(i => i.phase === item.phase);
    const index = group.findIndex(i => i.id === id);
    const other = group[index + delta];
    if (!other) return;
    changeItems(items.map(i => i.id === id ? { ...i, sort_order: other.sort_order } : i.id === other.id ? { ...i, sort_order: item.sort_order } : i));
  }
  function reset() {
    setSession(createDemoDesktopSession()); setItems(createDemoDesktopItems()); setExercises(DEMO_DESKTOP_EXERCISES);
    setSearch(''); setPhase(''); setPicker(null); setDetail(null); setEdit(null); setView('overview'); setResetOpen(false);
    setMessage('Die fiktive Beispielplanung ist wiederhergestellt.');
  }
  function printHandout() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setMessage('Bitte Pop-ups erlauben, um das A4-Handout zu öffnen.'); return; }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(createTrainingSessionHandoutHtml({
      session: { ...session, title: `DEMO – ${session.title}`, planned_duration_minutes: total },
      items: ordered, exerciseMap, sketchUrls: DEMO_DESKTOP_SKETCHES,
      trainerName: 'Markus Beispiel · Demo', teamName: 'FC Demoheim · U12 · fiktiv', dateIso,
    }));
    printWindow.document.close();
    setMessage('A4-Handout geöffnet. Dort „Drucken / PDF speichern“ wählen.');
  }
  async function downloadDocumentation() {
    setExporting(true); setMessage('Beispiel-PDF wird erstellt …');
    try {
      const { createTrainingExamPdf, downloadBlob } = await import('../../lib/trainingExamPdfExport');
      const blob = await createTrainingExamPdf({
        trainerName: 'Markus Beispiel · DEMO', sessions: [{
          session, items: ordered, exerciseMap, sketchUrls: DEMO_DESKTOP_SKETCHES,
          examFocus: `DEMO – ${session.title.slice(0, 40)} · ${total} Min.`, examTeamName: 'FC Demoheim U12 (fiktiv)',
          examDateIso: dateIso, examNumber: 1,
        }],
      });
      downloadBlob(blob, 'SpielzeitApp_DEMO_Trainerdokumentation.pdf');
      setMessage('Beispiel-Trainerdoku als PDF erstellt. Kein offizieller Ausbildungsnachweis.');
    } catch {
      setMessage('Die Beispiel-PDF konnte nicht erstellt werden. Bitte erneut versuchen.');
    } finally { setExporting(false); }
  }
  function showLibrary(target?: TrainingPhase, replaceId?: string) {
    setPicker(target ? { phase: target, replaceId } : null); setSearch(''); setPhase(''); setView('library');
  }
  function exerciseCard(item: TrainingSessionExerciseRow, readOnly = false) {
    const group = ordered.filter(i => i.phase === item.phase);
    const pos = group.findIndex(i => i.id === item.id);
    return <TrainingSessionExerciseCard key={item.id} item={item} exercise={exerciseMap[item.exercise_id]} sketchUrl={DEMO_DESKTOP_SKETCHES[item.exercise_id]}
      onView={() => setDetail(item.exercise_id)} onEdit={() => setEdit({ item: { ...item }, exercise: { ...exerciseMap[item.exercise_id] } })}
      onReplace={() => showLibrary(item.phase, item.id)} onRemove={() => { changeItems(items.filter(i => i.id !== item.id)); setMessage('Übung aus dem Demoplan entfernt. Du kannst sie aus der Bibliothek wieder hinzufügen.'); }}
      onDurationChange={value => updateItem(item.id, { duration_minutes: Math.max(1, Math.min(300, Math.round(value) || 1)) })}
      onNotesChange={coach_notes => updateItem(item.id, { coach_notes })} onMoveUp={() => moveItem(item.id, -1)} onMoveDown={() => moveItem(item.id, 1)}
      canMoveUp={pos > 0} canMoveDown={pos < group.length - 1} readOnly={readOnly} />;
  }

  return <div className="manager-shell demo-trainer-desktop">
    <aside className="dtd-sidebar" aria-label="Trainer-Desktopdemo">
      <Link to="/demo/desktop" className="dtd-brand" onClick={() => setView('overview')}><img src="/manager-icon-192.png" alt="" /><span>Spielzeit<span className="dtd-brand-accent">Manager</span></span></Link>
      <div className="dtd-sidebar-label">TRAINER · DEMO</div>
      <nav>{views.map(({ id, label, Icon }) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => { setPicker(null); setView(id); }}><Icon size={19} aria-hidden />{label}</button>)}</nav>
      <div className="dtd-sidebar-bottom"><p>In Ruhe planen.<br /><strong>Am Platz bereit.</strong></p><Link to="/demo/home"><Smartphone size={17} aria-hidden />Zur App-Demo</Link></div>
    </aside>
    <div className="dtd-workspace">
      <header className="dtd-header"><div><strong>FC Demoheim · U12</strong><span>Saison 2026/27 · fiktives Demoteam</span></div><span className="dtd-badge"><Monitor size={15} aria-hidden />Desktop-Demo</span><button type="button" className="dtd-button" onClick={() => setResetOpen(true)}><RotateCcw size={16} aria-hidden /><span>Zurücksetzen</span></button></header>
      <div className="dtd-sandbox">Ohne Anmeldung ausprobieren. Nur fiktive Beispiele. Änderungen bleiben in dieser Sitzung und werden beim Neuladen zurückgesetzt.</div>
      <main className="dtd-main">
        <div className="dtd-page-heading"><div><p className="dtd-kicker">DEIN TRAINERARBEITSPLATZ</p><h1 ref={heading} tabIndex={-1}>{view === 'pitch' ? 'Dein Plan am Platz' : views.find(v => v.id === view)?.label}</h1></div>{view !== 'overview' && <span className="dtd-status">{total} Minuten · {items.length} Übungen</span>}</div>
        <div role="status" className="dtd-message">{message}</div>

        {view === 'overview' && <>
          <section className="dtd-welcome"><div><p className="dtd-kicker">FÜR TRAINER GEMACHT</p><h2>Weniger vorbereiten müssen.<br />Besser vorbereitet sein.</h2><p>Probiere aus, wie du Übungen auswählst, eine Einheit zusammenstellst und deinen Plan zum Training mitnimmst.</p><button type="button" className="dtd-button dtd-primary" onClick={() => setView('plan')}>Trainingsplan ausprobieren <ClipboardList size={18} aria-hidden /></button></div><div className="dtd-training-summary"><CalendarDays size={26} aria-hidden /><span>NÄCHSTES DEMOTRAINING</span><h3>Dienstag, 20. Oktober</h3><p>17:00 Uhr · Demoplatz 1<br />12 fiktive Teilnehmende · U12</p><strong>{session.title}</strong><small>{total} Minuten · {items.length} Übungen vorbereitet</small></div></section>
          <section className="dtd-feature-grid" aria-label="In drei Schritten vorbereitet">{[
            { n: '01', title: 'Übungen finden', text: 'Sechs fiktive Beispielübungen mit Aufbau, Material und Coachingpunkten.', action: 'Bibliothek öffnen', target: 'library' as View, Icon: BookOpen },
            { n: '02', title: 'Einheit gestalten', text: 'Dauer, Phasen und Notizen ändern. Übungen hinzufügen oder austauschen.', action: 'Training planen', target: 'plan' as View, Icon: ClipboardList },
            { n: '03', title: 'Am Platz verwenden', text: 'Deinen bearbeiteten Demoplan kompakt ansehen oder als A4-Handout ausgeben.', action: 'Platzansicht öffnen', target: 'pitch' as View, Icon: Smartphone },
          ].map(({ n, title, text, action, target, Icon }) => <article key={n} className="dtd-panel"><span className="dtd-step">{n}</span><Icon size={24} aria-hidden /><h3>{title}</h3><p>{text}</p><button type="button" className="dtd-text-button" onClick={() => setView(target)}>{action} →</button></article>)}</section>
          <p className="dtd-footnote">Diese Demo zeigt den Trainerbereich. Vereinsverwaltung, echte Einladungen und das Veröffentlichen an eine Mannschaft sind hier nicht aktiv.</p>
        </>}

        {view === 'plan' && <>
          <section className="dtd-panel"><div className="dtd-form-grid"><label>Trainingstitel<input maxLength={90} value={session.title} onChange={e => setSession(s => ({ ...s, title: e.target.value, status: 'draft' }))} /></label><label>Trainingsziel<textarea maxLength={300} rows={2} value={session.objective ?? ''} onChange={e => setSession(s => ({ ...s, objective: e.target.value, status: 'draft' }))} /></label></div>
            <div className="dtd-toolbar"><span className={`dtd-status ${session.status === 'ready' ? 'is-ready' : ''}`}>{session.status === 'ready' ? 'Lokal als bereit markiert' : 'Demoplan · Entwurf'}</span><button type="button" className="dtd-button" disabled={!items.length} onClick={printHandout}><Download size={17} aria-hidden />A4 / PDF</button><button type="button" className="dtd-button" onClick={() => setView('pitch')}><Smartphone size={17} aria-hidden />Platzansicht</button><button type="button" className="dtd-button dtd-primary" disabled={!items.length || !session.title.trim()} onClick={() => { setSession(s => ({ ...s, status: 'ready' })); setMessage('Demoplan lokal bereit. Kein Versand und keine Freigabe an ein echtes Team.'); }}><Check size={17} aria-hidden />Lokal bereit markieren</button></div>
          </section>
          {TRAINING_PHASES.map(p => <section key={p} className="dtd-phase"><div className="dtd-phase-heading"><h2>{TRAINING_PHASE_LABELS[p]}</h2><span>{ordered.filter(i => i.phase === p).reduce((sum, i) => sum + i.duration_minutes, 0)} Min.</span><button type="button" className="dtd-button" onClick={() => showLibrary(p)}><Plus size={17} aria-hidden />Übung hinzufügen<span className="sr-only">: {TRAINING_PHASE_LABELS[p]}</span></button></div><div className="dtd-exercise-list">{ordered.filter(i => i.phase === p).map(i => exerciseCard(i))}{!ordered.some(i => i.phase === p) && <p className="dtd-empty">Noch keine Übung in dieser Phase. Wähle eine aus der Bibliothek.</p>}</div></section>)}
        </>}

        {view === 'library' && <>
          <section className="dtd-panel"><p className="dtd-intro">{picker ? `Übung ${picker.replaceId ? 'austauschen' : 'hinzufügen'} · ${TRAINING_PHASE_LABELS[picker.phase]}. Alle Beispiele lassen sich im Plan anpassen.` : 'Sechs fiktive Übungen zum Ausprobieren – keine echte Vereinsbibliothek.'}</p><div className="dtd-library-filters"><label>Übung suchen<input type="search" placeholder="z. B. Passen oder Dribbeln" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Phase<select value={phase} onChange={e => setPhase(e.target.value as TrainingPhase | '')}><option value="">Alle Phasen</option>{TRAINING_PHASES.map(p => <option key={p} value={p}>{TRAINING_PHASE_LABELS[p]}</option>)}</select></label>{picker && <button type="button" className="dtd-button" onClick={() => { setPicker(null); setView('plan'); }}>Auswahl abbrechen</button>}</div></section>
          <div className="dtd-library-grid">{shown.map(exercise => <article className="dtd-panel dtd-library-card" key={exercise.id}><button type="button" className="dtd-sketch-button" onClick={() => setDetail(exercise.id)} aria-label={`${exercise.title} ansehen`}><img src={DEMO_DESKTOP_SKETCHES[exercise.id]} alt="Schematische Beispielskizze" /></button><p className="dtd-kicker">{EXERCISE_FOCUS_LABELS[exercise.focus]} · U12 · {exercise.duration_minutes} MIN.</p><h2>{exercise.title}</h2><p>{exercise.description}</p><div className="dtd-toolbar"><button type="button" className="dtd-button" onClick={() => setDetail(exercise.id)}>Details</button><button type="button" className="dtd-button dtd-primary" onClick={() => chooseExercise(exercise)}><Plus size={16} aria-hidden />{picker?.replaceId ? 'Austauschen' : 'Zum Demoplan'}</button></div></article>)}</div>{!shown.length && <p className="dtd-empty">Keine Übung gefunden. Ändere den Suchbegriff oder die Phase.</p>}
        </>}

        {view === 'documentation' && <section className="dtd-panel dtd-documentation"><FileText size={36} aria-hidden /><p className="dtd-kicker">VOM TRAININGSPLAN ZUR DOKUMENTATION</p><h2>Deine Einheit. Übersichtlich als PDF.</h2><p>Die aktuell bearbeitete Demo-Einheit wird mit Übungen, Minuten, Material und Coachingpunkten in die vorhandene D-Diplom-PDF-Vorlage übernommen.</p><div className="dtd-doc-summary"><strong>{session.title || 'Trainingseinheit'}</strong><span>Markus Beispiel · FC Demoheim U12 · 20.10.2026</span><span>{items.length} Übungen · {total} Minuten · rein fiktiv</span></div><button type="button" className="dtd-button dtd-primary" disabled={exporting || !items.length} onClick={() => void downloadDocumentation()}><Download size={18} aria-hidden />{exporting ? 'PDF wird erstellt …' : 'Beispiel-Trainerdoku herunterladen'}</button><p className="dtd-footnote">Ein Beispiel im D-Diplom-Layout, kein offizieller Ausbildungsnachweis und keine Zusage zur Anerkennung. Weitere Lizenzstufen und eine vollständige Ausbildungsdokumentation sind nicht Teil dieser Demo.</p></section>}

        {view === 'pitch' && <><div className="dtd-toolbar"><p>Vorschau deines lokalen Plans am Platz – keine Synchronisierung mit einem echten Team.</p><button type="button" className="dtd-button" onClick={() => setView('plan')}>Zurück zum Bearbeiten</button><button type="button" className="dtd-button" disabled={!items.length} onClick={printHandout}><Download size={17} aria-hidden />A4 / PDF</button></div><div className="dtd-pitch"><div className="dtd-pitch-header"><Smartphone aria-hidden /><p>FC Demoheim · U12 · DEMO</p><h2>{session.title}</h2><p>{session.objective}</p><strong>{total} Minuten</strong></div>{ordered.map(i => exerciseCard(i, true))}{!items.length && <p className="dtd-empty">Füge deinem Plan zuerst eine Übung hinzu.</p>}</div></>}
      </main>
    </div>
    {activeExercise && <TrainingExerciseDetailModal row={activeExercise} sketchUrl={DEMO_DESKTOP_SKETCHES[activeExercise.id]} onClose={() => setDetail(null)} />}
    <Modal open={Boolean(edit)} title="Übung im Demoplan anpassen" onClose={() => setEdit(null)} className="dtd-modal" footer={<button type="button" className="dtd-button dtd-primary" onClick={() => { if (!edit) return; setExercises(exercises.map(e => e.id === edit.exercise.id ? edit.exercise : e)); updateItem(edit.item.id, { phase: edit.item.phase }); setEdit(null); setMessage('Anpassung nur im lokalen Demoplan übernommen.'); }}>Lokal übernehmen</button>}>
      {edit && <div className="dtd-edit-form"><label>Titel<input maxLength={90} value={edit.exercise.title} onChange={e => setEdit({ ...edit, exercise: { ...edit.exercise, title: e.target.value } })} /></label><label>Aufbau & Ablauf<textarea maxLength={500} rows={4} value={edit.exercise.description ?? ''} onChange={e => setEdit({ ...edit, exercise: { ...edit.exercise, description: e.target.value, short_content: e.target.value } })} /></label><label>Material<input maxLength={100} value={edit.exercise.materials ?? ''} onChange={e => setEdit({ ...edit, exercise: { ...edit.exercise, materials: e.target.value, short_materials: e.target.value } })} /></label><label>Coachingpunkte<textarea maxLength={220} rows={3} value={edit.exercise.coaching_points ?? ''} onChange={e => setEdit({ ...edit, exercise: { ...edit.exercise, coaching_points: e.target.value, short_coaching: e.target.value } })} /></label><label>Trainingsphase<select value={edit.item.phase} onChange={e => setEdit({ ...edit, item: { ...edit.item, phase: e.target.value as TrainingPhase } })}>{TRAINING_PHASES.map(p => <option key={p} value={p}>{TRAINING_PHASE_LABELS[p]}</option>)}</select></label></div>}
    </Modal>
    <Modal open={resetOpen} title="Demo zurücksetzen?" onClose={() => setResetOpen(false)} className="dtd-modal" footer={<div className="dtd-toolbar"><button type="button" className="dtd-button" onClick={() => setResetOpen(false)}>Abbrechen</button><button type="button" className="dtd-button dtd-primary" onClick={reset}>Beispiel wiederherstellen</button></div>}><p>Deine lokalen Änderungen werden verworfen. Die fiktive Beispielplanung wird wiederhergestellt. Echte Daten sind nicht betroffen.</p></Modal>
  </div>;
}
