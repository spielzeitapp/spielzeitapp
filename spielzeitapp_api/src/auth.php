<?php
declare(strict_types=1);

/**
 * Passwort-Hashing (bcrypt).
 */
function hash_password(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

function verify_password(string $password, string $hash): bool
{
    return password_verify($password, $hash);
}

/**
 * JWT Hilfsfunktionen (HS256).
 */
function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function jwt_encode(array $payload, string $secret): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [];
    $segments[] = base64url_encode(json_encode($header, JSON_UNESCAPED_UNICODE));
    $segments[] = base64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $signingInput = implode('.', $segments);
    $signature = hash_hmac('sha256', $signingInput, $secret, true);
    $segments[] = base64url_encode($signature);
    return implode('.', $segments);
}

function jwt_decode(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$b64Header, $b64Payload, $b64Signature] = $parts;
    $header = json_decode(base64url_decode($b64Header), true);
    $payload = json_decode(base64url_decode($b64Payload), true);
    $signature = base64url_decode($b64Signature);

    if (!is_array($header) || !is_array($payload) || $signature === '') {
        return null;
    }

    if (($header['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $expected = hash_hmac('sha256', $b64Header . '.' . $b64Payload, $secret, true);
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    $now = time();
    if (isset($payload['exp']) && is_int($payload['exp']) && $payload['exp'] < $now) {
        return null;
    }

    return $payload;
}

function get_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $header = $headers['Authorization'];
        }
    }

    if (preg_match('/Bearer\s+(\S+)/i', $header, $matches)) {
        return $matches[1];
    }

    return null;
}

