<?php
// Endpoint ricerca ricette per nome
// Metodo: GET
// Parametri:
//   ?query=pizza     — termine di ricerca (obbligatorio)
//   ?number=8        — numero risultati (default 8, max 16)
//
// Flusso:
// 1. Recupera gli ingredienti della dispensa dell'utente
// 2. Chiama Spoonacular complexSearch con query + ingredienti dispensa
// 3. Per ogni ricetta calcola ingredienti disponibili e mancanti
// 4. Restituisce risultati ordinati per compatibilità

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$query  = trim($_GET['query'] ?? '');
$number = min(16, max(1, (int) ($_GET['number'] ?? 8)));

if (empty($query)) {
    jsonError('Parametro query obbligatorio');
}

if (strlen($query) > 100) {
    jsonError('Termine di ricerca troppo lungo (max 100 caratteri)');
}

$pdo    = getDB();
$userId = getCurrentUserId();

// Recupera gli ingredienti della dispensa per il confronto
$stmt = $pdo->prepare('SELECT DISTINCT LOWER(TRIM(name)) AS name FROM pantry_items WHERE user_id = ? AND quantity > 0');
$stmt->execute([$userId]);
$pantryIngredients = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Costruisci la URL per Spoonacular complexSearch
// NON usiamo includeIngredients: vogliamo tutte le ricette con quel nome,
// poi confrontiamo manualmente con la dispensa per calcolare la compatibilità.
// Questo permette di cercare qualsiasi ricetta anche con 0 ingredienti disponibili.
$params = http_build_query([
    'apiKey'               => SPOONACULAR_API_KEY,
    'query'                => $query,
    'number'               => $number,
    'instructionsRequired' => 'true',
    'addRecipeInformation' => 'false',
]);

$url     = SPOONACULAR_URL . '/recipes/complexSearch?' . $params;
$context = stream_context_create([
    'http' => [
        'timeout'    => 15,
        'user_agent' => 'SmartPantry/1.0',
        'method'     => 'GET'
    ]
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    jsonError('Impossibile contattare Spoonacular. Controlla la connessione.', 503);
}

$data = json_decode($response, true);

// Controlla errori API
if (isset($data['status']) && $data['status'] === 'failure') {
    jsonError('Errore Spoonacular: ' . ($data['message'] ?? 'Errore sconosciuto'), 502);
}

if (!isset($data['results'])) {
    jsonError('Risposta non valida da Spoonacular', 502);
}

$results = $data['results'];

if (empty($results)) {
    jsonSuccess([
        'recipes'      => [],
        'query'        => $query,
        'total_found'  => 0,
        'pantry_items' => $pantryIngredients,
        'message'      => "Nessuna ricetta trovata per \"$query\""
    ]);
}

// Passo 2: recupera gli ingredienti completi per ogni ricetta (bulk)
$recipeIds = array_column($results, 'id');

$bulkUrl     = SPOONACULAR_URL . '/recipes/informationBulk?ids=' . implode(',', $recipeIds) . '&apiKey=' . SPOONACULAR_API_KEY . '&includeNutrition=false';
$bulkResponse = @file_get_contents($bulkUrl, false, $context);

$detailedRecipes = [];
if ($bulkResponse !== false) {
    $bulkData = json_decode($bulkResponse, true);
    if (is_array($bulkData)) {
        // Indicizza per ID
        foreach ($bulkData as $recipe) {
            $detailedRecipes[$recipe['id']] = $recipe;
        }
    }
}

// Passo 3: confronta ingredienti con dispensa
$formattedRecipes = [];

foreach ($results as $recipe) {
    $recipeId   = $recipe['id'];
    $detailed   = $detailedRecipes[$recipeId] ?? null;

    $allIngredients = [];

    if ($detailed && !empty($detailed['extendedIngredients'])) {
        // Usa gli ingredienti completi dalla chiamata bulk
        foreach ($detailed['extendedIngredients'] as $ing) {
            $allIngredients[] = [
                'name'   => $ing['name'] ?? $ing['originalName'] ?? '',
                'amount' => $ing['amount'] ?? '',
                'unit'   => $ing['unit'] ?? '',
            ];
        }
    } else {
        // Fallback: usa ingredienti dalla ricerca base (solo quelli della dispensa)
        foreach ($recipe['usedIngredients'] ?? [] as $ing) {
            $allIngredients[] = ['name' => $ing['name'], 'amount' => $ing['amount'], 'unit' => $ing['unit']];
        }
        foreach ($recipe['missedIngredients'] ?? [] as $ing) {
            $allIngredients[] = ['name' => $ing['name'], 'amount' => $ing['amount'], 'unit' => $ing['unit']];
        }
    }

    // Confronta ogni ingrediente con la dispensa
    $usedIngredients   = [];
    $missedIngredients = [];

    foreach ($allIngredients as $ing) {
        $ingName      = strtolower(trim($ing['name']));
        $isAvailable  = false;

        // Controlla se l'ingrediente è nella dispensa (corrispondenza parziale)
        foreach ($pantryIngredients as $pantryItem) {
            if (
                str_contains($pantryItem, $ingName) ||
                str_contains($ingName, $pantryItem) ||
                similar_text($pantryItem, $ingName) / max(strlen($pantryItem), strlen($ingName), 1) > 0.75
            ) {
                $isAvailable = true;
                break;
            }
        }

        if ($isAvailable) {
            $usedIngredients[] = $ing;
        } else {
            $missedIngredients[] = $ing;
        }
    }

    $totalIngredients = count($allIngredients);
    $compatibility    = $totalIngredients > 0
        ? round(count($usedIngredients) / $totalIngredients * 100)
        : 0;

    $formattedRecipes[] = [
        'id'                      => $recipeId,
        'title'                   => $recipe['title'],
        'image'                   => $recipe['image']  ?? null,
        'source_url'              => $detailed['sourceUrl'] ?? null,
        'ready_in_minutes'        => $detailed['readyInMinutes'] ?? null,
        'servings'                => $detailed['servings'] ?? null,
        'used_ingredients'        => $usedIngredients,
        'missed_ingredients'      => $missedIngredients,
        'used_ingredient_count'   => count($usedIngredients),
        'missed_ingredient_count' => count($missedIngredients),
        'compatibility'           => $compatibility,
        'can_make_now'            => count($missedIngredients) === 0,
    ];
}

// Ordina per compatibilità decrescente
usort($formattedRecipes, fn($a, $b) => $b['compatibility'] <=> $a['compatibility']);

jsonSuccess([
    'recipes'      => $formattedRecipes,
    'query'        => $query,
    'total_found'  => count($formattedRecipes),
    'pantry_items' => $pantryIngredients,
    'can_make_now' => count(array_filter($formattedRecipes, fn($r) => $r['can_make_now']))
]);
