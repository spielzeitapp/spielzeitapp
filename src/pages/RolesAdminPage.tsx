import React from 'react';
import { RequireFeature } from '../auth/rbac';
import { Card, CardTitle } from '../app/components/ui/Card';

export const RolesAdminPage: React.FC = () => {
  return (
    <RequireFeature feature="roles_admin">
      <div className="space-y-3 pb-4">
        <h1 className="text-xl font-semibold">Rollenverwaltung</h1>
        <Card>
          <CardTitle>Rollen & Rechte</CardTitle>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Scaffold-Seite für die Rollen- und Rechteverwaltung. Head Coaches können hier später Rollen im Team
            anpassen.
          </p>
        </Card>
      </div>
    </RequireFeature>
  );
};

