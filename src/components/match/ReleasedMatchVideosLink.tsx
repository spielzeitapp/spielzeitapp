import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useSession } from '../../auth/useSession';
import { useInternalBasePath } from '../../demo/demoPaths';

export function ReleasedMatchVideosLink({ matchId, to, enabled = true, compact = false }: { matchId?: string | null; to: string; enabled?: boolean; compact?: boolean }) {
  const { user } = useSession();
  const basePath = useInternalBasePath();
  const [result, setResult] = useState<{ key: string; count: number } | null>(null);
  const key = `${user?.id ?? ''}:${matchId ?? ''}`;
  useEffect(() => {
    let active = true;
    if (!enabled || !matchId || !user || basePath === '/demo') return;
    const load = async () => {
      try {
        const { count, error } = await supabase.from('match_videos')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', matchId).eq('visibility', 'team');
        if (active) setResult({ key, count: error ? 0 : count ?? 0 });
      } catch { if (active) setResult({ key, count: 0 }); }
    };
    void load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [matchId, user?.id, key, enabled, basePath]);
  const count = result?.key === key ? result.count : 0;
  if (!enabled || !count || basePath === '/demo') return null;
  const [path, hash] = to.split('#');
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('tab', 'videos');
  const href = `${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
  return <Link to={href} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
    className={`mt-2 flex min-h-11 items-center justify-center rounded-xl border border-red-400/40 bg-red-950/60 font-bold text-white hover:bg-red-900/60 ${compact ? 'w-fit max-w-full gap-1.5 whitespace-nowrap px-2 py-1 text-xs' : 'w-full gap-2 px-3 py-2 text-sm'}`}
    aria-label={`Videos ansehen: ${count} freigegebene ${count === 1 ? 'Clip' : 'Clips'}`}>
    <Play size={compact ? 14 : 17} className="shrink-0" fill="currentColor" aria-hidden /> {compact ? 'Videos' : 'Videos ansehen'} · {count} {count === 1 ? 'Clip' : 'Clips'}
  </Link>;
}
