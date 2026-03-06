<?php
declare(strict_types=1);

// TEAMS: GET (list), POST (create) + TEAM PLAYERS (legacy by team_id)

$router->add('GET', '/api/v1/teams', function (array $params) use ($db) {
    $user = requireAuth($db);
    $stmt = $db->prepare(
        'SELECT t.id, t.name, t.short_name, t.created_at
         FROM teams t
         INNER JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = :user_id AND tm.status = "active"
         ORDER BY t.name'
    );
    $stmt->execute([':user_id' => $user['id']]);
    $list = [];
    while ($row = $stmt->fetch()) {
        $list[] = [
            'id'        => $row['id'],
            'name'      => $row['name'],
            'shortName' => $row['short_name'] ?? $row['name'],
            'createdAt' => $row['created_at'],
        ];
    }
    json_response(['teams' => $list]);
});

$router->add('POST', '/api/v1/teams', function (array $params) use ($db) {
    $user = requireAuth($db);
    requireGlobalRole($user, ['admin', 'head_coach']);
    $body = get_json_input();
    $name      = trim((string)($body['name'] ?? ''));
    $shortName = trim((string)($body['shortName'] ?? $name));
    if ($name === '') {
        error_response(400, 'validation_error', 'name ist Pflicht.');
        return;
    }
    $id = bin2hex(random_bytes(16));
    $stmt = $db->prepare(
        'INSERT INTO teams (id, name, short_name, created_at) VALUES (:id, :name, :short_name, NOW(3))'
    );
    $stmt->execute([':id' => $id, ':name' => $name, ':short_name' => $shortName ?: $name]);
    json_response([
        'team' => ['id' => $id, 'name' => $name, 'shortName' => $shortName ?: $name, 'createdAt' => date('Y-m-d\TH:i:s.v\Z')],
    ], 201);
});

$router->add('GET', '/api/v1/teams/:teamId/players', function (array $params) use ($db) {
    $teamId = $params['teamId'] ?? '';
    $user = requireAuth($db);

    // viewer+ dürfen lesen
    requireTeamRole($db, $teamId, ['viewer', 'coach', 'head_coach', 'admin'], $user);

    $stmt = $db->prepare(
        'SELECT id, first_name, last_name, display_name, shirt_number, active, created_at
         FROM players
         WHERE team_id = :team_id
         ORDER BY (shirt_number IS NULL), shirt_number, last_name, first_name'
    );
    $stmt->execute([':team_id' => $teamId]);
    $players = [];
    while ($row = $stmt->fetch()) {
        $players[] = [
            'id'          => $row['id'],
            'firstName'   => $row['first_name'],
            'lastName'    => $row['last_name'],
            'displayName' => $row['display_name'],
            'shirtNumber' => $row['shirt_number'] !== null ? (int)$row['shirt_number'] : null,
            'active'      => (int)$row['active'] === 1,
            'createdAt'   => $row['created_at'],
        ];
    }

    json_response(['players' => $players]);
});

$router->add('POST', '/api/v1/teams/:teamId/players', function (array $params) use ($db) {
    $teamId = $params['teamId'] ?? '';
    $user = requireAuth($db);

    // Nur trainer/admin dürfen schreiben
    requireTeamRole($db, $teamId, ['coach', 'head_coach', 'admin'], $user);

    $body = get_json_input();

    $firstName    = trim((string)($body['firstName'] ?? ''));
    $lastName     = trim((string)($body['lastName'] ?? ''));
    $displayName  = isset($body['displayName']) ? trim((string)$body['displayName']) : null;
    $shirtNumber  = $body['shirtNumber'] ?? null;

    if ($firstName === '' || $lastName === '') {
        error_response(400, 'validation_error', 'firstName und lastName sind Pflichtfelder.');
        return;
    }

    $shirtNumberInt = null;
    if ($shirtNumber !== null && $shirtNumber !== '') {
        if (!is_numeric($shirtNumber)) {
            error_response(400, 'validation_error', 'shirtNumber muss eine Zahl sein.');
            return;
        }
        $shirtNumberInt = (int)$shirtNumber;
    }

    $playerId = bin2hex(random_bytes(16));

    $stmt = $db->prepare(
        'INSERT INTO players (id, team_id, first_name, last_name, display_name, shirt_number, active, created_at)
         VALUES (:id, :team_id, :first_name, :last_name, :display_name, :shirt_number, 1, NOW(3))'
    );
    $stmt->execute([
        ':id'          => $playerId,
        ':team_id'     => $teamId,
        ':first_name'  => $firstName,
        ':last_name'   => $lastName,
        ':display_name'=> $displayName !== '' ? $displayName : null,
        ':shirt_number'=> $shirtNumberInt,
    ]);

    json_response([
        'player' => [
            'id'          => $playerId,
            'firstName'   => $firstName,
            'lastName'    => $lastName,
            'displayName' => $displayName ?: null,
            'shirtNumber' => $shirtNumberInt,
            'active'      => true,
        ],
    ], 201);
});

