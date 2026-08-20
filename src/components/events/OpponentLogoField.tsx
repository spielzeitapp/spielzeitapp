import React, { useEffect, useRef, useState } from 'react';
import {
  lookupOpponentCatalogLogo,
  resolveDisplayOpponentLogo,
  setOpponentCatalogLogo,
  uploadOpponentLogoFile,
} from '../../lib/opponentCatalog';
import { isPlaceholderLogoUrl, PLACEHOLDER_LOGO } from '../../lib/teamLogos';
import { normalizeOpponentKey } from '../../lib/teamVenues';

type Props = {
  opponentName: string;
  clubId: string | null;
  /** Controlled logo URL (catalog / event / pending upload). */
  logoUrl: string | null;
  onLogoUrlChange: (url: string | null) => void;
  disabled?: boolean;
  /** Separate from form-level errors so upload failures do not wipe the form. */
  onUploadError?: (message: string | null) => void;
  className?: string;
};

/**
 * Gegnerlogo-Vorschau + Upload für normale Spiele (reuse opponent_catalog / opponent-logos).
 */
export function OpponentLogoField({
  opponentName,
  clubId,
  logoUrl,
  onLogoUrlChange,
  disabled = false,
  onUploadError,
  className,
}: Props): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const lastLookupKeyRef = useRef<string>('');

  const name = String(opponentName ?? '').trim();
  const key = normalizeOpponentKey(name);
  const hasStoredLogo = Boolean(logoUrl && !isPlaceholderLogoUrl(logoUrl));
  const previewSrc = resolveDisplayOpponentLogo({
    opponent: name,
    eventLogoUrl: logoUrl,
    catalogLogoUrl: logoUrl,
  });

  useEffect(() => {
    if (!clubId || !key) {
      lastLookupKeyRef.current = '';
      return;
    }
    if (lastLookupKeyRef.current === key) return;
    lastLookupKeyRef.current = key;
    let cancelled = false;
    void (async () => {
      const catalogUrl = await lookupOpponentCatalogLogo(clubId, name);
      if (cancelled) return;
      if (catalogUrl) {
        onLogoUrlChange(catalogUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, key, name, onLogoUrlChange]);

  const setError = (msg: string | null) => {
    setLocalError(msg);
    onUploadError?.(msg);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!clubId) {
      setError('Logo-Upload benötigt Club-Kontext (opponent_catalog).');
      return;
    }
    if (!name) {
      setError('Bitte zuerst den Gegner eintragen.');
      return;
    }
    setBusy(true);
    setError(null);
    const up = await uploadOpponentLogoFile({
      clubId,
      opponentName: name,
      file,
    });
    setBusy(false);
    if (up.error) {
      setError(up.error);
      return;
    }
    if (up.publicUrl) onLogoUrlChange(up.publicUrl);
  };

  const onRemove = async () => {
    if (!clubId || !name) {
      onLogoUrlChange(null);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await setOpponentCatalogLogo({
      clubId,
      displayName: name,
      logoUrl: null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onLogoUrlChange(null);
  };

  return (
    <div className={className ?? 'space-y-2'}>
      <p className="text-sm font-medium text-[var(--text-main)]">Gegnerlogo</p>
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={previewSrc || PLACEHOLDER_LOGO}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg bg-white/5 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
          }}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              disabled={disabled || busy || !clubId || !name}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[12px] font-semibold text-[var(--text-main)] disabled:opacity-50"
            >
              {busy ? 'Lädt…' : hasStoredLogo ? 'Logo ändern' : 'Gegnerlogo hochladen'}
            </button>
            {hasStoredLogo ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void onRemove()}
                className="text-[12px] font-medium text-white/60 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Logo entfernen
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-[var(--text-sub)]">
            Optional · PNG, JPG, WebP · max. 2&nbsp;MB. Wird für denselben Gegner wiederverwendet.
          </p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
      {localError ? (
        <p className="text-[12px] text-red-300" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
