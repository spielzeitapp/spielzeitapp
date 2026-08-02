import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createVenue,
  formatVenueAddressLine,
  listVenuesForClub,
  resolveClubIdForTeamSeason,
  updateVenue,
  type VenueRow,
} from '../../lib/venues';
import {
  isVenueLinkedToOpponent,
  isVenueLinkedToTeam,
  linkVenueToOpponent,
  linkVenueToTeam,
  resolveOpponentVenueCandidates,
  resolveTeamHomeVenueCandidates,
  venueHasAddress,
  type VenueCandidate,
} from '../../lib/teamVenues';

export type VenuePickerMatchContext = {
  /** true = Heim, false = Auswärts, null = kein Spiel-Kontext */
  isHome: boolean | null;
  opponentName: string;
};

type Props = {
  teamSeasonId: string | null;
  venueId: string | null;
  onVenueChange: (venue: VenueRow | null) => void;
  locationName: string;
  locationAddress: string;
  onLocationNameChange: (v: string) => void;
  onLocationAddressChange: (v: string) => void;
  /** Spiel-Kontext: Heim → Team-Venues, Auswärts → Gegner-Venues */
  matchContext?: VenuePickerMatchContext | null;
  labelClass?: string;
  inputClass?: string;
  disabled?: boolean;
};

function addressLine(v: VenueRow): string {
  return formatVenueAddressLine(v);
}

