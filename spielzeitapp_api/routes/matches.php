<?php
declare(strict_types=1);

// MATCHES ROUTES

$router->add('GET', '/api/v1/teams/:teamId/matches', function (array $params) use ($db) {
    $teamId = $params['teamId'] ?? '';
    $user = requireAuth($db);

    // viewer+ dürfen lesen
    requireTeamRole($db, $teamId, ['viewer', 'parent', 'trainer', 'admin'], $user);

    $stmt = $db->prepare(
        'SELECT id, opponent_name, home_away, kickoff_at, status,
                score_home, score_away, period,
                created_at, updated_at
         FROM matches
         WHERE team_id = :team_id
         ORDER BY kickoff_at DESC'
    );
    $stmt->execute([':team_id' => $teamId]);
    $matches = [];
    while ($row = $stmt->fetch()) {
        $matches[] = [
            'id'           => $row['id'],
            'opponentName' => $row['opponent_name'],
            'homeAway'     => $row['home_away'],
            'kickoffAt'    => $row['kickoff_at'],
            'status'       => $row['status'],
            'scoreHome'    => (int)$row['score_home'],
            'scoreAway'    => (int)$row['score_away'],
            'period'       => $row['period'] !== null ? (int)$row['period'] : null,
            'createdAt'    => $row['created_at'],
            'updatedAt'    => $row['updated_at'],
        ];
    }

    json_response(['matches' => $matches]);
});

$router->add('POST', '/api/v1/teams/:teamId/matches', function (array $params) use ($db) {
    $teamId = $params['teamId'] ?? '';
    $user = requireAuth($db);

    // trainer/admin dürfen anlegen
    requireTeamRole($db, $teamId, ['trainer', 'admin'], $user);

    $body = get_json_input();

    $opponentName = trim((string)($body['opponentName'] ?? ''));
    $homeAway     = (string)($body['homeAway'] ?? 'home');
    $kickoffAt    = (string)($body['kickoffAt'] ?? '');
    $status       = (string)($body['status'] ?? 'planned');

    if ($opponentName === '' || $kickoffAt === '') {
        error_response(400, 'validation_error', 'opponentName und kickoffAt sind Pflichtfelder.');
        return;
    }

    if (!in_array($homeAway, ['home', 'away'], true)) {
        error_response(400, 'validation_error', 'homeAway muss home oder away sein.');
        return;
    }

    if (!in_array($status, ['planned', 'live', 'finished'], true)) {
        error_response(400, 'validation_error', 'status ist ungültig.');
        return;
    }

    // kickoffAt grob validieren
    try {
        $dt = new DateTimeImmutable($kickoffAt);
    } catch (Exception $e) {
        error_response(400, 'validation_error', 'kickoffAt ist kein gültiges ISO-Datum.');
        return;
    }

    $matchId = bin2hex(random_bytes(16));

    $stmt = $db->prepare(
        'INSERT INTO matches (
            id, team_id, opponent_name, home_away, kickoff_at, status,
            score_home, score_away, period,
            timer_is_running, timer_started_at, timer_accum_seconds,
            created_at, updated_at
         ) VALUES (
            :id, :team_id, :opponent_name, :home_away, :kickoff_at, :status,
            0, 0, NULL,
            0, NULL, 0,
            NOW(3), NOW(3)
         )'
    );
    $stmt->execute([
        ':id'            => $matchId,
        ':team_id'       => $teamId,
        ':opponent_name' => $opponentName,
        ':home_away'     => $homeAway,
        ':kickoff_at'    => $dt->format('Y-m-d H:i:s.u'),
        ':status'        => $status,
    ]);

    json_response([
        'match' => [
            'id'           => $matchId,
            'teamId'      => $teamId,
            'opponentName'=> $opponentName,
            'homeAway'    => $homeAway,
            'kickoffAt'   => $dt->format(DATE_ATOM),
            'status'      => $status,
            'scoreHome'   => 0,
            'scoreAway'   => 0,
        ],
    ], 201);
});

