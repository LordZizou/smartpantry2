<?php
/**
 * IL "CONTROLLORE" DEGLI ACCESSI (auth_check.php)
 * 
 * Questo file è come un buttafuori all'ingresso di un locale. 
 * Controlla se chi sta provando a vedere i dati ha il "permesso" (ovvero se ha fatto il login).
 */

require_once __DIR__ . '/../config.php';

/**
 * Questa funzione è fondamentale: dice al server "fermati!" se l'utente non è loggato.
 * Viene messa all'inizio di quasi tutte le pagine del server.
 */
function requireAuth(): void {
    // Apriamo il "registro delle sessioni" per vedere chi è collegato
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }

    // Se nel registro non c'è scritto l'ID dell'utente, allora non è loggato
    if (empty($_SESSION['user_id'])) {
        // Rispondiamo con il codice 401 (che significa "Chi sei? Non ti conosco")
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Accesso negato. Devi prima fare il login per vedere questi dati.'
        ]);
        // Interrompiamo immediatamente l'esecuzione del codice
        exit;
    }
}

/**
 * Restituisce il numero identificativo (ID) dell'utente che sta usando il sito in questo momento.
 */
function getCurrentUserId(): int {
    return (int) $_SESSION['user_id'];
}

/**
 * Semplice funzione per iniziare a "ricordare" l'utente. 
 * Si usa quando qualcuno sta creando un nuovo account o sta entrando per la prima volta.
 */
function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }
}
