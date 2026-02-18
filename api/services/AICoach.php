<?php

class AICoach {
    private string $apiKey;
    private string $model;
    private string $baseUrl;
    private int $maxTokens;
    private float $temperature;

    public function __construct() {
        $config = require __DIR__ . '/../config/ai.php';
        $this->apiKey = $config['api_key'];
        $this->model = $config['model'];
        $this->baseUrl = $config['base_url'];
        $this->maxTokens = $config['max_tokens'];
        $this->temperature = $config['temperature'];
    }

    public function chat(array $messages, ?string $systemPrompt = null): array {
        $apiMessages = [];

        if ($systemPrompt) {
            $apiMessages[] = ['role' => 'system', 'content' => $systemPrompt];
        }

        foreach ($messages as $msg) {
            if (in_array($msg['role'], ['user', 'assistant'])) {
                $apiMessages[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content'],
                ];
            }
        }

        $payload = [
            'model' => $this->model,
            'messages' => $apiMessages,
            'max_tokens' => $this->maxTokens,
            'temperature' => $this->temperature,
        ];

        $ch = curl_init($this->baseUrl . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("AI Coach curl error: $curlError");
            return ['content' => 'I apologize, but I encountered a connection error. Please try again.', 'tokens' => 0, 'model' => $this->model];
        }

        if ($httpCode !== 200) {
            error_log("AI Coach API error (HTTP $httpCode): $response");
            return ['content' => 'I apologize, but I encountered an error. Please try again later.', 'tokens' => 0, 'model' => $this->model];
        }

        $data = json_decode($response, true);
        if (!$data || !isset($data['choices'][0]['message']['content'])) {
            error_log("AI Coach invalid response: $response");
            return ['content' => 'I apologize, but I received an unexpected response. Please try again.', 'tokens' => 0, 'model' => $this->model];
        }

        return [
            'content' => $data['choices'][0]['message']['content'],
            'tokens' => $data['usage']['total_tokens'] ?? 0,
            'model' => $data['model'] ?? $this->model,
        ];
    }
}
