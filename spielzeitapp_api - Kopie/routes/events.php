<?php
declare(strict_types=1);

// EVENTS ROUTES

$router->add('GET', '/api/v1/matches/:matchId/events', function (array $params) use ($db) {
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
    requireTeamRole($db, $teamId, ['viewer', 'parent', 'trainer', 'admin'], $user);

    $since = $_GET['since'] ?? null;
    $paramsSql = [':match_id' => $matchId];
    $whereSince = '';

    if ($since !== null && $since !== '') {
        try {
            $dt = new DateTimeImmutable((string)$since);
            $whereSince = ' AND created_at >= :since';
            $paramsSql[':since'] = $dt->format('Y-m-d H:i:s.u');
        } catch (Exception $e) {
            error_response(400, 'validation_error', 'since ist kein gültiges ISO-Datum.');
            return;
        }
    }

    $sql = 'SELECT id, created_at, created_by_user_id, type, minute, team_side,
                   player_id, player_in_id, player_out_id, card_type, note
            FROM match_events
            WHERE match_id = :match_id' . $whereSince . '
            ORDER BY created_at ASC, id ASC';

    $stmt = $db->prepare($sql);
    $stmt->execute($paramsSql);

    $events = [];
    while ($row = $stmt->fetch()) {
        $events[] = [
            'id'             => $row['id'],
            'createdAt'      => $row['created_at'],
            'createdByUserId'=> $row['created_by_user_id'],
            'type'           => $row['type'],
            'minute'         => $row['minute'] !== null ? (int)$row['minute'] : null,
            'teamSide'       => $row['team_side'],
            'playerId'       => $row['player_id'],
            'playerInId'     => $row['player_in_id'],
            'playerOutId'    => $row['player_out_id'],
            'cardType'       => $row['card_type'],
            'note'           => $row['note'],
        ];
    }

    json_response(['events' => $events]);
});

$router->add('POST', '/api/v1/matches/:matchId/events', function (array $params) use ($db) {
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

    $type = (string)($body['type'] ?? '');
    $allowedTypes = ['kickoff','period_start','period_end','goal','sub','card','note','final_whistle'];
    if (!in_array($type, $allowedTypes, true)) {
        error_response(400, 'validation_error', 'type ist ungültig.');
        return;
    }

    $minute      = $body['minute'] ?? null;
    $teamSide    = isset($body['teamSide']) ? (string)$body['teamSide'] : null;
    $playerId    = isset($body['playerId']) ? (string)$body['playerId'] : null;
    $playerInId  = isset($body['playerInId']) ? (string)$body['playerInId'] : null;
    $playerOutId = isset($body['playerOutId']) ? (string)$body['playerOutId'] : null;
    $cardType    = isset($body['cardType']) ? (string)$body['cardType'] : null;
    $note        = isset($body['note']) ? (string)$body['note'] : null;

    if ($minute !== null && $minute !== '') {
        if (!is_numeric($minute)) {
            error_response(400, 'validation_error', 'minute muss Zahl oder null sein.');
            return;
        }
        $minute = (int)$minute;
    } else {
        $minute = null;
    }

    if ($teamSide !== null && !in_array($teamSide, ['home','away'], true)) {
        error_response(400, 'validation_error', 'teamSide ist ungültig.');
        return;
    }

    if ($cardType !== null && !in_array($cardType, ['yellow','red','blue','none'], true)) {
        error_response(400, 'validation_error', 'cardType ist ungültig.');
        return;
    }

    $eventId = bin2hex(random_bytes(16));

    $stmt = $db->prepare(
        'INSERT INTO match_events (
           id, match_id, created_at, created_by_user_id,
           type, minute, team_side,
           player_id, player_in_id, player_out_id,
           card_type, note
         ) VALUES (
           :id, :match_id, NOW(3), :created_by_user_id,
           :type, :minute, :team_side,
           :player_id, :player_in_id, :player_out_id,
           :card_type, :note
         )'
    );
    $stmt->execute([
        ':id'                => $eventId,
        ':match_id'          => $matchId,
        ':created_by_user_id'=> $user['id'],
        ':type'              => $type,
        ':minute'            => $minute,
        ':team_side'         => $teamSide,
        ':player_id'         => $playerId,
        ':player_in_id'      => $playerInId,
        ':player_out_id'     => $playerOutId,
        ':card_type'         => $cardType,
        ':note'              => $note,
    ]);

    json_response([
        'event' => [
            'id'             => $eventId,
            'matchId'        => $matchId,
            'createdAt'      => (new DateTimeImmutable())->format(DATE_ATOM),
            'createdByUserId'=> $user['id'],
            'type'           => $type,
            'minute'         => $minute,
            'teamSide'       => $teamSide,
            'playerId'       => $playerId,
            'playerInId'     => $playerInId,
            'playerOutId'    => $playerOutId,
            'cardType'       => $cardType,
            'note'           => $note,
        ],
    ], 201);
});

