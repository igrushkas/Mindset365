<?php

class Router {
    private array $routes = [];
    private array $middlewareGroups = [];
    private string $prefix = '';

    public function group(string $prefix, array $middleware, callable $callback): void {
        $prevPrefix = $this->prefix;
        $this->prefix .= $prefix;
        $this->middlewareGroups[$this->prefix] = $middleware;
        $callback($this);
        $this->prefix = $prevPrefix;
    }

    public function get(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('GET', $path, $handler, $middleware);
    }

    public function post(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('POST', $path, $handler, $middleware);
    }

    public function put(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('PUT', $path, $handler, $middleware);
    }

    public function delete(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('DELETE', $path, $handler, $middleware);
    }

    private function addRoute(string $method, string $path, array $handler, array $middleware): void {
        $fullPath = $this->prefix . $path;
        $this->routes[] = [
            'method' => $method,
            'path' => $fullPath,
            'pattern' => $this->pathToRegex($fullPath),
            'handler' => $handler,
            'middleware' => array_merge($this->middlewareGroups[$this->prefix] ?? [], $middleware),
            'paramNames' => $this->extractParamNames($fullPath),
        ];
    }

    private function pathToRegex(string $path): string {
        $pattern = preg_replace('/\{([a-zA-Z_]+)\}/', '([^/]+)', $path);
        return '#^' . $pattern . '$#';
    }

    private function extractParamNames(string $path): array {
        preg_match_all('/\{([a-zA-Z_]+)\}/', $path, $matches);
        return $matches[1] ?? [];
    }

    public function dispatch(Request $request): void {
        $method = $request->method();
        $path = rtrim($request->path(), '/') ?: '/';

        // Handle CORS preflight
        if ($method === 'OPTIONS') {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
            header('Access-Control-Max-Age: 86400');
            http_response_code(204);
            exit;
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;

            if (preg_match($route['pattern'], $path, $matches)) {
                array_shift($matches);

                // Map captured groups to named params
                $params = [];
                foreach ($route['paramNames'] as $i => $name) {
                    $params[$name] = $matches[$i] ?? null;
                }
                $request->setParams($params);

                // Run middleware
                foreach ($route['middleware'] as $middlewareClass) {
                    $mw = new $middlewareClass();
                    $mw->handle($request);
                }

                // Call controller method
                [$controllerClass, $methodName] = $route['handler'];
                $controller = new $controllerClass();
                $controller->$methodName($request);
                return;
            }
        }

        Response::notFound('Route not found: ' . $method . ' ' . $path);
    }
}