export function VenuePicker({
  teamSeasonId,
  venueId,
  onVenueChange,
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
  matchContext = null,
  labelClass = 'mb-1 block text-sm font-medium text-white/80',
  inputClass = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-red-500/45 focus:outline-none',
  disabled = false,
}: Props) {
  const [clubId, setClubId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<VenueCandidate[]>([]);
  const [catalog, setCatalog] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEditAddress, setShowEditAddress] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rememberOpponent, setRememberOpponent] = useState(true);
  const [rememberHome, setRememberHome] = useState(true);
  const autoSelectedForKey = useRef<string>('');
  const [draft, setDraft] = useState({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    isHome: false,
    isDefault: false,
  });
  const [editDraft, setEditDraft] = useState({
    address: '',
    postalCode: '',
    city: '',
  });

  const isMatchHome = matchContext?.isHome === true;
  const isMatchAway = matchContext?.isHome === false;
  const opponentName = (matchContext?.opponentName ?? '').trim();

  const allSelectable = useMemo(() => {
    const byId = new Map<string, VenueCandidate>();
    for (const v of preferred) {
      byId.set(v.id, v);
    }
    for (const v of catalog) {
      if (byId.has(v.id)) continue;
      byId.set(v.id, {
        ...v,
        link_id: null,
        is_default: false,
        source: 'catalog',
      });
    }
    return Array.from(byId.values());
  }, [preferred, catalog]);

  const selectedVenue = useMemo(
    () => allSelectable.find((v) => v.id === venueId) ?? null,
    [allSelectable, venueId],
  );

  const reload = async (opts?: { skipAutoSelect?: boolean }) => {
    if (!teamSeasonId) {
      setPreferred([]);
      setCatalog([]);
      setClubId(null);
      setTeamId(null);
      return;
    }
    setLoading(true);
    const resolved = await resolveClubIdForTeamSeason(teamSeasonId);
    setClubId(resolved.clubId);
    setTeamId(resolved.teamId);
    if (!resolved.clubId) {
      setPreferred([]);
      setCatalog([]);
      setLoading(false);
      return;
    }

    const listed = await listVenuesForClub(resolved.clubId);
    setCatalog(listed.data);

    let pref: VenueCandidate[] = [];
    if (isMatchHome && resolved.teamId) {
      const r = await resolveTeamHomeVenueCandidates({
        clubId: resolved.clubId,
        teamId: resolved.teamId,
      });
      pref = r.data;
    } else if (isMatchAway && opponentName) {
      const r = await resolveOpponentVenueCandidates({
        clubId: resolved.clubId,
        opponentName,
      });
      pref = r.data;
    }
    setPreferred(pref);
    setLoading(false);

    if (opts?.skipAutoSelect) return;

    const autoKey = `${isMatchHome ? 'home' : isMatchAway ? 'away' : 'any'}:${opponentName.toLowerCase()}`;
    if (pref.length === 1 && !venueId && autoSelectedForKey.current !== autoKey) {
      autoSelectedForKey.current = autoKey;
      const only = pref[0];
      onVenueChange(only);
      onLocationNameChange(only.name);
      onLocationAddressChange(addressLine(only));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await reload();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on context change
  }, [teamSeasonId, isMatchHome, isMatchAway, opponentName]);

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
        isHome: isMatchHome,
        isDefault: preferred.length === 0,
      });
      setCreateError(null);
      return;
    }
    const found = allSelectable.find((v) => v.id === value) ?? null;
    onVenueChange(found);
    if (found) {
      onLocationNameChange(found.name);
      onLocationAddressChange(addressLine(found));
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
      teamId: isMatchHome ? teamId : null,
      name: draft.name,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
      isHome: draft.isHome || isMatchHome,
    });
    if (res.error || !res.data) {
      setSaving(false);
      setCreateError(res.error ?? 'Speichern fehlgeschlagen.');
      return;
    }

    if (isMatchHome && teamId && rememberHome) {
      await linkVenueToTeam({
        clubId,
        teamId,
        venueId: res.data.id,
        isDefault: draft.isDefault,
      });
    }
    if (isMatchAway && opponentName && rememberOpponent) {
      await linkVenueToOpponent({
        clubId,
        opponentName,
        venueId: res.data.id,
        isDefault: draft.isDefault,
      });
    }

    onVenueChange(res.data);
    onLocationNameChange(res.data.name);
    onLocationAddressChange(addressLine(res.data));
    setShowCreate(false);
    setSaving(false);
    await reload({ skipAutoSelect: true });
  };

  const handleRememberLink = async () => {
    if (!clubId || !selectedVenue) return;
    setSaving(true);
    if (isMatchAway && opponentName) {
      await linkVenueToOpponent({
        clubId,
        opponentName,
        venueId: selectedVenue.id,
        isDefault: preferred.length === 0,
      });
    } else if (isMatchHome && teamId) {
      await linkVenueToTeam({
        clubId,
        teamId,
        venueId: selectedVenue.id,
        isDefault: preferred.length === 0,
      });
    }
    setSaving(false);
    await reload({ skipAutoSelect: true });
  };

  const handleSaveAddress = async () => {
    if (!selectedVenue) return;
    setSaving(true);
    setCreateError(null);
    const res = await updateVenue(selectedVenue.id, {
      address: editDraft.address,
      postalCode: editDraft.postalCode,
      city: editDraft.city,
    });
    setSaving(false);
    if (res.error || !res.data) {
      setCreateError(res.error ?? 'Adresse speichern fehlgeschlagen.');
      return;
    }
    onVenueChange(res.data);
    onLocationNameChange(res.data.name);
    onLocationAddressChange(addressLine(res.data));
    setShowEditAddress(false);
    await reload({ skipAutoSelect: true });
  };

  const [linkedAlready, setLinkedAlready] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!clubId || !venueId) {
        setLinkedAlready(true);
        return;
      }
      if (isMatchAway && opponentName) {
        const linked = await isVenueLinkedToOpponent({ clubId, opponentName, venueId });
        if (!cancelled) setLinkedAlready(linked);
        return;
      }
      if (isMatchHome && teamId) {
        const linked = await isVenueLinkedToTeam({ clubId, teamId, venueId });
        if (!cancelled) setLinkedAlready(linked);
        return;
      }
      if (!cancelled) setLinkedAlready(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, venueId, isMatchAway, isMatchHome, opponentName, teamId, preferred]);

  const groupLabel = isMatchHome
    ? 'Unsere Spielorte'
    : isMatchAway && opponentName
      ? `Bekannte Spielorte von ${opponentName}`
      : 'Bekannte Spielorte';

  const emptyAwayHint =
    isMatchAway && opponentName && preferred.length === 0 && !loading
      ? `Für ${opponentName} ist noch kein Spielort gespeichert.`
      : null;

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
          {preferred.length > 0 ? (
            <optgroup label={groupLabel}>
              {preferred.map((v) => (
                <option key={`p-${v.id}`} value={v.id}>
                  {v.name}
                  {v.is_default ? ' (Standard)' : v.is_home ? ' (Heim)' : ''}
                </option>
              ))}
            </optgroup>
          ) : null}
          {catalog.filter((v) => !preferred.some((p) => p.id === v.id)).length > 0 ? (
            <optgroup label="Weitere Spielorte">
              {catalog
                .filter((v) => !preferred.some((p) => p.id === v.id))
                .map((v) => (
                  <option key={`c-${v.id}`} value={v.id}>
                    {v.name}
                    {v.is_home ? ' (Heim)' : ''}
                  </option>
                ))}
            </optgroup>
          ) : null}
          <option value="__custom__">Freitext (ohne Katalog)</option>
          <option value="__new__">Neuen Spielort anlegen…</option>
        </select>
      </div>

      {emptyAwayHint ? <p className="text-xs text-amber-200/90">{emptyAwayHint}</p> : null}

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
      ) : selectedVenue ? (
        <div className="space-y-1.5">
          {venueHasAddress(selectedVenue) ? (
            <p className="text-xs text-white/55">{addressLine(selectedVenue)}</p>
          ) : (
            <p className="text-xs text-amber-200/90">⚠ Adresse fehlt</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              className="text-white/70 underline-offset-2 hover:underline"
              onClick={() => {
                setEditDraft({
                  address: selectedVenue.address ?? '',
                  postalCode: selectedVenue.postal_code ?? '',
                  city: selectedVenue.city ?? '',
                });
                setShowEditAddress(true);
                setCreateError(null);
              }}
              disabled={disabled || saving}
            >
              {venueHasAddress(selectedVenue) ? 'Adresse bearbeiten' : 'Adresse ergänzen'}
            </button>
            {!linkedAlready && (isMatchAway || isMatchHome) ? (
              <button
                type="button"
                className="text-white/70 underline-offset-2 hover:underline"
                onClick={() => void handleRememberLink()}
                disabled={disabled || saving}
              >
                {isMatchAway && opponentName
                  ? `Für ${opponentName} merken`
                  : 'Als Heimspielort merken'}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/55">
          Adresse und Navigation kommen aus dem gespeicherten Spielort.
          {locationAddress ? ` ${locationAddress}` : ''}
        </p>
      )}

      {showEditAddress && selectedVenue ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-sm font-medium text-white/85">Adresse ergänzen</p>
          <input
            className={inputClass}
            placeholder="Adresse"
            value={editDraft.address}
            onChange={(e) => setEditDraft((d) => ({ ...d, address: e.target.value }))}
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              placeholder="PLZ"
              value={editDraft.postalCode}
              onChange={(e) => setEditDraft((d) => ({ ...d, postalCode: e.target.value }))}
              disabled={saving}
            />
            <input
              className={inputClass}
              placeholder="Ort"
              value={editDraft.city}
              onChange={(e) => setEditDraft((d) => ({ ...d, city: e.target.value }))}
              disabled={saving}
            />
          </div>
          {createError ? <p className="text-sm text-red-300">{createError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-sm text-white/60 underline-offset-2 hover:underline"
              onClick={() => setShowEditAddress(false)}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void handleSaveAddress()}
              disabled={saving}
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      ) : null}

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
          {isMatchHome ? (
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={rememberHome}
                onChange={(e) => setRememberHome(e.target.checked)}
                disabled={saving}
              />
              Als Heimspielort merken
            </label>
          ) : null}
          {isMatchAway && opponentName ? (
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={rememberOpponent}
                onChange={(e) => setRememberOpponent(e.target.checked)}
                disabled={saving}
              />
              Für {opponentName} merken
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
              disabled={saving}
            />
            Standard-Spielort
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
