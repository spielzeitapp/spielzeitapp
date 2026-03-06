<?php
declare(strict_types=1);

// AUTH ROUTES

$router->add('POST', '/api/v1/auth/register', function (array $params) use ($db) {
    $body = get_json_input();

    $email       = trim((string)($body['email'] ?? ''));
    $password    = (string)($body['password'] ?? '');
    $displayName = trim((string)($body['displayName'] ?? ''));

    if ($email === '' || $password === '' || $displayName === '') {
        error_response(400, 'validation_error', 'email, password und displayName sind Pflichtfelder.');
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response(400, 'validation_error', 'E-Mail ist ungültig.');
        return;
    }

    $stmt = $db->prepare('SELECT id FROM users WHERE email = :email');
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        error_response(409, 'email_exists', 'Es existiert bereits ein Benutzer mit dieser E-Mail.');
        return;
    }

    $userId = bin2hex(random_bytes(16));
    $hash   = hash_password($password);

    $stmt = $db->prepare(
        'INSERT INTO users (id, email, password_hash, display_name, role, created_at, last_login_at)
         VALUES (:id, :email, :password_hash, :display_name, "viewer", NOW(3), NULL)'
    );
    $stmt->execute([
        ':id'            => $userId,
        ':email'         => $email,
        ':password_hash' => $hash,
        ':display_name'  => $displayName,
    ]);

    json_response([
        'user' => [
            'id'           => $userId,
            'email'        => $email,
            'displayName'  => $displayName,
        ],
    ], 201);
});

$router->add('POST', '/api/v1/auth/login', function (array $params) use ($db) {
    $body = get_json_input();

    $email    = trim((string)($body['email'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($email === '' || $password === '') {
        error_response(400, 'validation_error', 'email und password sind Pflichtfelder.');
        return;
    }

    $stmt = $db->prepare('SELECT id, email, password_hash, display_name FROM users WHERE email = :email');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !verify_password($password, (string)$user['password_hash'])) {
        error_response(401, 'invalid_credentials', 'E-Mail oder Passwort ist falsch.');
        return;
    }

    $now = time();
    $payload = [
        'sub' => $user['id'],
        'email' => $user['email'],
        'iat' => $now,
        'exp' => $now + JWT_TTL_SECONDS,
        'iss' => JWT_ISSUER,
        'aud' => JWT_AUDIENCE,
    ];

    $token = jwt_encode($payload, JWT_SECRET);

    // last_login_at aktualisieren (best effort)
    $update = $db->prepare('UPDATE users SET last_login_at = NOW(3) WHERE id = :id');
    $update->execute([':id' => $user['id']]);

    json_response([
        'accessToken' => $token,
        'user' => [
            'id'          => $user['id'],
            'email'       => $user['email'],
            'displayName' => $user['display_name'],
        ],
    ]);
});

$router->add('GET', '/api/v1/me', function (array $params) use ($db) {
    $user = requireAuth($db);

    $stmt = $db->prepare(
        'SELECT tm.team_id, t.name AS team_name, t.short_name, tm.role
         FROM team_memberships tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.user_id = :user_id AND tm.status = "active"'
    );
    $stmt->execute([':user_id' => $user['id']]);
    $teams = [];
    while ($row = $stmt->fetch()) {
        $teamId = (string)$row['team_id'];
        $tsStmt = $db->prepare(
            'SELECT ts.id, ts.season_id, ts.is_archived, s.name AS season_name
             FROM team_seasons ts
             JOIN seasons s ON ts.season_id = s.id
             WHERE ts.team_id = :team_id
             ORDER BY s.year_start DESC'
        );
        $tsStmt->execute([':team_id' => $teamId]);
        $teamSeasons = [];
        while ($tsRow = $tsStmt->fetch()) {
            $teamSeasons[] = [
                'id'         => $tsRow['id'],
                'seasonId'   => $tsRow['season_id'],
                'seasonName' => $tsRow['season_name'],
                'isArchived' => (int)$tsRow['is_archived'] === 1,
            ];
        }
        $teams[] = [
            'teamId'      => $teamId,
            'teamName'    => $row['team_name'],
            'shortName'   => $row['short_name'] ?? $row['team_name'],
            'role'        => $row['role'],
            'teamSeasons' => $teamSeasons,
        ];
    }

    json_response([
        'user' => [
            'id'          => $user['id'],
            'email'       => $user['email'],
            'displayName' => $user['display_name'],
            'role'        => $user['role'] ?? 'viewer',
        ],
        'teams' => $teams,
    ]);
});

