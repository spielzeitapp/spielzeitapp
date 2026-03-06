<?php
declare(strict_types=1);

// TEAM-SEASONS: GET (list), POST (create), POST :id/archive, POST :id/clone-roster

$router->add('GET', '/api/v1/team-seasons', function (array $params) use ($db) {
    $user = requireAuth($db);

    $teamId  = isset($_GET['teamId']) ? trim((string)$_GET['teamId']) : '';
    $seasonId = isset($_GET['seasonId']) ? trim((string)$_GET['seasonId']) : '';

    $sql = 'SELECT ts.id, ts.team_id, ts.season_id, ts.is_archived, ts.created_at,
                   t.name AS team_name, t.short_name AS team_short_name,
                   s.name AS season_name, s.year_start, s.year_end
            FROM team_seasons ts
            JOIN teams t ON ts.team_id = t.id
            JOIN seasons s ON ts.season_id = s.id
            INNER JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = :user_id AND tm.status = "active"
            WHERE 1=1';
    $paramsSql = [':user_id' => $user['id']];
    if ($teamId !== '') {
        $sql .= ' AND ts.team_id = :team_id';
        $paramsSql[':team_id'] = $teamId;
    }
    if ($seasonId !== '') {
        $sql .= ' AND ts.season_id = :season_id';
        $paramsSql[':season_id'] = $seasonId;
    }
    $sql .= ' ORDER BY s.year_start DESC, t.name';

    $stmt = $db->prepare($sql);
    $stmt->execute($paramsSql);
    $list = [];
    while ($row = $stmt->fetch()) {
        $list[] = [
            'id'           => $row['id'],
            'teamId'       => $row['team_id'],
            'seasonId'     => $row['season_id'],
            'teamName'     => $row['team_name'],
            'teamShortName'=> $row['team_short_name'],
            'seasonName'   => $row['season_name'],
            'yearStart'    => (int)$row['year_start'],
            'yearEnd'      => (int)$row['year_end'],
            'isArchived'   => (int)$row['is_archived'] === 1,
            'createdAt'    => $row['created_at'],
        ];
    }
    json_response(['teamSeasons' => $list]);
});

$router->add('POST', '/api/v1/team-seasons', function (array $params) use ($db) {
    $user = requireAuth($db);
    requireGlobalRole($user, ['admin', 'head_coach']);

    $body = get_json_input();
    $teamId   = trim((string)($body['teamId'] ?? ''));
    $seasonId = trim((string)($body['seasonId'] ?? ''));

    if ($teamId === '' || $seasonId === '') {
        error_response(400, 'validation_error', 'teamId und seasonId sind Pflicht.');
        return;
    }

    $stmt = $db->prepare('SELECT id FROM teams WHERE id = :id');
    $stmt->execute([':id' => $teamId]);
    if (!$stmt->fetch()) {
        error_response(404, 'not_found', 'Team nicht gefunden.');
        return;
    }
    $stmt = $db->prepare('SELECT id FROM seasons WHERE id = :id');
    $stmt->execute([':id' => $seasonId]);
    if (!$stmt->fetch()) {
        error_response(404, 'not_found', 'Saison nicht gefunden.');
        return;
    }

    $stmt = $db->prepare('SELECT id FROM team_seasons WHERE team_id = :team_id AND season_id = :season_id');
    $stmt->execute([':team_id' => $teamId, ':season_id' => $seasonId]);
    if ($stmt->fetch()) {
        error_response(409, 'conflict', 'Diese Team-Saison existiert bereits.');
        return;
    }

    $id = bin2hex(random_bytes(16));
    $stmt = $db->prepare(
        'INSERT INTO team_seasons (id, team_id, season_id, is_archived, created_at)
         VALUES (:id, :team_id, :season_id, 0, NOW(3))'
    );
    $stmt->execute([':id' => $id, ':team_id' => $teamId, ':season_id' => $seasonId]);

    $stmt = $db->prepare(
        'SELECT ts.id, ts.team_id, ts.season_id, ts.is_archived, ts.created_at, t.name AS team_name, s.name AS season_name
         FROM team_seasons ts JOIN teams t ON ts.team_id = t.id JOIN seasons s ON ts.season_id = s.id WHERE ts.id = :id'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    json_response([
        'teamSeason' => [
            'id'         => $id,
            'teamId'     => $teamId,
            'seasonId'   => $seasonId,
            'teamName'   => $row['team_name'],
            'seasonName' => $row['season_name'],
            'isArchived' => false,
            'createdAt'  => $row['created_at'],
        ],
    ], 201);
});

$router->add('POST', '/api/v1/team-seasons/:id/archive', function (array $params) use ($db) {
    $id = $params['id'] ?? '';
    $user = requireAuth($db);
    requireTeamSeasonRole($db, $id, ['admin', 'head_coach'], $user);

    $stmt = $db->prepare('UPDATE team_seasons SET is_archived = 1 WHERE id = :id');
    $stmt->execute([':id' => $id]);

    json_response(['ok' => true, 'message' => 'Team-Saison archiviert.']);
});

$router->add('POST', '/api/v1/team-seasons/:id/clone-roster', function (array $params) use ($db) {
    $id = $params['id'] ?? '';
    $user = requireAuth($db);
    requireTeamSeasonRole($db, $id, ['admin', 'head_coach', 'coach'], $user);

    $fromTeamSeasonId = isset($_GET['fromTeamSeasonId']) ? trim((string)$_GET['fromTeamSeasonId']) : '';
    if ($fromTeamSeasonId === '') {
        error_response(400, 'validation_error', 'Query-Parameter fromTeamSeasonId ist Pflicht.');
        return;
    }

    $stmt = $db->prepare('SELECT id, team_id FROM team_seasons WHERE id = :id');
    $stmt->execute([':id' => $fromTeamSeasonId]);
    $fromTs = $stmt->fetch();
    if (!$fromTs) {
        error_response(404, 'not_found', 'Quell-Team-Saison nicht gefunden.');
        return;
    }

    requireTeamRole($db, (string)$fromTs['team_id'], ['viewer', 'coach', 'head_coach', 'admin'], $user);

    $stmt = $db->prepare('SELECT player_id, shirt_number, position FROM team_season_players WHERE team_season_id = :ts_id');
    $stmt->execute([':ts_id' => $fromTeamSeasonId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $insert = $db->prepare(
        'INSERT INTO team_season_players (id, team_season_id, player_id, shirt_number, position, created_at)
         VALUES (:id, :team_season_id, :player_id, :shirt_number, :position, NOW(3))'
    );
    $count = 0;
    foreach ($rows as $r) {
        $newId = bin2hex(random_bytes(16));
        $insert->execute([
            ':id'             => $newId,
            ':team_season_id' => $id,
            ':player_id'      => $r['player_id'],
            ':shirt_number'   => $r['shirt_number'],
            ':position'       => $r['position'],
        ]);
        $count++;
    }

    json_response(['ok' => true, 'clonedCount' => $count]);
});
