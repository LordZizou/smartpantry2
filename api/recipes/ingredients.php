<?php
// Endpoint recupero ingredienti di una ricetta Spoonacular
// Metodo: GET
// Parametri: ?recipe_id=XXXX

require_once __DIR__ . '/../../includes/cors_headers.php';
require_once __DIR__ . '/../../includes/auth_check.php';

setJsonHeaders();
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Metodo non consentito', 405);
}

$recipeId = (int)($_GET['recipe_id'] ?? 0);
if (!$recipeId) {
    jsonError('ID ricetta non valido');
}

$apiKey = SPOONACULAR_API_KEY;
$url    = SPOONACULAR_URL . "/recipes/{$recipeId}/information?apiKey={$apiKey}&includeNutrition=false";

$ctx = stream_context_create(['http' => ['timeout' => 8]]);
$response = @file_get_contents($url, false, $ctx);

if ($response === false) {
    jsonError('Impossibile contattare Spoonacular');
}

$data = json_decode($response, true);

if (!$data || (isset($data['status']) && $data['status'] === 'failure')) {
    jsonError('Ricetta non trovata');
}

// Estrai i nomi degli ingredienti
$ingredients = [];
foreach ($data['extendedIngredients'] ?? [] as $ing) {
    $name = trim($ing['name'] ?? '');
    if ($name) {
        $ingredients[] = $name;
    }
}

jsonSuccess([
    'ingredients' => $ingredients,
    'title'       => $data['title'] ?? '',
]);
