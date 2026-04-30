<?php
/**
 * RICERCA PRODOTTO TRAMITE CODICE A BARRE
 * 
 * Questo file gestisce la "magia" del riconoscimento prodotti. 
 * Quando l'utente scansiona un codice, questo script decide dove andare a cercare le informazioni.
 */

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

// Impostiamo la risposta come JSON (un formato che il browser capisce facilmente)
setJsonHeaders();
// Controlliamo che l'utente sia loggato
requireAuth();

// Accettiamo solo richieste di tipo "GET" (lettura dati)
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

// Prendiamo il codice a barre inviato dal browser
$barcode = trim($_GET['barcode'] ?? '');

if (empty($barcode)) {
    jsonError('Parametro barcode obbligatorio');
}

// Puliamo il codice a barre per sicurezza (solo numeri e lettere)
if (!preg_match('/^[0-9A-Za-z\-]{4,20}$/', $barcode)) {
    jsonError('Formato barcode non valido');
}

$pdo = getDB();

/**
 * FASE 1: CERCA NELLA NOSTRA DISPENSA LOCALE
 * Prima di chiedere a internet, guardiamo se qualcun altro ha già scansionato questo prodotto.
 * Se lo troviamo nel nostro database, lo restituiamo subito: è più veloce!
 */
$stmt = $pdo->prepare('SELECT * FROM products WHERE barcode = ?');
$stmt->execute([$barcode]);
$localProduct = $stmt->fetch();

if ($localProduct) {
    jsonSuccess(['product' => $localProduct, 'source' => 'cache']);
}

/**
 * FASE 2: CERCA SU INTERNET (OPENFOODFACTS)
 * Se non lo abbiamo in casa, interroghiamo OpenFoodFacts, un database mondiale gratuito.
 */
$url      = OPENFOODFACTS_URL . urlencode($barcode) . '.json';
$context  = stream_context_create([
    'http' => [
        'timeout'    => 10,
        'user_agent' => 'SmartPantry/1.0 (progetto scolastico)',
        'method'     => 'GET'
    ]
]);

// Proviamo a scaricare i dati dal sito esterno
$response = @file_get_contents($url, false, $context);

if ($response === false) {
    jsonError('Impossibile contattare il database esterno. Controlla la connessione.', 503);
}

$data = json_decode($response, true);

// Controlliamo se il sito esterno ha trovato effettivamente qualcosa
if (!isset($data['status']) || $data['status'] !== 1 || empty($data['product'])) {
    jsonError('Prodotto non trovato nel database mondiale', 404);
}

$p = $data['product'];

/**
 * FASE 3: PULIZIA DEI DATI
 * I dati che arrivano da internet sono "sporchi" o in lingue diverse.
 * Qui scegliamo il nome in italiano (se c'è) e i valori nutrizionali principali.
 */
$name        = $p['product_name']         ?? $p['product_name_it'] ?? $p['product_name_en'] ?? '';
$brand       = $p['brands']               ?? '';
$category    = $p['categories']           ?? '';
$imageUrl    = $p['image_url']            ?? $p['image_front_url'] ?? '';
$ingredients = $p['ingredients_text_it']  ?? $p['ingredients_text'] ?? '';

// Estraiamo i valori nutrizionali (calorie, proteine, ecc.) per 100g
$nutriments      = $p['nutriments']       ?? [];
$calories        = $nutriments['energy-kcal_100g'] ?? $nutriments['energy_100g'] ?? null;
$proteins        = $nutriments['proteins_100g']     ?? null;
$carbs           = $nutriments['carbohydrates_100g'] ?? null;
$fats            = $nutriments['fat_100g']          ?? null;
$fiber           = $nutriments['fiber_100g']         ?? null;
$salt            = $nutriments['salt_100g']          ?? null;

// Piccola correzione tecnica: se le calorie sono in "kJ", le convertiamo in "kcal" (quelle che leggiamo di solito)
if ($calories !== null && isset($nutriments['energy-kj_100g']) && !isset($nutriments['energy-kcal_100g'])) {
    $calories = round((float) $nutriments['energy-kj_100g'] / 4.184, 1);
}

if (empty($name)) {
    jsonError('Prodotto trovato ma senza nome. Inserisci manualmente.', 404);
}

/**
 * FASE 4: SALVATAGGIO LOCALE
 * Ora che abbiamo trovato il prodotto su internet, lo salviamo nel NOSTRO database.
 * Così la prossima volta che qualcuno lo scansiona, non dovremo più chiedere a internet.
 */
try {
    $stmtInsert = $pdo->prepare(
        'INSERT INTO products (barcode, name, brand, category, image_url, ingredients,
                               calories_per_100g, proteins_per_100g, carbs_per_100g,
                               fats_per_100g, fiber_per_100g, salt_per_100g)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
             name         = VALUES(name),
             brand        = VALUES(brand),
             image_url    = VALUES(image_url),
             ingredients  = VALUES(ingredients)'
    );

    $stmtInsert->execute([
        $barcode,
        $name,
        $brand        ?: null,
        $category     ?: null,
        $imageUrl     ?: null,
        $ingredients  ?: null,
        $calories     !== null ? round((float) $calories, 2) : null,
        $proteins     !== null ? round((float) $proteins, 2) : null,
        $carbs        !== null ? round((float) $carbs,    2) : null,
        $fats         !== null ? round((float) $fats,     2) : null,
        $fiber        !== null ? round((float) $fiber,    2) : null,
        $salt         !== null ? round((float) $salt,     2) : null,
    ]);
} catch (Exception $e) {
    // Se il salvataggio fallisce per un errore tecnico, non fa nulla, restituiamo comunque i dati all'utente
}

// Recuperiamo il prodotto finale dal database e lo mandiamo al sito
$stmt = $pdo->prepare('SELECT * FROM products WHERE barcode = ?');
$stmt->execute([$barcode]);
$savedProduct = $stmt->fetch();

jsonSuccess([
    'product' => $savedProduct,
    'source' => 'openfoodfacts'
]);
