import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, welcomeGreetingFromProfile } from '../auth/useProfile';

const logo = import.meta.env.BASE_URL + 'logos/nsg-goelsental.png';

const REMINDER_TEST_JOB_ID = '64dda57e-1545-4d94-96cd-79b6b039d7ef';

export const HomePage: React.FC = () => {
  const { session } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? null);
  const welcomeName = profileLoading ? '' : welcomeGreetingFromProfile(profile);
  const [reminderLoading, setReminderLoading] = useState(false);

  const runReminderTest = () => {
    setReminderLoading(true);
    fetch('/api/reminder-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: REMINDER_TEST_JOB_ID }),
    })
      .then(async (r) => {
        const text = await r.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        console.log('REMINDER RESPONSE status', r.status, r.ok);
        console.log('REMINDER RESULT', data);
        if (!r.ok) {
          console.error('REMINDER ERROR response', r.status, data);
        }
        return { ok: r.ok, data };
      })
      .then(({ ok }) => {
        if (ok) {
          alert('Reminder ausgelöst');
        } else {
          alert('Fehler beim Reminder (siehe Konsole)');
        }
      })
      .catch((err) => {
        console.error('REMINDER FETCH ERROR', err);
        alert('Fehler beim Reminder');
      })
      .finally(() => setReminderLoading(false));
  };

  return (
    <div
      className="page home-page relative flex min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-8"
      style={{
        background: 'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center gap-6 text-center">
        <p className="w-full text-center text-[10px] font-bold uppercase tracking-[0.25em] text-red-400">
          NAV UPDATE ACTIVE
        </p>
        <img
          src={logo}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full object-cover"
          width={64}
          height={64}
        />
        {welcomeName ? (
          <h1 className="text-xl font-bold text-white">Herzlich willkommen, {welcomeName}!</h1>
        ) : (
          <h1 className="text-xl font-bold text-white">Herzlich willkommen!</h1>
        )}
        <p className="text-sm text-white/90 sm:text-base">
          Spielplan, Spielzeiten und Infos für Eltern, Spieler und Fans.
        </p>

        <Link
          to="/schedule"
          className="flex h-14 w-full max-w-[320px] items-center justify-center rounded-xl bg-red-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-red-500 active:scale-[0.98]"
        >
          Spielplan öffnen
        </Link>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={runReminderTest}
            disabled={reminderLoading}
            className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50"
          >
            {reminderLoading ? 'Reminder …' : 'Reminder testen'}
          </button>
        )}

        <p className="text-center text-xs text-white/60">
          📲 Tipp: Zum Home-Bildschirm hinzufügen für App-Modus
        </p>
      </div>
    </div>
  );
};
