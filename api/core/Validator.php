<?php

class Validator {
    private array $errors = [];
    private array $data;

    public function __construct(array $data) {
        $this->data = $data;
    }

    public static function make(array $data): self {
        return new self($data);
    }

    public function required(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (!isset($this->data[$field]) || (is_string($this->data[$field]) && trim($this->data[$field]) === '')) {
            $this->errors[$field] = "$label is required";
        }
        return $this;
    }

    public function string(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !is_string($this->data[$field])) {
            $this->errors[$field] = "$label must be a string";
        }
        return $this;
    }

    public function email(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = "$label must be a valid email";
        }
        return $this;
    }

    public function maxLength(string $field, int $max, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && is_string($this->data[$field]) && mb_strlen($this->data[$field]) > $max) {
            $this->errors[$field] = "$label must not exceed $max characters";
        }
        return $this;
    }

    public function minLength(string $field, int $min, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && is_string($this->data[$field]) && mb_strlen($this->data[$field]) < $min) {
            $this->errors[$field] = "$label must be at least $min characters";
        }
        return $this;
    }

    public function numeric(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !is_numeric($this->data[$field])) {
            $this->errors[$field] = "$label must be a number";
        }
        return $this;
    }

    public function integer(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !filter_var($this->data[$field], FILTER_VALIDATE_INT)) {
            $this->errors[$field] = "$label must be an integer";
        }
        return $this;
    }

    public function in(string $field, array $values, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !in_array($this->data[$field], $values, true)) {
            $this->errors[$field] = "$label must be one of: " . implode(', ', $values);
        }
        return $this;
    }

    public function date(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && strtotime($this->data[$field]) === false) {
            $this->errors[$field] = "$label must be a valid date";
        }
        return $this;
    }

    public function boolean(string $field, string $label = null): self {
        $label = $label ?? $field;
        if (isset($this->data[$field]) && !is_bool($this->data[$field]) && !in_array($this->data[$field], [0, 1, '0', '1', true, false], true)) {
            $this->errors[$field] = "$label must be true or false";
        }
        return $this;
    }

    public function fails(): bool {
        return !empty($this->errors);
    }

    public function passes(): bool {
        return empty($this->errors);
    }

    public function errors(): array {
        return $this->errors;
    }

    public function validate(): array {
        if ($this->fails()) {
            Response::error('Validation failed', 422, $this->errors);
        }
        return $this->data;
    }

    public static function sanitize(string $value): string {
        return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
    }

    public static function sanitizeArray(array $data, array $fields): array {
        $clean = [];
        foreach ($fields as $field) {
            if (isset($data[$field])) {
                $clean[$field] = is_string($data[$field]) ? self::sanitize($data[$field]) : $data[$field];
            }
        }
        return $clean;
    }
}
