import React, { useEffect, useState } from 'react';
import {
  createVenue,
  listVenuesForClub,
  resolveClubIdForTeamSeason,
  type VenueRow,
} from '../../lib/venues';

type Props = {
  teamSeasonId: string | null;
  venueId: string | null;
  onVenueChange: (venue: VenueRow | null) => void;
  /** Fallback freitext wenn kein Venue */
  locationName: string;
  locationAddress: string;
  onLocationNameChange: (v: string) => void;
  onLocationAddressChange: (v: string) => void;
  labelClass?: string;
  inputClass?: string;
  disabled?: boolean;
};

export function VenuePicker({
  teamSeasonId,
  venueId,
  onVenueChange,
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
  labelClass = 'mb-1 block text-sm font-medium text-white/80',
  inputClass = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-red-500/45 focus:outline-none',
  disabled = false,
}: Props) {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    isHome: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (!teamSeasonId) {
      setVenues([]);
      setClubId(null);
      setTeamId(null);
      return;
    }
    setLoading(true);
    void (async () => {
      const resolved = await resolveClubIdForTeamSeason(teamSeasonId);
      if (cancelled) return;
      setClubId(resolved.clubId);
      setTeamId(resolved.teamId);
      if (!resolved.clubId) {
        setVenues([]);
        setLoading(false);
        return;
      }
      const listed = await listVenuesForClub(resolved.clubId);
      if (cancelled) return;
      setVenues(listed.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  const selectValue = venueId ?? (locationName.trim() ? '__custom__' : '');

  const handleSelect = (value: string) => {
    if (!value) {
      onVenueChange(null);
      return;
    }
    if (value === '__custom__') {
      onVenueChange(null);
      return;
    }
    if (value === '__new__') {
      setShowCreate(true);
      setDraft({
        name: locationName.trim() || '',
        address: locationAddress.trim() || '',
        postalCode: '',
        city: '',
        isHome: false,
      });
      setCreateError(null);
      return;
    }
    const found = venues.find((v) => v.id === value) ?? null;
    onVenueChange(found);
    if (found) {
      onLocationNameChange(found.name);
      const addr = [found.address, [found.postal_code, found.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
      onLocationAddressChange(addr);
    }
  };

  const handleCreate = async () => {
    if (!clubId) {
      setCreateError('Club nicht gefunden.');
      return;
    }
    setSaving(true);
    setCreateError(null);
    const res = await createVenue({
      clubId,
      teamId,
      name: draft.name,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
      isHome: draft.isHome,
    });
    setSaving(false);
    if (res.error || !res.data) {
      setCreateError(res.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    setVenues((prev) => {
      const next = [...prev.filter((v) => v.id !== res.data!.id), res.data!];
      next.sort((a, b) => Number(b.is_home) - Number(a.is_home) || a.name.localeCompare(b.name, 'de'));
      return next;
    });
    onVenueChange(res.data);
    onLocationNameChange(res.data.name);
    const addr = [res.data.address, [res.data.postal_code, res.data.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    onLocationAddressChange(addr);
    setShowCreate(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="venue-picker-select" className={labelClass}>
          Spielort
        </label>
        <select
          id="venue-picker-select"
          className={inputClass}
          disabled={disabled || loading || !teamSeasonId}
          value={selectValue}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">— Kein Spielort —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.is_home ? ' (Heim)' : ''}
            </option>
          ))}
          <option value="__custom__">Freitext (ohne Katalog)</option>
          <option value="__new__">Neuen Spielort anlegen…</option>
        </select>
      </div>

      {!venueId ? (
        <>
          <div>
            <label htmlFor="venue-fallback-name" className={labelClass}>
              Platzname / Ort (optional)
            </label>
            <input
              id="venue-fallback-name"
              type="text"
              className={inputClass}
              disabled={disabled}
              value={locationName}
              onChange={(e) => onLocationNameChange(e.target.value)}
              placeholder="z. B. Sportplatz Rohrbach"
            />
          </div>
          <div>
            <label htmlFor="venue-fallback-address" className={labelClass}>
              Adresse / PLZ / Ort (optional)
            </label>
            <input
              id="venue-fallback-address"
              type="text"
              className={inputClass}
              disabled={disabled}
              value={locationAddress}
              onChange={(e) => onLocationAddressChange(e.target.value)}
              placeholder="z. B. Sportplatzstraße 1, 3163 Rohrbach"
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-white/55">
          Adresse und Navigation kommen aus dem gespeicherten Spielort.
          {locationAddress ? ` ${locationAddress}` : ''}
        </p>
      )}

      {showCreate ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-sm font-medium text-white/85">Neuen Spielort anlegen</p>
          <input
            className={inputClass}
            placeholder="Name *"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            disabled={saving}
          />
          <input
            className={inputClass}
            placeholder="Adresse"
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              placeholder="PLZ"
              value={draft.postalCode}
              onChange={(e) => setDraft((d) => ({ ...d, postalCode: e.target.value }))}
              disabled={saving}
            />
            <input
              className={inputClass}
              placeholder="Ort"
              value={draft.city}
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
              disabled={saving}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={draft.isHome}
              onChange={(e) => setDraft((d) => ({ ...d, isHome: e.target.checked }))}
              disabled={saving}
            />
            Heimspielort
          </label>
          {createError ? <p className="text-sm text-red-300">{createError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-sm text-white/60 underline-offset-2 hover:underline"
              onClick={() => setShowCreate(false)}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void handleCreate()}
              disabled={saving || !draft.name.trim()}
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
