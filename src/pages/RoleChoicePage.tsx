import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { useSession } from '../auth/useSession';

export const RoleChoicePage: React.FC = () => {
  const navigate = useNavigate();
  const { setPreviewRole } = useSession();

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Wer bist du?</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              Bitte wähle aus, wie du SpielzeitApp verwenden möchtest.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  console.log('[ROLE CHOICE SELECT FAN]');
                  setPreviewRole('fan');
                  navigate('/app/schedule', { replace: true });
                }}
              >
                Ich bin Fan
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  console.log('[ROLE CHOICE SELECT PARENT]');
                  setPreviewRole('parent');
                  navigate('/app/parent-onboarding', { replace: true });
                }}
              >
                Ich bin Elternteil
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

