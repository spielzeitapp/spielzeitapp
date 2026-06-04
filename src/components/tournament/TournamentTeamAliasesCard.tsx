import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Tags, X } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { dsScheduleGlassButtonClass } from '../../lib/premiumDesignSystem';
import {
  addTeamSeasonAlias,
  deleteTeamSeasonAlias,
  loadTeamSeasonAliases,
  type TeamSeasonAliasRow,
} from '../../lib/teamSeasonAliases';

type Props = {
  teamSeasonId: string;
  canManage: boolean;
  /** Nach externem Hinzufügen (z. B. aus Import-Sheet) Liste neu laden */
  reloadToken?: number;
  onAliasesChanged?: () => void;
};

const inputClass =
  'min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

export const TournamentTeamAliasesCard: React.FC<Props> = ({
  teamSeasonId,
  canManage,
  reloadToken = 0,
  onAliasesChanged,
}) => {
  const [aliases, setAliases] = useState<TeamSeasonAliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!teamSeasonId) {
      setAliases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await loadTeamSeasonAliases(teamSeasonId);
    setLoading(false);
    setError(res.error);
    setAliases(res.data);
  }, [teamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload, reloadToken]);

  const handleAdd = async () => {
    const value = draftAlias.trim();
    if (!value || saving) return;
    setSaving(true);
    setError(null);
    const { error: err } = await addTeamSeasonAlias(teamSeasonId, value);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setDraftAlias('');
    await reload();
    onAliasesChanged?.();
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const { error: err } = await deleteTeamSeasonAlias(id);
    if (err) {
      setError(err);
      return;
    }
    await reload();
    onAliasesChanged?.();
  };

  if (!canManage) return null;

  return (
    <Card
      id="tournament-team-aliases"
      className="scroll-mt-28 border border-purple-500/20 bg-purple-950/15"
    >
      <div className="flex flex-col gap-3">
        <CardTitle className="!mb-0 flex items-center gap-2">
          <Tags className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
          Turnier-Aliase
        </CardTitle>
        <p className="text-[13px] text-white/60">
          Alternative Namen aus Turnierplänen (z. B. NSG Rohrbach, St. Veit), damit Importe unsere
          Mannschaft erkennen.
        </p>

        {error ? (
          <p className="text-[13px] text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-[14px] text-white/55">Lade Aliase…</p>
        ) : aliases.length === 0 ? (
          <p className="text-[14px] text-white/55">Noch keine Aliase hinterlegt</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {aliases.map((row) => (
              <span
                key={row.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-purple-500/30 bg-purple-950/40 px-2.5 py-1 text-[13px] font-medium text-white/90"
              >
                <span className="truncate">{row.alias}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-0.5 text-white/50 hover:text-red-300 touch-manipulation"
                  aria-label={`${row.alias} entfernen`}
                  onClick={() => void handleDelete(row.id)}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            value={draftAlias}
            onChange={(e) => setDraftAlias(e.target.value)}
            placeholder="z. B. NSG Rohrbach"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <button
            type="button"
            className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 px-4 touch-manipulation ${dsScheduleGlassButtonClass()}`}
            disabled={saving || !draftAlias.trim()}
            onClick={() => void handleAdd()}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Alias hinzufügen
          </button>
        </div>
      </div>
    </Card>
  );
};
