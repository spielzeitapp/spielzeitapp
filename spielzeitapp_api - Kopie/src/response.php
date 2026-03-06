<?php
declare(strict_types=1);

function json_response(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function error_response(int $status, string $code, string $message): void
{
    json_response(
        [
            'error' => [
                'code'    => $code,
                'message' => $message,
            ],
        ],
        $status
    );
}

/**
 * Liest JSON Body und liefert assoziatives Array.
 */
function get_json_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error_response(400, 'invalid_json', 'Request Body ist kein gültiges JSON.');
        exit;
    }

    return $data;
}

