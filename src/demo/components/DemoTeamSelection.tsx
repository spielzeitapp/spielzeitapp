import React from 'react';
import { useNavigate } from 'react-router-dom';

export function DemoTeamSelection({ selected }: { selected: 'u12' | 'u13' }) {
  const navigate = useNavigate();
  return <label className="mb-5 block text-xs font-bold uppercase tracking-wider text-white/60">
    Demomannschaft
    <select value={selected} onChange={e => navigate(e.target.value === 'u13' ? '/demo/tabelle' : '/demo/spielplan')}
      className="mt-2 min-h-[44px] w-full rounded-xl border border-white/20 bg-[#101014] px-3 text-sm font-semibold normal-case tracking-normal text-white">
      <option value="u12">U12 · Team-App-Demo</option>
      <option value="u13">U13 · Tabellen-Demo</option>
    </select>
  </label>;
}
