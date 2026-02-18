<?php
// Prevent LiteSpeed and CDN from caching this page
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-LiteSpeed-Cache-Control: no-cache');
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mindset365 - Coaching Platform</title>
    <meta name="description" content="Mindset365 - AI-powered coaching platform for business growth">

    <!-- Google Identity Services -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

    <!-- CSS -->
    <link rel="stylesheet" href="/app/css/variables.css">
    <link rel="stylesheet" href="/app/css/reset.css">
    <link rel="stylesheet" href="/app/css/layout.css">
    <link rel="stylesheet" href="/app/css/components.css">
    <link rel="stylesheet" href="/app/css/dashboard.css">
    <link rel="stylesheet" href="/app/css/animations.css">
    <link rel="stylesheet" href="/app/css/pages.css">

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/app/assets/icons/favicon.svg">

    <style>
        /* Critical inline styles for first paint */
        body { background: var(--bg-primary); color: var(--text-primary); font-family: var(--font-family); margin: 0; }
        #app-loader { display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 1rem; }
        #app-loader .spinner { width: 40px; height: 40px; border: 3px solid var(--border-color); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div id="app">
        <div id="app-loader">
            <div class="spinner"></div>
            <p style="color: var(--text-secondary); font-size: 0.875rem;">Loading Mindset365...</p>
        </div>
    </div>

    <!-- App config (update with real values when ready) -->
    <script>
        window.MINDSET365_CONFIG = {
            googleClientId: '269877784364-ru3j4qvtodo90liqetbgtnoa0d3uftdu.apps.googleusercontent.com'
        };
    </script>

    <!-- Catch module-level errors that fail silently -->
    <script>
        window.addEventListener('error', function(e) {
            var app = document.getElementById('app');
            if (app && app.querySelector('#app-loader')) {
                app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:1rem;padding:2rem;text-align:center;font-family:sans-serif;">'
                    + '<h2 style="color:#e74c3c;">Failed to load Mindset365</h2>'
                    + '<pre style="color:#888;max-width:600px;white-space:pre-wrap;font-size:0.85rem;">' + (e.message || 'Unknown error') + '\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre>'
                    + '<button onclick="window.location.reload()" style="padding:10px 24px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Reload</button>'
                    + '</div>';
            }
        });
    </script>

    <!-- App entry point -->
    <script type="module" src="/app/js/app.js"></script>
</body>
</html>
