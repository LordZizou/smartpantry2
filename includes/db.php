<?php
/**
 * GESTIONE DELLA CONNESSIONE AL DATABASE
 * 
 * Questo file è il "cuore" della comunicazione con il database.
 * Viene incluso in ogni pagina che ha bisogno di leggere o scrivere dati (come utenti, prodotti o pasti).
 * Utilizziamo PDO, che è un sistema moderno e sicuro per parlare con il database.
 */

require_once __DIR__ . '/../config.php';

/**
 * Questa funzione crea e restituisce la connessione al database.
 * Se la connessione è già stata creata, restituisce quella esistente per risparmiare risorse.
 */
function getDB(): PDO {
    // Usiamo una variabile "statica" per ricordare la connessione ed evitare di riaprirla ogni volta
    static $pdo = null;

    // Se abbiamo già una connessione pronta, usiamola!
    if ($pdo !== null) {
        return $pdo;
    }

    // Qui componiamo l'indirizzo del database (DSN) usando le impostazioni salvate nel file config.php
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    // Queste opzioni dicono al database come comportarsi:
    // 1. In caso di errore, "urla" (lancia un'eccezione) così possiamo capire cosa non va.
    // 2. Restituisci i dati come "elenchi associativi" (es: ['nome' => 'Pane']).
    // 3. Usa la sicurezza reale del database per evitare attacchi informatici (SQL Injection).
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        // Proviamo ad aprire la porta del database
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // Se qualcosa va storto (es: password sbagliata), fermiamo tutto e mandiamo un messaggio d'errore pulito
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Errore di connessione al database. Controlla le configurazioni.'
        ]);
        exit;
    }

    return $pdo;
}
