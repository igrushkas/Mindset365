<?php

class RateLimitMiddleware {
    private int $maxRequests;
    private int $windowSeconds;

    public function __construct(int $maxRequests = 100, int $windowSeconds = 60) {
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
    }

    public function handle(Request $request): void {
        $identifier = $this->getIdentifier($request);
        $cacheFile = __DIR__ . '/../../storage/logs/rate_' . md5($identifier) . '.json';

        $data = $this->loadData($cacheFile);
        $now = time();

        // Clean old entries
        $data['requests'] = array_filter(
            $data['requests'] ?? [],
            fn($timestamp) => $timestamp > ($now - $this->windowSeconds)
        );

        if (count($data['requests']) >= $this->maxRequests) {
            $retryAfter = min($data['requests']) + $this->windowSeconds - $now;
            header("Retry-After: $retryAfter");
            Response::error('Too many requests. Please try again later.', 429);
        }

        $data['requests'][] = $now;
        $this->saveData($cacheFile, $data);
    }

    private function getIdentifier(Request $request): string {
        $userId = Auth::id();
        if ($userId) return "user:$userId";
        return "ip:" . $request->ip();
    }

    private function loadData(string $file): array {
        if (!file_exists($file)) return ['requests' => []];
        $content = file_get_contents($file);
        return json_decode($content, true) ?: ['requests' => []];
    }

    private function saveData(string $file, array $data): void {
        file_put_contents($file, json_encode($data), LOCK_EX);
    }
}
