<?php
declare(strict_types=1);

// Health-Check (ohne Auth)

$router->add('GET', '/api/v1/health', function (array $params) use ($db) {
    $ok = true;
    $dbStatus = 'ok';
    try {
        $db->query('SELECT 1');
    } catch (Throwable $e) {
        $ok = false;
        $dbStatus = 'error';
    }

    json_response([
        'status'  => $ok ? 'ok' : 'degraded',
        'version' => '1.0',
        'checks'  => [
            'database' => $dbStatus,
        ],
    ], $ok ? 200 : 503);
});
