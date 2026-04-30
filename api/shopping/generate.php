<?php
/**
 * GENERAZIONE AUTOMATICA DELLA LISTA DELLA SPESA (generate.php)
 * 
 * Questo file contiene l'intelligenza che confronta quello che vuoi cucinare 
 * con quello che hai già in dispensa, dicendoti cosa ti manca da comprare.
 */

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

// Decidiamo il periodo di tempo: di solito guardiamo i pasti di oggi e dei prossimi 6 giorni
$start = trim($_GET['start'] ?? date('Y-m-d'));
$end   = trim($_GET['end']   ?? date('Y-m-d', strtotime('+6 days')));

/**
 * FASE 1: RECUPERO DEGLI INGREDIENTI NECESSARI
 * Andiamo a vedere tutti i pasti che hai pianificato nel calendario per il periodo scelto.
 */
$stmt = $pdo->prepare("
    SELECT ingredients
    FROM meal_plans
    WHERE user_id = ? AND date BETWEEN ? AND ? AND ingredients IS NOT NULL
");
$stmt->execute([$userId, $start, $end]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Creiamo una lista pulita di tutti gli ingredienti che servono per quei pasti
$ingredientsMap = []; 
foreach ($rows as $row) {
    $list = json_decode($row['ingredients'], true);
    if (!is_array($list)) continue;
    foreach ($list as $item) {
        $item = trim($item);
        if ($item === '') continue;
        $key = mb_strtolower($item); // Trasformiamo tutto in minuscolo per non fare confusione tra "Pasta" e "pasta"
        if (!isset($ingredientsMap[$key])) {
            $ingredientsMap[$key] = $item;
        }
    }
}

// Se non hai pianificato nessun pasto, non c'è nulla da comprare!
if (empty($ingredientsMap)) {
    jsonSuccess([
        'available' => [],
        'missing'   => [],
        'message'   => 'Non hai pianificato pasti per questo periodo. Aggiungi qualcosa al calendario!',
    ]);
}

/**
 * FASE 2: CONTROLLO DELLA DISPENSA
 * Ora guardiamo cosa hai effettivamente in casa in questo momento.
 */
$pantryStmt = $pdo->prepare("SELECT LOWER(name) as name FROM pantry_items WHERE user_id = ? AND quantity > 0");
$pantryStmt->execute([$userId]);
$pantryNames = $pantryStmt->fetchAll(PDO::FETCH_COLUMN);

/**
 * FASE 3: IL CONFRONTO (Cosa manca?)
 * Per ogni ingrediente che serve per le ricette, controlliamo se è presente in dispensa.
 */
$available = []; // Qui metteremo le cose che hai già
$missing   = []; // Qui metteremo le cose che devi comprare

foreach ($ingredientsMap as $key => $original) {
    $found = false;
    foreach ($pantryNames as $pantryName) {
        // Usiamo un trucco: se cerchi "Spaghetti" e in dispensa hai "Spaghetti Barilla", capiamo che ce l'hai!
        if (strpos($pantryName, $key) !== false || strpos($key, $pantryName) !== false) {
            $found = true;
            break;
        }
    }
    
    if ($found) {
        $available[] = $original;
    } else {
        $missing[] = $original;
    }
}

// Inviamo al sito le due liste separate
jsonSuccess([
    'available' => $available,
    'missing'   => $missing,
    'period'    => ['start' => $start, 'end' => $end],
    'total'     => count($available) + count($missing),
]);
