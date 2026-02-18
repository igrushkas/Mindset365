<?php

class FileController {
    private const UPLOAD_DIR = __DIR__ . '/../../storage/uploads/';
    private const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    private const ALLOWED_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'application/zip', 'application/x-zip-compressed',
    ];

    public function upload(Request $request): void {
        $file = $request->file('file');
        if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
            $errorMsg = 'File upload failed';
            if ($file) {
                switch ($file['error']) {
                    case UPLOAD_ERR_INI_SIZE:
                    case UPLOAD_ERR_FORM_SIZE:
                        $errorMsg = 'File exceeds maximum allowed size';
                        break;
                    case UPLOAD_ERR_NO_FILE:
                        $errorMsg = 'No file was uploaded';
                        break;
                }
            }
            Response::error($errorMsg, 400);
        }

        // Validate file size
        if ($file['size'] > self::MAX_FILE_SIZE) {
            Response::error('File size exceeds 20MB limit', 400);
        }

        // Validate MIME type
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        if (!in_array($mimeType, self::ALLOWED_MIMES, true)) {
            Response::error('File type not allowed: ' . $mimeType, 400);
        }

        // Ensure upload directory exists
        $uploadDir = self::UPLOAD_DIR;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate UUID filename preserving extension
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $extension = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $extension));
        $uuid = $this->generateUuid();
        $storedName = $uuid . ($extension ? '.' . $extension : '');
        $storedPath = $uploadDir . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
            Response::serverError('Failed to store file');
        }

        $id = Database::insert('files', [
            'workspace_id' => Auth::workspaceId(),
            'uploaded_by' => Auth::id(),
            'original_name' => Validator::sanitize($file['name']),
            'stored_name' => $storedName,
            'mime_type' => $mimeType,
            'file_size' => $file['size'],
            'path' => '/storage/uploads/' . $storedName,
        ]);

        $record = Database::fetch("SELECT * FROM files WHERE id = ?", [$id]);
        $config = require __DIR__ . '/../config/app.php';
        $record['url'] = $config['url'] . $record['path'];

        Response::created($record);
    }

    public function show(Request $request): void {
        $id = (int) $request->param('id');
        $file = Database::fetch(
            "SELECT * FROM files WHERE id = ? AND workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$file) Response::notFound('File not found');

        $filePath = self::UPLOAD_DIR . $file['stored_name'];
        if (!file_exists($filePath)) {
            Response::notFound('File not found on disk');
        }

        // Serve the file for download
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Disposition: inline; filename="' . $file['original_name'] . '"');
        header('Content-Length: ' . $file['file_size']);
        header('Cache-Control: private, max-age=86400');
        readfile($filePath);
        exit;
    }

    public function destroy(Request $request): void {
        $id = (int) $request->param('id');
        $file = Database::fetch(
            "SELECT * FROM files WHERE id = ? AND workspace_id = ?",
            [$id, Auth::workspaceId()]
        );
        if (!$file) Response::notFound('File not found');

        // Only uploader or owner can delete
        if ($file['uploaded_by'] !== Auth::id() && !Auth::isOwner()) {
            Response::forbidden('Only the uploader or workspace owner can delete files');
        }

        // Delete physical file
        $filePath = self::UPLOAD_DIR . $file['stored_name'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        Database::delete('files', 'id = ?', [$id]);
        Response::noContent();
    }

    private function generateUuid(): string {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
