<?php
declare(strict_types=1);

/**
 * Prüft JWT und lädt den User (inkl. Rolle).
 *
 * @return array{ id:string, email:string, display_name:string, role:string }
 */
function requireAuth(PDO $db): array
{
    $token = get_bearer_token();
    if ($token === null) {
        error_response(401, 'unauthorized', 'Authorization Bearer Token fehlt.');
        exit;
    }

    $payload = jwt_decode($token, JWT_SECRET);
    if ($payload === null || !isset($payload['sub'])) {
        error_response(401, 'invalid_token', 'Token ist ungültig oder abgelaufen.');
        exit;
    }

    $userId = (string)$payload['sub'];

    $stmt = $db->prepare('SELECT id, email, display_name, COALESCE(role, "viewer") AS role FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        error_response(401, 'user_not_found', 'Benutzer zu diesem Token existiert nicht mehr.');
        exit;
    }

    if (!isset($user['role'])) {
        $user['role'] = 'viewer';
    }

    return $user;
}

/**
 * Prüft, ob der Nutzer eine der globalen Rollen hat (z. B. admin).
 *
 * @param array{ id:string, role:string } $currentUser
 * @param string[] $allowedRoles
 */
function requireGlobalRole(array $currentUser, array $allowedRoles): void
{
    $role = $currentUser['role'] ?? 'viewer';
    if (!in_array($role, $allowedRoles, true)) {
        error_response(403, 'forbidden', 'Rolle hat keine Berechtigung für diese Aktion.');
        exit;
    }
}

/**
 * Prüft Zugriff auf eine Team-Saison (User muss Zugriff auf das Team haben und eine der Rollen).
 *
 * @param string[] $allowedRoles
 * @return array{ team_season: array, team_id: string }
 */
function requireTeamSeasonRole(PDO $db, string $teamSeasonId, array $allowedRoles, array $currentUser): array
{
    $stmt = $db->prepare('SELECT id, team_id, season_id, is_archived FROM team_seasons WHERE id = :id');
    $stmt->execute([':id' => $teamSeasonId]);
    $ts = $stmt->fetch();
    if (!$ts) {
        error_response(404, 'not_found', 'Team-Saison nicht gefunden.');
        exit;
    }
    requireTeamRole($db, (string)$ts['team_id'], $allowedRoles, $currentUser);
    return ['team_season' => $ts, 'team_id' => (string)$ts['team_id']];
}

/**
 * Prüft, ob der Nutzer in einem Team eine der angegebenen Rollen hat.
 *
 * @param string[] $allowedRoles
 */
function requireTeamRole(PDO $db, string $teamId, array $allowedRoles, array $currentUser): void
{
    $stmt = $db->prepare(
        'SELECT role FROM team_memberships WHERE team_id = :team_id AND user_id = :user_id AND status = "active"'
    );
    $stmt->execute([
        ':team_id' => $teamId,
        ':user_id' => $currentUser['id'],
    ]);

    $row = $stmt->fetch();
    if (!$row) {
        error_response(403, 'forbidden', 'Keine Mitgliedschaft für dieses Team.');
        exit;
    }

    $role = (string)$row['role'];
    if (!in_array($role, $allowedRoles, true)) {
        error_response(403, 'forbidden', 'Rolle hat keine Berechtigung für diese Aktion.');
        exit;
    }
}