$router->add('GET', '/api/v1/matches/:matchId', function (array $params) use ($db) {
    $matchId = $params['matchId'] ?? '';
    $user = requireAuth($db);

    $stmt = $db->prepare('SELECT * FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $match = $stmt->fetch();

    if (!$match) {
        error_response(404, 'not_found', 'Match nicht gefunden.');
        return;
    }

    $teamId = $match['team_id'];
    requireTeamRole($db, $teamId, ['viewer', 'parent', 'trainer', 'admin'], $user);

    json_response([
        'match' => [
            'id'           => $match['id'],
            'teamId'      => $match['team_id'],
            'opponentName'=> $match['opponent_name'],
            'homeAway'    => $match['home_away'],
            'kickoffAt'   => $match['kickoff_at'],
            'status'      => $match['status'],
            'scoreHome'   => (int)$match['score_home'],
            'scoreAway'   => (int)$match['score_away'],
            'period'      => $match['period'] !== null ? (int)$match['period'] : null,
            'timer'       => [
                'isRunning'       => (int)$match['timer_is_running'] === 1,
                'startedAt'       => $match['timer_started_at'],
                'accumulatedSecs' => (int)$match['timer_accum_seconds'],
            ],
            'createdAt'   => $match['created_at'],
            'updatedAt'   => $match['updated_at'],
        ],
    ]);
});

$router->add('PATCH', '/api/v1/matches/:matchId', function (array $params) use ($db) {
    $matchId = $params['matchId'] ?? '';
    $user = requireAuth($db);

    $stmt = $db->prepare('SELECT team_id FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'not_found', 'Match nicht gefunden.');
        return;
    }

    $teamId = $row['team_id'];
    requireTeamRole($db, $teamId, ['trainer', 'admin'], $user);

    $body = get_json_input();

    $fields = [];
    $paramsSql = [':id' => $matchId];

    $allowed = [
        'status'             => 'status',
        'score_home'         => 'score_home',
        'score_away'         => 'score_away',
        'period'             => 'period',
        'timer_is_running'   => 'timer_is_running',
        'timer_started_at'   => 'timer_started_at',
        'timer_accum_seconds'=> 'timer_accum_seconds',
    ];

    foreach ($allowed as $bodyKey => $column) {
        if (array_key_exists($bodyKey, $body)) {
            $fields[] = $column . ' = :' . $bodyKey;
            $paramsSql[':' . $bodyKey] = $body[$bodyKey];
        }
    }

    if (empty($fields)) {
        error_response(400, 'nothing_to_update', 'Keine gültigen Felder zum Aktualisieren übergeben.');
        return;
    }

    $sql = 'UPDATE matches SET ' . implode(', ', $fields) . ', updated_at = NOW(3) WHERE id = :id';
    $update = $db->prepare($sql);
    $update->execute($paramsSql);

    // Rückgabewert: aktuelles Match
    $stmt = $db->prepare('SELECT * FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $match = $stmt->fetch();

    json_response([
        'match' => [
            'id'           => $match['id'],
            'teamId'      => $match['team_id'],
            'opponentName'=> $match['opponent_name'],
            'homeAway'    => $match['home_away'],
            'kickoffAt'   => $match['kickoff_at'],
            'status'      => $match['status'],
            'scoreHome'   => (int)$match['score_home'],
            'scoreAway'   => (int)$match['score_away'],
            'period'      => $match['period'] !== null ? (int)$match['period'] : null,
            'timer'       => [
                'isRunning'       => (int)$match['timer_is_running'] === 1,
                'startedAt'       => $match['timer_started_at'],
                'accumulatedSecs' => (int)$match['timer_accum_seconds'],
            ],
            'createdAt'   => $match['created_at'],
            'updatedAt'   => $match['updated_at'],
        ],
    ]);
});

