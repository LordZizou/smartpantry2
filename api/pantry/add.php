<?php
// Endpoint aggiunta prodotto alla dispensa
// Metodo: POST
// Body JSON:
// {
//   "name": "Latte",          (obbligatorio)
//   "brand": "Granarolo",     (opzionale)
//   "quantity": 2,            (default 1)
//   "unit": "l",              (default "pz")
//   "expiry_date": "2025-12-31", (opzionale, formato YYYY-MM-DD)
//   "location": "frigo",      (opzionale)
//   "notes": "...",           (opzionale)
//   "barcode": "8001234567890" (opzionale — collega al catalogo prodotti)
// }

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Metodo non consentito', 405);
}

$body = getJsonBody();
if ($body === null) {
    jsonError('JSON non valido nel corpo della richiesta');
}

// Estrai e valida i campi
$name       = trim($body['name']        ?? '');
$brand      = trim($body['brand']       ?? '');
$quantity   = $body['quantity']         ?? 1;
$unit       = trim($body['unit']        ?? 'pz');
$expiryDate = trim($body['expiry_date'] ?? '');
$location   = trim($body['location']    ?? '');
$notes      = trim($body['notes']       ?? '');
$barcode    = trim($body['barcode']     ?? '');

if (empty($name)) {
    jsonError('Il nome del prodotto è obbligatorio');
}

if (!is_numeric($quantity) || (float) $quantity <= 0) {
    jsonError('La quantità deve essere un numero positivo');
}

// Validazione formato data scadenza
if ($expiryDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expiryDate)) {
    jsonError('Formato data non valido. Usa YYYY-MM-DD');
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Cerca il prodotto nel catalogo tramite barcode (se fornito)
$productId = null;
if ($barcode !== '') {
    $stmtProd = $pdo->prepare('SELECT id FROM products WHERE barcode = ?');
    $stmtProd->execute([$barcode]);
    $product = $stmtProd->fetch();
    if ($product) {
        $productId = $product['id'];
    }
}

// Inserisci il prodotto nella dispensa
$stmt = $pdo->prepare(
    'INSERT INTO pantry_items (user_id, product_id, name, brand, quantity, unit, expiry_date, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$stmt->execute([
    $userId,
    $productId,
    $name,
    $brand ?: null,
    (float) $quantity,
    $unit,
    $expiryDate ?: null,
    $location ?: null,
    $notes ?: null
]);

$newId = (int) $pdo->lastInsertId();

// Recupera il prodotto appena inserito per restituirlo completo
$stmtGet = $pdo->prepare(
    'SELECT pi.*, p.barcode, p.image_url, p.calories_per_100g
     FROM pantry_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.id = ?'
);
$stmtGet->execute([$newId]);
$newItem = $stmtGet->fetch();

jsonSuccess([
    'message' => 'Prodotto aggiunto alla dispensa',
    'item'    => $newItem
], 201);
