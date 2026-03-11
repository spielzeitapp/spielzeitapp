import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';

type JoinRequestRow = {
  id: string;
  user_id: string;
  team_id: string;
  requested_role: 'parent' | 'player';
  child_name: string | null;
  player_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export const JoinRequestsAdminPage: React.FC = () => {
  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('join_requests')
      .select('id, user_id, team_id, requested_role, child_name, player_name, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setSavingId(id);
    setError(null);
    const { error } = await supabase
      .from('join_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      await load();
    }
    setSavingId(null);
  };

  return (
    <div className="page min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold text-white">Rollenanfragen (Parent/Player)</h1>
        <p className="text-sm text-white/70">
          Trainer/Admin sehen hier Anfragen für ihre Teams und können sie freigeben oder ablehnen.
        </p>
        <Card>
          <CardTitle>Anfragen</CardTitle>
          {loading ? (
            <p className="mt-3 text-sm text-white/60">Lade Anfragen…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">Keine Anfragen vorhanden.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      {r.requested_role === 'parent' ? 'Elternanfrage' : 'Spieleranfrage'}
                    </div>
                    <div className="mt-0.5 text-xs text-white/70">
                      user_id: {r.user_id}
                    </div>
                    <div className="mt-0.5 text-xs text-white/70">
                      team_id: {r.team_id}
                    </div>
                    {r.child_name && (
                      <div className="mt-0.5 text-xs text-white/70">
                        Kind: {r.child_name}
                      </div>
                    )}
                    {r.player_name && (
                      <div className="mt-0.5 text-xs text-white/70">
                        Spieler: {r.player_name}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-white/60">
                      Status: <span className="font-semibold">{r.status}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 sm:mt-0">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={savingId === r.id || r.status !== 'pending'}
                      onClick={() => updateStatus(r.id, 'approved')}
                    >
                      {savingId === r.id ? 'Speichere…' : 'Freigeben'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={savingId === r.id || r.status !== 'pending'}
                      onClick={() => updateStatus(r.id, 'rejected')}
                    >
                      Ablehnen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </Card>
      </div>
    </div>
  );
};

