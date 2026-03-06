<?php
declare(strict_types=1);

// MATCHES (team_season_id): GET (list, filter), POST, PUT, DELETE

function match_row_to_response(array $row): array
{
    return [
        'id'           => $row['id'],
        'teamSeasonId' => $row['team_season_id'],
        'opponentName' => $row['opponent_name'],
        'isHome'       => (int)$row['is_home'] === 1,
        'matchDate'    => $row['match_date'],
        'kickoffTime'  => $row['kickoff_time'],
        'status'       => $row['status'],
        'goalsHome'    => (int)$row['goals_home'],
        'goalsAway'    => (int)$row['goals_away'],
        'homeLogo'     => $row['home_logo'],
        'awayLogo'     => $row['away_logo'],
        'createdAt'    => $row['created_at'],
        'updatedAt'    => $row['updated_at'],
    ];
}

$router->add('GET', '/api/v1/matches', function (array $params) use ($db) {
    $user = requireAuth($db);

    $teamSeasonId = isset($_GET['teamSeasonId']) ? trim((string)$_GET['teamSeasonId']) : '';
    $status       = isset($_GET['status']) ? trim((string)$_GET['status']) : '';

    if ($teamSeasonId === '') {
        error_response(400, 'validation_error', 'Query-Parameter teamSeasonId ist Pflicht.');
        return;
    }

    requireTeamSeasonRole($db, $teamSeasonId, ['viewer', 'coach', 'head_coach', 'admin'], $user);

    $sql = 'SELECT id, team_season_id, opponent_name, is_home, match_date, kickoff_time, status,
                   goals_home, goals_away, home_logo, away_logo, created_at, updated_at
            FROM matches WHERE team_season_id = :ts_id';
    $paramsSql = [':ts_id' => $teamSeasonId];
    if ($status !== '' && in_array($status, ['planned', 'live', 'finished'], true)) {
        $sql .= ' AND status = :status';
        $paramsSql[':status'] = $status;
    }
    $sql .= ' ORDER BY match_date ASC, kickoff_time ASC';

    $stmt = $db->prepare($sql);
    $stmt->execute($paramsSql);
    $list = [];
    while ($row = $stmt->fetch()) {
        $list[] = match_row_to_response($row);
    }
    json_response(['matches' => $list]);
});

