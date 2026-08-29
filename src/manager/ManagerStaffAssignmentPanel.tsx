import React, { useState } from 'react';
import {
  adminAssignTeamSeasonStaff,
  managerLookupStaffUserByEmail,
  type AdminUserLookup,
} from '../lib/platformClubAdmin';

type TrainerRole = 'head_coach' | 'trainer' | 'co_trainer';

function displayName(user: AdminUserLookup): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name ? `${name} · ${user.email ?? ''}` : user.email ?? user.user_id ?? 'Benutzer';
}

export function ManagerStaffAssignmentPanel({
  teamSeasonId,
}: {
  teamSeasonId: string;
}): React.ReactElement {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TrainerRole>('trainer');
  const [lookup, setLookup] = useState<AdminUserLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function lookupUser() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setLookup(null);
    const result = await managerLookupStaffUserByEmail({
      teamSeasonId,
      email: email.trim(),
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.data?.user_id || result.data.status === 'not_found') {
      setError('Kein registrierter Benutzer mit dieser E-Mail gefunden.');
      return;
    }
    setLookup(result.data);
  }

  async function assignUser() {
    if (!lookup?.user_id || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await adminAssignTeamSeasonStaff({
      teamSeasonId,
      userId: lookup.user_id,
      role,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess('Trainerrolle wurde zugeordnet und protokolliert.');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Vereinsverwaltung
      </p>
      <h2 className="mt-1 text-[16px] font-semibold text-slate-900">Trainer zuordnen</h2>
      <p className="mt-1 text-[13px] text-slate-600">
        Suche einen registrierten Benutzer exakt per E-Mail und vergib eine Trainerrolle für diese
        Mannschaftssaison. Vereins- und Plattformadminrechte können hier nicht vergeben werden.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setLookup(null);
            setError(null);
            setSuccess(null);
          }}
          placeholder="trainer@verein.at"
          className="min-h-[42px] rounded-xl border border-slate-200 px-3 text-[13px]"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as TrainerRole)}
          className="min-h-[42px] rounded-xl border border-slate-200 px-3 text-[13px]"
        >
          <option value="head_coach">Cheftrainer</option>
          <option value="trainer">Trainer</option>
          <option value="co_trainer">Co-Trainer</option>
        </select>
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={() => void lookupUser()}
          className="min-h-[42px] rounded-xl border border-slate-300 px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
        >
          Suchen
        </button>
      </div>

      {lookup?.user_id ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-[13px] text-slate-700">{displayName(lookup)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void assignUser()}
            className="min-h-[40px] rounded-xl bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Speichere…' : 'Trainerrolle zuordnen'}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 text-[13px] text-emerald-700">{success}</p> : null}
    </section>
  );
}
