<?php
declare(strict_types=1);

class Router
{
    /** @var array<string, array<int, array{pattern:string, regex:string, handler:callable}>> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $method = strtoupper($method);
        $regex = $this->compilePattern($pattern);
        $this->routes[$method][] = [
            'pattern' => $pattern,
            'regex'   => $regex,
            'handler' => $handler,
        ];
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $routes = $this->routes[$method] ?? [];

        foreach ($routes as $route) {
            if (preg_match($route['regex'], $path, $matches)) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (!is_int($key)) {
                        $params[$key] = $value;
                    }
                }

                call_user_func($route['handler'], $params);
                return;
            }
        }

        error_response(404, 'not_found', 'Route nicht gefunden.');
    }

    private function compilePattern(string $pattern): string
    {
        $regex = preg_replace('#:([\w]+)#', '(?P<$1>[^/]+)', $pattern);
        if ($regex === null) {
            $regex = $pattern;
        }
        return '#^' . $regex . '$#';
    }
}

