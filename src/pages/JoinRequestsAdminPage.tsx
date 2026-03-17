import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  team_name?: string | null;
};

export const JoinRequestsAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('join_requests')
      .select('id, user_id, team_id, requested_role, child_name, player_name, status, created_at, teams(name)')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        team_name: r.teams?.name ?? null,
      }));
      setRows(mapped as JoinRequestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setSavingId(id);
    setError(null);
    try {
      // Aktuelle Anfrage laden
      const { data: req, error: reqError } = await supabase
        .from('join_requests')
        .select('id, user_id, team_id, requested_role, status')
        .eq('id', id)
        .maybeSingle();

      if (reqError) {
        setError(reqError.message);
        setSavingId(null);
        return;
      }
      if (!req) {
        setError('Anfrage nicht gefunden.');
        setSavingId(null);
        return;
      }

      // Bei Ablehnen nur Status setzen
      if (status === 'rejected') {
        const { error: updateErr } = await supabase
          .from('join_requests')
          .update({ status: 'rejected' })
          .eq('id', id);
        if (updateErr) {
          setError(updateErr.message);
        } else {
          await load();
        }
        setSavingId(null);
        return;
      }

      // APPROVED: je nach Rolle Membership sicherstellen
      if (status === 'approved') {
        // team_seasons zum team_id holen
        const { data: tsRows, error: tsError } = await supabase
          .from('team_seasons')
          .select('id')
          .eq('team_id', req.team_id);

        if (tsError) {
          console.warn('[JOIN REQUESTS ADMIN] team_seasons lookup error', tsError);
        } else if (tsRows && tsRows.length > 0) {
          const roleToSet = req.requested_role === 'parent' ? 'parent' : 'player';
          // Für alle Saisons des Teams sicherstellen, dass Membership existiert
          for (const row of tsRows as { id: string }[]) {
            const teamSeasonId = row.id;
            const { error: memErr } = await supabase
              .from('memberships')
              .upsert(
                {
                  user_id: req.user_id,
                  team_season_id: teamSeasonId,
                  role: roleToSet,
                },
                { onConflict: 'user_id,team_season_id' }
              );
            if (memErr) {
              console.warn('[JOIN REQUESTS ADMIN] memberships upsert error', memErr);
            }
          }
        }

        // join_request auf approved setzen
        const { error: updateErr } = await supabase
          .from('join_requests')
          .update({ status: 'approved' })
          .eq('id', id);
        if (updateErr) {
          setError(updateErr.message);
        } else {
          await load();
        }
      }
    } catch (e: any) {
      console.error('[JOIN REQUESTS ADMIN] updateStatus exception', e);
      setError(e?.message ?? 'Unbekannter Fehler bei der Freigabe.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return rows;
    return rows.filter((r) => r.status === activeFilter);
  }, [rows, activeFilter]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);
  const approvedCount = useMemo(() => rows.filter((r) => r.status === 'approved').length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((r) => r.status === 'rejected').length, [rows]);

  return (
    <div className="page min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Rollenanfragen</h1>
            <p className="text-sm text-white/70">
              Trainer/Admin sehen hier Eltern- und Spieleranfragen und können sie freigeben oder ablehnen.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => navigate('/app/schedule')}
          >
            ← Zurück zu Termine
          </Button>
        </div>
        <Card>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { id: 'pending', label: 'Neu', count: pendingCount },
              { id: 'approved', label: 'Freigegeben', count: approvedCount },
              { id: 'rejected', label: 'Abgelehnt', count: rejectedCount },
              { id: 'all', label: 'Alle', count: rows.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as any)}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(248,113,113,0.6)]'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[10px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <CardTitle>Anfragen</CardTitle>
          {loading ? (
            <p className="mt-3 text-sm text-white/60">Lade Anfragen…</p>
          ) : filteredRows.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">
              {rows.length === 0
                ? 'Keine Anfragen vorhanden.'
                : activeFilter === 'pending'
                  ? 'Keine neuen Anfragen.'
                  : 'Keine Anfragen in diesem Filter.'}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {filteredRows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {r.requested_role === 'parent' ? 'Elternanfrage' : 'Spieleranfrage'}
                    </div>
                    <div className="mt-0.5 text-xs text-white/70">
                      Team: {r.team_name || 'Unbekannt'}
                    </div>
                    {r.requested_role === 'parent' && r.child_name && (
                      <div className="mt-0.5 text-xs text-white/70">
                        Kind: {r.child_name}
                      </div>
                    )}
                    {r.requested_role === 'player' && r.player_name && (
                      <div className="mt-0.5 text-xs text-white/70">
                        Spieler: {r.player_name}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-white/60">
                      Status:{' '}
                      <span
                        className={
                          r.status === 'pending'
                            ? 'font-semibold text-amber-300'
                            : r.status === 'approved'
                              ? 'font-semibold text-emerald-300'
                              : 'font-semibold text-red-300'
                        }
                      >
                        {r.status === 'pending'
                          ? 'Neu'
                          : r.status === 'approved'
                            ? 'Freigegeben'
                            : 'Abgelehnt'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      Erstellt am:{' '}
                      {new Date(r.created_at).toLocaleString('de-AT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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

