<?php

class Request {
    private string $method;
    private string $uri;
    private string $path;
    private array $query;
    private array $body;
    private array $headers;
    private array $params;
    private string $rawBody = '';

    public function __construct() {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->uri = $_SERVER['REQUEST_URI'] ?? '/';
        $this->path = parse_url($this->uri, PHP_URL_PATH) ?? '/';
        $this->query = $_GET;
        $this->headers = $this->parseHeaders();
        $this->body = $this->parseBody();
        $this->params = [];
    }

    private function parseHeaders(): array {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace('_', '-', strtolower(substr($key, 5)));
                $headers[$name] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }
        return $headers;
    }

    private function parseBody(): array {
        if (in_array($this->method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            $this->rawBody = file_get_contents('php://input') ?: '';
            $contentType = $this->header('content-type', '');
            if (str_contains($contentType, 'application/json')) {
                $decoded = json_decode($this->rawBody, true);
                return is_array($decoded) ? $decoded : [];
            }
            return $_POST;
        }
        return [];
    }

    public function method(): string {
        return $this->method;
    }

    public function path(): string {
        return $this->path;
    }

    public function query(string $key = null, $default = null) {
        if ($key === null) return $this->query;
        return $this->query[$key] ?? $default;
    }

    public function body(string $key = null, $default = null) {
        if ($key === null) return $this->body;
        return $this->body[$key] ?? $default;
    }

    public function input(string $key, $default = null) {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function all(): array {
        return array_merge($this->query, $this->body);
    }

    public function header(string $name, $default = null): ?string {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function bearerToken(): ?string {
        $auth = $this->header('authorization', '');
        if (str_starts_with($auth, 'Bearer ')) {
            return substr($auth, 7);
        }
        return null;
    }

    public function setParams(array $params): void {
        $this->params = $params;
    }

    public function param(string $key, $default = null) {
        return $this->params[$key] ?? $default;
    }

    public function ip(): string {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public function isMethod(string $method): bool {
        return $this->method === strtoupper($method);
    }

    public function has(string $key): bool {
        return isset($this->body[$key]) || isset($this->query[$key]);
    }

    public function only(array $keys): array {
        $data = $this->all();
        return array_intersect_key($data, array_flip($keys));
    }

    public function file(string $key): ?array {
        return $_FILES[$key] ?? null;
    }

    public function rawBody(): string {
        return $this->rawBody;
    }
}
