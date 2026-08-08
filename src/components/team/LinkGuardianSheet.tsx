import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  guardianDisplayLabel,
  linkPlayerGuardian,
  lookupParentAccountForPlayerLink,
  normalizeGuardianEmail,
} from '../../lib/playerGuardians';

type LinkGuardianSheetProps = {
  open: boolean;
  teamSeasonId: string;
  playerId: string;
  playerName: string;
  onClose: () => void;
  onLinked: (message: string) => void;
};

type Step = 'search' | 'confirm' | 'not_found';

export const LinkGuardianSheet: React.FC<LinkGuardianSheetProps> = ({
  open,
  teamSeasonId,
  playerId,
  playerName,
  onClose,
  onLinked,
}) => {
  const titleId = useId();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('search');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setStep('search');
    setBusy(false);
    setError(null);
    setFoundUserId(null);
    setFoundName(null);
    setFoundEmail(null);
  }, [open, playerId]);

  if (!open) return null;

  const handleSearch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await lookupParentAccountForPlayerLink({
      teamSeasonId,
      playerId,
      email,
    });
    setBusy(false);

    if (result.status === 'found' && result.userId) {
      setFoundUserId(result.userId);
      setFoundName(result.displayName);
      setFoundEmail(result.email ?? normalizeGuardianEmail(email));
      setStep('confirm');
      return;
    }
    if (result.status === 'not_found') {
      setStep('not_found');
      return;
    }
    setError(result.message ?? 'Suche fehlgeschlagen.');
  };

  const handleLink = async () => {
    if (busy || !foundUserId) return;
    setBusy(true);
    setError(null);
    const result = await linkPlayerGuardian({
      teamSeasonId,
      playerId,
      parentUserId: foundUserId,
    });
    setBusy(false);

    if (result.status === 'linked' || result.status === 'already_linked') {
      const parentLabel = guardianDisplayLabel(result.displayName ?? foundName, foundEmail);
      const playerLabel = playerName.trim() || 'Spieler';
      const msg =
        result.status === 'already_linked'
          ? `${parentLabel} ist bereits mit ${playerLabel} verknüpft.`
          : `${parentLabel} wurde mit ${playerLabel} verknüpft.`;
      onLinked(msg);
      onClose();
      return;
    }
    setError(result.message ?? 'Verknüpfung fehlgeschlagen.');
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Schließen"
        onClick={() => !busy && onClose()}
      />
      <div className="relative z-[1] w-full max-w-lg rounded-t-2xl border border-white/12 bg-[rgba(10,10,14,0.98)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] sm:rounded-2xl sm:px-5 sm:pb-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold text-white">
              Elternteil verknüpfen
            </h2>
            <p className="mt-0.5 text-[13px] text-white/55">
              Mit {playerName.trim() || 'Spieler'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70"
            aria-label="Dialog schließen"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {step === 'search' || step === 'not_found' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor={emailId} className="block text-[12px] font-semibold text-white/70">
                E-Mail-Adresse des Elternaccounts
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                disabled={busy}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  if (step === 'not_found') setStep('search');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="name@beispiel.at"
                className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-red-500/45"
              />
            </div>

            {step === 'not_found' ? (
              <div
                className="rounded-xl border border-amber-500/30 bg-amber-950/35 px-3 py-2.5 text-[13px] leading-relaxed text-amber-50/95"
                role="status"
              >
                <p className="font-semibold">
                  Zu dieser E-Mail-Adresse wurde noch kein SpielzeitApp-Account gefunden.
                </p>
                <p className="mt-1 text-amber-100/80">
                  Das Elternteil muss die Registrierung zuerst abschließen. Danach kannst du den
                  Account hier verknüpfen.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[13px] text-red-200" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy || normalizeGuardianEmail(email).length === 0}
              onClick={() => void handleSearch()}
              className={`w-full ${dsPrimaryCtaClass()} !min-h-[46px] disabled:opacity-50`}
            >
              {busy ? 'Suche…' : 'Account suchen'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={`w-full ${dsSecondaryCtaClass()} !min-h-[44px]`}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
              <p className="text-[15px] font-semibold text-white">
                {guardianDisplayLabel(foundName, foundEmail)}
              </p>
              {foundEmail ? (
                <p className="mt-0.5 truncate text-[13px] text-white/55">{foundEmail}</p>
              ) : null}
            </div>
            <p className="text-[14px] leading-relaxed text-white/80">
              Diesen Account mit{' '}
              <span className="font-semibold text-white">{playerName.trim() || 'Spieler'}</span>{' '}
              verknüpfen?
            </p>
            {error ? (
              <p className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[13px] text-red-200" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLink()}
              className={`w-full ${dsPrimaryCtaClass()} !min-h-[46px] disabled:opacity-50`}
            >
              {busy ? 'Verknüpfe…' : 'Verknüpfen'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('search');
                setError(null);
              }}
              className={`w-full ${dsSecondaryCtaClass()} !min-h-[44px]`}
            >
              Andere E-Mail
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