$router->add('POST', '/api/v1/matches', function (array $params) use ($db) {
    $user = requireAuth($db);

    $body = get_json_input();
    $teamSeasonId = trim((string)($body['teamSeasonId'] ?? ''));
    $opponentName = trim((string)($body['opponentName'] ?? ''));
    $isHome       = isset($body['isHome']) ? (bool)$body['isHome'] : true;
    $matchDate    = trim((string)($body['matchDate'] ?? ''));
    $kickoffTime  = trim((string)($body['kickoffTime'] ?? '12:00'));
    $status       = (string)($body['status'] ?? 'planned');
    $goalsHome    = isset($body['goalsHome']) ? (int)$body['goalsHome'] : 0;
    $goalsAway    = isset($body['goalsAway']) ? (int)$body['goalsAway'] : 0;
    $homeLogo     = isset($body['homeLogo']) ? trim((string)$body['homeLogo']) : null;
    $awayLogo     = isset($body['awayLogo']) ? trim((string)$body['awayLogo']) : null;

    if ($teamSeasonId === '' || $opponentName === '' || $matchDate === '') {
        error_response(400, 'validation_error', 'teamSeasonId, opponentName und matchDate sind Pflicht.');
        return;
    }
    if (!in_array($status, ['planned', 'live', 'finished'], true)) {
        error_response(400, 'validation_error', 'status muss planned, live oder finished sein.');
        return;
    }

    requireTeamSeasonRole($db, $teamSeasonId, ['coach', 'head_coach', 'admin'], $user);

    $matchId = bin2hex(random_bytes(16));
    $stmt = $db->prepare(
        'INSERT INTO matches (id, team_season_id, opponent_name, is_home, match_date, kickoff_time, status, goals_home, goals_away, home_logo, away_logo, created_at, updated_at)
         VALUES (:id, :ts_id, :opponent_name, :is_home, :match_date, :kickoff_time, :status, :goals_home, :goals_away, :home_logo, :away_logo, NOW(3), NOW(3))'
    );
    $stmt->execute([
        ':id'            => $matchId,
        ':ts_id'         => $teamSeasonId,
        ':opponent_name' => $opponentName,
        ':is_home'       => $isHome ? 1 : 0,
        ':match_date'    => $matchDate,
        ':kickoff_time'  => $kickoffTime,
        ':status'        => $status,
        ':goals_home'    => $goalsHome,
        ':goals_away'    => $goalsAway,
        ':home_logo'     => $homeLogo !== '' ? $homeLogo : null,
        ':away_logo'     => $awayLogo !== '' ? $awayLogo : null,
    ]);

    $stmt = $db->prepare('SELECT id, team_season_id, opponent_name, is_home, match_date, kickoff_time, status, goals_home, goals_away, home_logo, away_logo, created_at, updated_at FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $row = $stmt->fetch();

    json_response(['match' => match_row_to_response($row)], 201);
});

$router->add('GET', '/api/v1/matches/:matchId', function (array $params) use ($db) {
    $matchId = $params['matchId'] ?? '';
    $user = requireAuth($db);

    $stmt = $db->prepare('SELECT * FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'not_found', 'Match nicht gefunden.');
        return;
    }
    requireTeamSeasonRole($db, (string)$row['team_season_id'], ['viewer', 'coach', 'head_coach', 'admin'], $user);

    json_response(['match' => match_row_to_response($row)]);
});

$router->add('PUT', '/api/v1/matches/:matchId', function (array $params) use ($db) {
    $matchId = $params['matchId'] ?? '';
    $user = requireAuth($db);

    $stmt = $db->prepare('SELECT * FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'not_found', 'Match nicht gefunden.');
        return;
    }
    requireTeamSeasonRole($db, (string)$row['team_season_id'], ['coach', 'head_coach', 'admin'], $user);

    $body = get_json_input();
    $allowed = [
        'opponent_name' => 'opponentName',
        'is_home'       => 'isHome',
        'match_date'    => 'matchDate',
        'kickoff_time'  => 'kickoffTime',
        'status'        => 'status',
        'goals_home'    => 'goalsHome',
        'goals_away'    => 'goalsAway',
        'home_logo'     => 'homeLogo',
        'away_logo'     => 'awayLogo',
    ];
    $updates = [];
    $paramsSql = [':id' => $matchId];
    foreach ($allowed as $col => $key) {
        if (!array_key_exists($key, $body)) {
            continue;
        }
        $val = $body[$key];
        if ($col === 'is_home') {
            $updates[] = 'is_home = :is_home';
            $paramsSql[':is_home'] = $val ? 1 : 0;
        } elseif ($col === 'status') {
            if (in_array($val, ['planned', 'live', 'finished'], true)) {
                $updates[] = 'status = :status';
                $paramsSql[':status'] = $val;
            }
        } elseif ($col === 'goals_home' || $col === 'goals_away') {
            $updates[] = $col . ' = :' . $col;
            $paramsSql[':' . $col] = (int)$val;
        } else {
            $updates[] = $col . ' = :' . $col;
            $paramsSql[':' . $col] = $val === null || $val === '' ? null : (string)$val;
        }
    }
    if (empty($updates)) {
        error_response(400, 'validation_error', 'Keine gültigen Felder zum Aktualisieren.');
        return;
    }
    $sql = 'UPDATE matches SET ' . implode(', ', $updates) . ', updated_at = NOW(3) WHERE id = :id';
    $db->prepare($sql)->execute($paramsSql);

    $stmt = $db->prepare('SELECT id, team_season_id, opponent_name, is_home, match_date, kickoff_time, status, goals_home, goals_away, home_logo, away_logo, created_at, updated_at FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    json_response(['match' => match_row_to_response($stmt->fetch())]);
});

$router->add('DELETE', '/api/v1/matches/:matchId', function (array $params) use ($db) {
    $matchId = $params['matchId'] ?? '';
    $user = requireAuth($db);

    $stmt = $db->prepare('SELECT team_season_id FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);
    $row = $stmt->fetch();
    if (!$row) {
        error_response(404, 'not_found', 'Match nicht gefunden.');
        return;
    }
    requireTeamSeasonRole($db, (string)$row['team_season_id'], ['coach', 'head_coach', 'admin'], $user);

    $stmt = $db->prepare('DELETE FROM matches WHERE id = :id');
    $stmt->execute([':id' => $matchId]);

    http_response_code(204);
    header('Content-Type: application/json; charset=utf-8');
});
