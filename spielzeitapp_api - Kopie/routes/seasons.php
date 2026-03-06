<?php
declare(strict_types=1);

// SEASONS: GET (list), POST (create, admin/head_coach)

$router->add('GET', '/api/v1/seasons', function (array $params) use ($db) {
    $user = requireAuth($db);

    $archived = isset($_GET['archived']) ? (int)$_GET['archived'] : 0;
    $stmt = $db->prepare(
        'SELECT id, name, year_start, year_end, is_archived, created_at
         FROM seasons
         WHERE is_archived = :archived
         ORDER BY year_start DESC'
    );
    $stmt->execute([':archived' => $archived]);
    $list = [];
    while ($row = $stmt->fetch()) {
        $list[] = [
            'id'         => $row['id'],
            'name'       => $row['name'],
            'yearStart'  => (int)$row['year_start'],
            'yearEnd'    => (int)$row['year_end'],
            'isArchived' => (int)$row['is_archived'] === 1,
            'createdAt'  => $row['created_at'],
        ];
    }
    json_response(['seasons' => $list]);
});

$router->add('POST', '/api/v1/seasons', function (array $params) use ($db) {
    $user = requireAuth($db);
    requireGlobalRole($user, ['admin', 'head_coach']);

    $body = get_json_input();
    $name      = trim((string)($body['name'] ?? ''));
    $yearStart = isset($body['yearStart']) ? (int)$body['yearStart'] : 0;
    $yearEnd   = isset($body['yearEnd']) ? (int)$body['yearEnd'] : 0;

    if ($name === '' || $yearStart < 2000 || $yearEnd < 2000 || $yearEnd < $yearStart) {
        error_response(400, 'validation_error', 'name, yearStart und yearEnd (gültig) sind Pflicht.');
        return;
    }

    $id = bin2hex(random_bytes(16));
    $stmt = $db->prepare(
        'INSERT INTO seasons (id, name, year_start, year_end, is_archived, created_at)
         VALUES (:id, :name, :year_start, :year_end, 0, NOW(3))'
    );
    $stmt->execute([
        ':id'        => $id,
        ':name'      => $name,
        ':year_start'=> $yearStart,
        ':year_end'  => $yearEnd,
    ]);

    json_response([
        'season' => [
            'id'         => $id,
            'name'       => $name,
            'yearStart'  => $yearStart,
            'yearEnd'    => $yearEnd,
            'isArchived' => false,
            'createdAt'  => date('Y-m-d\TH:i:s.v\Z'),
        ],
    ], 201);
});
