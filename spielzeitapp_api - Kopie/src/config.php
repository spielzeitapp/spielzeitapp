<?php
declare(strict_types=1);

// Grundkonfiguration für SpielzeitApp API

$envDsn  = getenv('SPIELZEITAPP_DB_DSN') ?: null;
$envUser = getenv('SPIELZEITAPP_DB_USER') ?: null;
$envPass = getenv('SPIELZEITAPP_DB_PASS') ?: null;

if (!defined('DB_DSN')) {
    define('DB_DSN', $envDsn ?: 'mysql:host=localhost;dbname=spielzeitapp;charset=utf8mb4');
}

if (!defined('DB_USER')) {
    define('DB_USER', $envUser ?: 'spielzeitapp_user');
}

if (!defined('DB_PASS')) {
    define('DB_PASS', $envPass ?: 'changeme');
}

$envJwtSecret = getenv('SPIELZEITAPP_JWT_SECRET') ?: null;

if (!defined('JWT_SECRET')) {
    define('JWT_SECRET', $envJwtSecret ?: 'change-this-secret-in-production');
}

if (!defined('JWT_ISSUER')) {
    define('JWT_ISSUER', 'spielzeitapp');
}

if (!defined('JWT_AUDIENCE')) {
    define('JWT_AUDIENCE', 'spielzeitapp-client');
}

if (!defined('JWT_TTL_SECONDS')) {
    define('JWT_TTL_SECONDS', 3600); // 1 Stunde
}

