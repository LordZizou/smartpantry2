<?php
// Endpoint dati utente corrente
// Metodo: GET
// Richiede autenticazione — usato per verificare la sessione attiva

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Recupera i dati dell'utente corrente
$stmt = $pdo->prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    // Sessione orfana — utente eliminato dal DB
    session_destroy();
    jsonError('Utente non trovato', 404);
}

// Conta i prodotti in dispensa dell'utente
$stmtCount = $pdo->prepare('SELECT COUNT(*) AS total FROM pantry_items WHERE user_id = ?');
$stmtCount->execute([$userId]);
$countData = $stmtCount->fetch();

// Conta i prodotti in scadenza entro 7 giorni
$stmtExpiry = $pdo->prepare(
    'SELECT COUNT(*) AS expiring
     FROM pantry_items
     WHERE user_id = ?
       AND expiry_date IS NOT NULL
       AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)'
);
$stmtExpiry->execute([$userId, EXPIRY_WARNING_DAYS]);
$expiryData = $stmtExpiry->fetch();

jsonSuccess([
    'user' => [
        'id'         => $user['id'],
        'username'   => $user['username'],
        'email'      => $user['email'],
        'created_at' => $user['created_at'],
        'stats' => [
            'total_items'    => (int) $countData['total'],
            'expiring_items' => (int) $expiryData['expiring']
        ]
    ]
]);
