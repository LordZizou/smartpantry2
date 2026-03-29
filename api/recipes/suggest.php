<?php
// Endpoint suggerimento ricette
// Metodo: GET
// Parametri opzionali:
//   ?pantry_only=1   — usa solo ingredienti presenti in dispensa
//   ?number=10       — numero di ricette (default 10, max 20)
//
// Flusso:
// 1. Recupera i prodotti della dispensa dell'utente
// 2. Chiama Spoonacular findByIngredients
// 3. Per ogni ricetta recupera gli ingredienti completi
// 4. Calcola ingredienti disponibili e mancanti
// 5. Ordina per ingredienti disponibili (prima quelli fattibili)

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$pdo        = getDB();
$userId     = getCurrentUserId();
$pantryOnly = !empty($_GET['pantry_only']);
$number     = min(20, max(1, (int) ($_GET['number'] ?? 10)));

// Passo 1: recupera i nomi dei prodotti della dispensa
$stmt = $pdo->prepare('SELECT DISTINCT name FROM pantry_items WHERE user_id = ? AND quantity > 0');
$stmt->execute([$userId]);
$pantryItems = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($pantryItems)) {
    jsonError('La dispensa è vuota. Aggiungi prodotti per ricevere suggerimenti.', 400);
}

// Normalizza i nomi per l'API (rimuovi spazi extra, converti in minuscolo)
$ingredients = array_map('strtolower', $pantryItems);
$ingredients = array_map('trim', $ingredients);

// Passo 2: chiama Spoonacular findByIngredients
$ingredientsParam = urlencode(implode(',', $ingredients));
$ranking = $pantryOnly ? 2 : 1; // 2 = massimizza ingredienti usati, 1 = minimizza ingredienti mancanti

$url = SPOONACULAR_URL . '/recipes/findByIngredients'
    . '?apiKey=' . SPOONACULAR_API_KEY
    . '&ingredients=' . $ingredientsParam
    . '&number=' . $number
    . '&ranking=' . $ranking
    . '&ignorePantry=false';

$context = stream_context_create([
    'http' => [
        'timeout'    => 15,
        'user_agent' => 'SmartPantry/1.0',
        'method'     => 'GET'
    ]
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    jsonError('Impossibile contattare Spoonacular. Controlla la connessione o la chiave API.', 503);
}

$recipes = json_decode($response, true);

if (!is_array($recipes)) {
    jsonError('Risposta non valida da Spoonacular', 502);
}

// Controlla errore API (chiave non valida, limite raggiunto, ecc.)
if (isset($recipes['status']) && $recipes['status'] === 'failure') {
    jsonError('Errore Spoonacular: ' . ($recipes['message'] ?? 'chiave API non valida'), 502);
}

if (empty($recipes)) {
    jsonSuccess([
        'recipes'          => [],
        'pantry_items'     => $pantryItems,
        'message'          => 'Nessuna ricetta trovata con questi ingredienti'
    ]);
}

// Passo 3: costruisci le ricette con ingredienti disponibili/mancanti
$pantryNormalized = array_map('strtolower', array_map('trim', $pantryItems));

$formattedRecipes = [];

foreach ($recipes as $recipe) {
    // Ingredienti usati dalla dispensa
    $usedIngredients = [];
    foreach ($recipe['usedIngredients'] ?? [] as $ing) {
        $usedIngredients[] = [
            'name'     => $ing['name'],
            'amount'   => $ing['amount'],
            'unit'     => $ing['unit'],
            'image'    => $ing['image'] ?? null
        ];
    }

    // Ingredienti mancanti
    $missedIngredients = [];
    foreach ($recipe['missedIngredients'] ?? [] as $ing) {
        $missedIngredients[] = [
            'name'     => $ing['name'],
            'amount'   => $ing['amount'],
            'unit'     => $ing['unit'],
            'image'    => $ing['image'] ?? null
        ];
    }

    // Calcola percentuale di compatibilità
    $totalIngredients = count($usedIngredients) + count($missedIngredients);
    $compatibility    = $totalIngredients > 0
        ? round(count($usedIngredients) / $totalIngredients * 100)
        : 0;

    $formattedRecipes[] = [
        'id'                  => $recipe['id'],
        'title'               => $recipe['title'],
        'image'               => $recipe['image']          ?? null,
        'used_ingredient_count'   => (int) ($recipe['usedIngredientCount']   ?? 0),
        'missed_ingredient_count' => (int) ($recipe['missedIngredientCount'] ?? 0),
        'used_ingredients'    => $usedIngredients,
        'missed_ingredients'  => $missedIngredients,
        'compatibility'       => $compatibility, // percentuale 0-100
        'can_make_now'        => count($missedIngredients) === 0
    ];
}

// Passo 5: ordina le ricette
// Prima quelle realizzabili subito, poi per compatibilità decrescente
usort($formattedRecipes, function ($a, $b) {
    // Prima le ricette fattibili subito
    if ($a['can_make_now'] !== $b['can_make_now']) {
        return $b['can_make_now'] <=> $a['can_make_now'];
    }
    // Poi per compatibilità decrescente
    return $b['compatibility'] <=> $a['compatibility'];
});

jsonSuccess([
    'recipes'       => $formattedRecipes,
    'pantry_items'  => $pantryItems,
    'total_found'   => count($formattedRecipes),
    'can_make_now'  => count(array_filter($formattedRecipes, fn($r) => $r['can_make_now']))
]);
