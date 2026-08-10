import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createVenue,
  formatVenueAddressLine,
  getVenueById,
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
  setPreferredOpponentVenue,
  setPreferredTeamVenue,
  unlinkVenueFromOpponent,
  unlinkVenueFromTeam,
  venueHasAddress,
  type VenueCandidate,
} from '../../lib/teamVenues';
import { listAllowedTrainingVenueRows } from '../../lib/teamSeasonTrainingVenues';

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
  /**
   * training = nur freigegebene Trainingsanlagen (PLATZ.5).
   * general = Club-Katalog (Spiele/Turniere/Events).
   */
  purpose?: 'training' | 'general';
  labelClass?: string;
  inputClass?: string;
  disabled?: boolean;
  /**
   * Meisterschafts-Editor: kein Freitext-Block im Leerzustand;
   * CTA „+ Spielort hinzufügen“ öffnet erst das Create-Form.
   */
  compactEmptyState?: boolean;
};

type FormMode = 'closed' | 'create' | 'edit';

type VenueFormDraft = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  latitude: string;
  longitude: string;
  isHome: boolean;
  isDefault: boolean;
};

function addressLine(v: VenueRow): string {
  return formatVenueAddressLine(v);
}

function draftFromVenue(v: VenueRow, isDefault = false): VenueFormDraft {
  return {
    name: v.name ?? '',
    address: v.address ?? '',
    postalCode: v.postal_code ?? '',
    city: v.city ?? '',
    latitude: v.latitude != null ? String(v.latitude) : '',
    longitude: v.longitude != null ? String(v.longitude) : '',
    isHome: v.is_home === true,
    isDefault,
  };
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
  purpose = 'general',
  labelClass = 'mb-1 block text-sm font-medium text-white/80',
  inputClass = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-red-500/45 focus:outline-none',
  disabled = false,
  compactEmptyState = false,
}: Props): React.ReactElement {
  const [clubId, setClubId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<VenueCandidate[]>([]);
  const [catalog, setCatalog] = useState<VenueRow[]>([]);
  const [resolvedSelected, setResolvedSelected] = useState<VenueRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [trainingEmptyReason, setTrainingEmptyReason] = useState<'none_assigned' | 'migration' | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  /** Nur im Edit-Modus gesetzt — Source of Truth für UPDATE. */
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rememberOpponent, setRememberOpponent] = useState(true);
  const [rememberHome, setRememberHome] = useState(true);
  const autoSelectedForKey = useRef<string>('');
  const [draft, setDraft] = useState<VenueFormDraft>({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    latitude: '',
    longitude: '',
    isHome: false,
    isDefault: false,
  });

  const isMatchHome = matchContext?.isHome === true;
  const isMatchAway = matchContext?.isHome === false;
  const opponentName = (matchContext?.opponentName ?? '').trim();
  const isTrainingPurpose = purpose === 'training';

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
    if (resolvedSelected && !byId.has(resolvedSelected.id)) {
      byId.set(resolvedSelected.id, {
        ...resolvedSelected,
        link_id: null,
        is_default: false,
        source: 'catalog',
      });
    }
    return Array.from(byId.values());
  }, [preferred, catalog, resolvedSelected]);

  const selectedVenue = useMemo(() => {
    if (!venueId) return null;
    return allSelectable.find((v) => v.id === venueId) ?? resolvedSelected;
  }, [allSelectable, venueId, resolvedSelected]);

  const closeForm = () => {
    setFormMode('closed');
    setEditingVenueId(null);
    setFormError(null);
  };

  const openCreateForm = () => {
    setFormMode('create');
    setEditingVenueId(null);
    setFormError(null);
    setRememberHome(true);
    setRememberOpponent(true);
    setDraft({
      name: locationName.trim() || '',
      address: locationAddress.trim() || '',
      postalCode: '',
      city: '',
      latitude: '',
      longitude: '',
      isHome: isMatchHome,
      isDefault: preferred.length === 0,
    });
  };

  const openEditForm = (venue: VenueRow) => {
    setFormMode('edit');
    setEditingVenueId(venue.id);
    setFormError(null);
    setDraft(draftFromVenue(venue, preferred.some((p) => p.id === venue.id && p.is_default)));
  };

  const reload = async (opts?: { skipAutoSelect?: boolean }) => {
    if (!teamSeasonId) {
      setPreferred([]);
      setCatalog([]);
      setClubId(null);
      setTeamId(null);
      setTrainingEmptyReason(null);
      return;
    }
    setLoading(true);
    const resolved = await resolveClubIdForTeamSeason(teamSeasonId);
    setClubId(resolved.clubId);
    setTeamId(resolved.teamId);
    if (!resolved.clubId) {
      setPreferred([]);
      setCatalog([]);
      setTrainingEmptyReason(null);
      setLoading(false);
      return;
    }

    if (isTrainingPurpose) {
      const allowed = await listAllowedTrainingVenueRows(teamSeasonId);
      setCatalog(allowed.data);
      setPreferred([]);
      setTrainingEmptyReason(allowed.emptyReason);
      setLoading(false);
      if (opts?.skipAutoSelect) return;
      const autoKey = `training:${teamSeasonId}`;
      if (allowed.data.length === 1 && !venueId && autoSelectedForKey.current !== autoKey) {
        autoSelectedForKey.current = autoKey;
        const only = allowed.data[0];
        onVenueChange(only);
        onLocationNameChange(only.name);
        onLocationAddressChange(addressLine(only));
      } else if (
        allowed.data.length > 1 &&
        !venueId &&
        autoSelectedForKey.current !== autoKey
      ) {
        autoSelectedForKey.current = autoKey;
        const first = allowed.data[0];
        onVenueChange(first);
        onLocationNameChange(first.name);
        onLocationAddressChange(addressLine(first));
      }
      return;
    }

    setTrainingEmptyReason(null);
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
  }, [teamSeasonId, isMatchHome, isMatchAway, opponentName, isTrainingPurpose]);

  useEffect(() => {
    let cancelled = false;
    if (!venueId) {
      setResolvedSelected(null);
      return;
    }
    const fromLists =
      preferred.find((v) => v.id === venueId) ?? catalog.find((v) => v.id === venueId) ?? null;
    if (fromLists) {
      setResolvedSelected(fromLists);
      return;
    }
    void (async () => {
      const res = await getVenueById(venueId);
      if (cancelled) return;
      setResolvedSelected(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [venueId, preferred, catalog]);

  const selectValue = venueId ?? (locationName.trim() ? '__custom__' : '');

  const handleSelect = (value: string) => {
    closeForm();
    if (!value) {
      onVenueChange(null);
      return;
    }
    if (value === '__custom__') {
      onVenueChange(null);
      return;
    }
    if (value === '__new__') {
      openCreateForm();
      return;
    }
    const found = allSelectable.find((v) => v.id === value) ?? null;
    if (found) {
      onVenueChange(found);
      onLocationNameChange(found.name);
      onLocationAddressChange(addressLine(found));
      setResolvedSelected(found);
      return;
    }
    void (async () => {
      const res = await getVenueById(value);
      if (res.data) {
        onVenueChange(res.data);
        onLocationNameChange(res.data.name);
        onLocationAddressChange(addressLine(res.data));
        setResolvedSelected(res.data);
      } else {
        onVenueChange(null);
      }
    })();
  };

  const applyVenueToParent = (venue: VenueRow) => {
    onVenueChange(venue);
    onLocationNameChange(venue.name);
    onLocationAddressChange(addressLine(venue));
    setResolvedSelected(venue);
  };

  const handleSave = async () => {
    setFormError(null);
    const name = draft.name.trim();
    if (!name) {
      setFormError('Name ist Pflicht.');
      return;
    }

    // EDIT: immer UPDATE auf bestehende ID — nie INSERT.
    if (formMode === 'edit') {
      if (!editingVenueId) {
        setFormError('Kein Spielort zum Bearbeiten gewählt.');
        return;
      }
      setSaving(true);
      const res = await updateVenue(editingVenueId, {
        name,
        address: draft.address,
        postalCode: draft.postalCode,
        city: draft.city,
        isHome: draft.isHome,
      });
      setSaving(false);
      if (res.error || !res.data) {
        setFormError(res.error ?? 'Speichern fehlgeschlagen.');
        return;
      }
      applyVenueToParent(res.data);
      closeForm();
      await reload({ skipAutoSelect: true });
      return;
    }

    // CREATE: nur INSERT.
    if (formMode !== 'create') return;
    if (!clubId) {
      setFormError('Club nicht gefunden.');
      return;
    }
    setSaving(true);
    const res = await createVenue({
      clubId,
      teamId: isMatchHome ? teamId : null,
      name,
      address: draft.address,
      postalCode: draft.postalCode,
      city: draft.city,
      isHome: draft.isHome || isMatchHome,
    });
    if (res.error || !res.data) {
      setSaving(false);
      setFormError(res.error ?? 'Speichern fehlgeschlagen.');
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

    applyVenueToParent(res.data);
    closeForm();
    setSaving(false);
    await reload({ skipAutoSelect: true });
  };

  const handleRememberLink = async () => {
    if (!clubId || !selectedVenue) return;
    setSaving(true);
    setFormError(null);
    if (isMatchAway && opponentName) {
      const r = await linkVenueToOpponent({
        clubId,
        opponentName,
        venueId: selectedVenue.id,
        isDefault: preferred.length === 0,
      });
      if (r.error) setFormError(r.error);
    } else if (isMatchHome && teamId) {
      const r = await linkVenueToTeam({
        clubId,
        teamId,
        venueId: selectedVenue.id,
        isDefault: preferred.length === 0,
      });
      if (r.error) setFormError(r.error);
    }
    setSaving(false);
    await reload({ skipAutoSelect: true });
  };

  const handleUnlink = async () => {
    if (!clubId || !selectedVenue) return;
    setSaving(true);
    setFormError(null);
    if (isMatchAway && opponentName) {
      const r = await unlinkVenueFromOpponent({
        clubId,
        opponentName,
        venueId: selectedVenue.id,
      });
      if (r.error) {
        setSaving(false);
        setFormError(r.error);
        return;
      }
      onVenueChange(null);
    } else if (isMatchHome && teamId) {
      const r = await unlinkVenueFromTeam({
        clubId,
        teamId,
        venueId: selectedVenue.id,
      });
      if (r.error) {
        setSaving(false);
        setFormError(r.error);
        return;
      }
    }
    setSaving(false);
    await reload({ skipAutoSelect: true });
  };

  const handleSetPreferred = async () => {
    if (!clubId || !selectedVenue) return;
    setSaving(true);
    setFormError(null);
    if (isMatchAway && opponentName) {
      const r = await setPreferredOpponentVenue({
        clubId,
        opponentName,
        venueId: selectedVenue.id,
      });
      if (r.error) setFormError(r.error);
    } else if (isMatchHome && teamId) {
      const r = await setPreferredTeamVenue({
        clubId,
        teamId,
        venueId: selectedVenue.id,
      });
      if (r.error) setFormError(r.error);
    }
    setSaving(false);
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

  const trainingEmptyHint =
    isTrainingPurpose && !loading && trainingEmptyReason === 'none_assigned'
      ? 'Für diese Mannschaft ist noch keine Trainingsanlage freigegeben. Bitte den Jugendleiter oder Vereinsadmin kontaktieren.'
      : isTrainingPurpose && !loading && trainingEmptyReason === 'migration'
        ? 'Trainingsanlagen-Zuordnung ist noch nicht verfügbar.'
        : null;

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div>
        <label htmlFor="venue-picker-select" className={labelClass}>
          {isTrainingPurpose ? 'Trainingsanlage' : 'Spielort'}
        </label>
        <select
          id="venue-picker-select"
          className={inputClass}
          disabled={disabled || loading || !teamSeasonId || formMode !== 'closed'}
          value={selectValue}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">
            {isTrainingPurpose ? '— Anlage wählen —' : '— Kein Spielort —'}
          </option>
          {preferred.length > 0 ? (
            <optgroup label={groupLabel}>
              {preferred.map((v) => (
                <option key={`p-${v.id}`} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {catalog.filter((v) => !preferred.some((p) => p.id === v.id)).length > 0 ? (
            <optgroup label={isTrainingPurpose ? 'Freigegebene Anlagen' : 'Weitere Spielorte'}>
              {catalog
                .filter((v) => !preferred.some((p) => p.id === v.id))
                .map((v) => (
                  <option key={`c-${v.id}`} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </optgroup>
          ) : null}
          {!isTrainingPurpose ? (
            <>
              <option value="__custom__">Freitext (ohne Katalog)</option>
              <option value="__new__">Neuen Spielort anlegen…</option>
            </>
          ) : null}
        </select>
      </div>

      {trainingEmptyHint && formMode === 'closed' ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {trainingEmptyHint}
        </p>
      ) : null}

      {emptyAwayHint && formMode === 'closed' ? (
        <p className="text-xs text-amber-200/90">{emptyAwayHint}</p>
      ) : null}

      {formMode === 'closed' && !venueId && compactEmptyState && !isTrainingPurpose ? (
        <button
          type="button"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 text-[14px] font-semibold text-white/85 active:bg-white/[0.08]"
          onClick={openCreateForm}
          disabled={disabled || loading || !teamSeasonId}
        >
          + Spielort hinzufügen
        </button>
      ) : null}

      {formMode === 'closed' && !venueId && !compactEmptyState && !isTrainingPurpose ? (
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
      ) : null}

      {formMode === 'closed' && venueId ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          {selectedVenue ? (
            <>
              <p className="text-[15px] font-medium text-white/90">{selectedVenue.name}</p>
              {venueHasAddress(selectedVenue) ? (
                <p className="mt-0.5 text-[13px] text-white/55">{addressLine(selectedVenue)}</p>
              ) : (
                <p className="mt-0.5 text-[13px] text-amber-200/90">Adresse noch nicht vollständig</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 bg-white/[0.06] px-3 text-[14px] font-medium text-white/90 active:bg-white/[0.1]"
                  onClick={() => openEditForm(selectedVenue)}
                  disabled={disabled || saving}
                >
                  Spielort bearbeiten
                </button>
                {!linkedAlready && (isMatchAway || isMatchHome) ? (
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center px-2 text-[13px] text-white/65 underline-offset-2 hover:underline"
                    onClick={() => void handleRememberLink()}
                    disabled={disabled || saving}
                  >
                    {isMatchAway && opponentName
                      ? `Für ${opponentName} speichern`
                      : 'Für unser Team speichern'}
                  </button>
                ) : null}
                {linkedAlready && (isMatchAway || isMatchHome) ? (
                  <>
                    {!preferred.some((p) => p.id === selectedVenue.id && p.is_default) ? (
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center px-2 text-[13px] text-white/65 underline-offset-2 hover:underline"
                        onClick={() => void handleSetPreferred()}
                        disabled={disabled || saving}
                      >
                        Als bevorzugten Spielort markieren
                      </button>
                    ) : (
                      <span className="text-[12px] text-white/45">Bevorzugter Spielort</span>
                    )}
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center px-2 text-[13px] text-amber-200/90 underline-offset-2 hover:underline"
                      onClick={() => void handleUnlink()}
                      disabled={disabled || saving}
                    >
                      Zuordnung entfernen
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium text-white/90">
                {locationName.trim() || 'Spielort'}
              </p>
              <p className="mt-0.5 text-[13px] text-white/45">Spielort wird geladen…</p>
            </>
          )}
        </div>
      ) : null}

      {formMode === 'edit' || formMode === 'create' ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-sm font-medium text-white/85">
            {formMode === 'edit' ? 'Spielort bearbeiten' : 'Neuen Spielort anlegen'}
          </p>
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
          {formMode === 'create' ? (
            <>
              <label className="flex items-center gap-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={
                    isMatchAway
                      ? rememberOpponent
                      : isMatchHome
                        ? rememberHome
                        : draft.isHome
                  }
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (isMatchAway) {
                      setRememberOpponent(on);
                      setDraft((d) => ({ ...d, isDefault: on ? d.isDefault : false }));
                    } else if (isMatchHome) {
                      setRememberHome(on);
                      setDraft((d) => ({ ...d, isHome: on, isDefault: on ? d.isDefault : false }));
                    } else {
                      setDraft((d) => ({ ...d, isHome: on }));
                    }
                  }}
                  disabled={saving}
                />
                {isMatchAway && opponentName
                  ? `Für ${opponentName} speichern`
                  : isMatchHome
                    ? 'Für unser Team speichern'
                    : 'Heimspielort'}
              </label>
              {(isMatchAway ? rememberOpponent : isMatchHome ? rememberHome : draft.isHome) ? (
                <label className="flex items-center gap-2 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))}
                    disabled={saving}
                  />
                  {isMatchAway
                    ? 'Als bevorzugten Spielort verwenden'
                    : 'Als bevorzugten Heimspielort verwenden'}
                </label>
              ) : null}
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={draft.isHome}
                onChange={(e) => setDraft((d) => ({ ...d, isHome: e.target.checked }))}
                disabled={saving}
              />
              Heimspielort
            </label>
          )}
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-sm text-white/60 underline-offset-2 hover:underline"
              onClick={closeForm}
              disabled={saving}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void handleSave()}
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
