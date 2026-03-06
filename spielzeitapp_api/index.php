<?php
declare(strict_types=1);

// Front Controller für SpielzeitApp API (Root, kein public/ Ordner)

require __DIR__ . '/src/config.php';
require __DIR__ . '/src/response.php';
require __DIR__ . '/src/db.php';
require __DIR__ . '/src/auth.php';
require __DIR__ . '/src/middleware.php';
require __DIR__ . '/src/router.php';

$db = create_pdo();
$router = new Router();

// CORS
$allowedOrigins = [
    'https://www.myquetschnapp.at',
    'https://myquetschnapp.at',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if ($origin !== null && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Vary: Origin');
header('Access-Control-Allow-Credentials: false');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(204);
    exit;
}

// Routen registrieren (Reihenfolge: spezifische vor generischen)
require __DIR__ . '/routes/health.php';
require __DIR__ . '/routes/auth.php';
require __DIR__ . '/routes/seasons.php';
require __DIR__ . '/routes/teams.php';
require __DIR__ . '/routes/team_seasons.php';
require __DIR__ . '/routes/matches_v1.php';
require __DIR__ . '/routes/events.php';

// Request-Pfad bestimmen (ohne Skriptverzeichnis)
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');

if ($scriptDir !== '' && $scriptDir !== '/') {
    if (strpos($requestUri, $scriptDir) === 0) {
        $path = substr($requestUri, strlen($scriptDir));
    } else {
        $path = $requestUri;
    }
} else {
    $path = $requestUri;
}

if ($path === '') {
    $path = '/';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$router->dispatch($method, $path);

