import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { useSession } from '../auth/useSession';
import { persistParentRoleChoice } from '../lib/parentChildLink';

export const RoleChoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { setPreviewRole } = useSession();
  const [savingRole, setSavingRole] = useState<'parent' | 'fan' | 'player' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseParent = async () => {
    setSavingRole('parent');
    setError(null);

    const { error: persistError } = await persistParentRoleChoice();
    if (persistError) {
      setError(persistError);
      setSavingRole(null);
      return;
    }

    setPreviewRole('parent');
    navigate('/app/parent-onboarding', { replace: true });
  };

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Wer bist du?</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              Bitte wähle aus, wie du SpielzeitApp verwenden möchtest.
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full"
                disabled={savingRole != null}
                onClick={() => {
                  void chooseParent();
                }}
              >
                {savingRole === 'parent' ? 'Speichere…' : 'Ich bin Elternteil'}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                disabled={savingRole != null}
                onClick={() => {
                  console.log('[ROLE CHOICE SELECT FAN]');
                  setPreviewRole('fan');
                  navigate('/app/fan-onboarding', { replace: true });
                }}
              >
                Ich bin Fan
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                disabled={savingRole != null}
                onClick={() => {
                  console.log('[ROLE CHOICE SELECT PLAYER]');
                  setPreviewRole('player');
                  navigate('/app/player-onboarding', { replace: true });
                }}
              >
                Ich bin Spieler
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
