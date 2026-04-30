<?php
/**
 * FILE DI CONFIGURAZIONE (config.php)
 * 
 * Questo è il "pannello di controllo" del sito. Qui si impostano le chiavi segrete 
 * e gli indirizzi per far funzionare tutto correttamente.
 */

// CHIAVI PER LE RICETTE (Spoonacular)
// Queste chiavi ci permettono di usare il servizio esterno che suggerisce le ricette.
// Ne abbiamo messe due: se la prima finisce i "crediti" giornalieri gratuiti, il sito usa la seconda.
define('SPOONACULAR_API_KEY',   'aef0e85a8e854cfca43025b1b8efd918');
define('SPOONACULAR_API_KEY_2', 'c46644dc333e412eb40addc5d867a8ed');

// IMPOSTAZIONI DEL DATABASE
// Qui diciamo al sito dove si trova il database (di solito "localhost") e come entrarci.
define('DB_HOST', 'localhost');
define('DB_NAME', 'smart_pantry');
define('DB_USER', 'root');
define('DB_PASS', '');

// IMPOSTAZIONI TECNICHE
define('SESSION_NAME', 'smart_pantry_session'); // Nome del "biscottino" (cookie) che ricorda chi sei

// INDIRIZZI DEI SERVIZI ESTERNI
define('OPENFOODFACTS_URL', 'https://world.openfoodfacts.org/api/v0/product/'); // Database codici a barre
define('SPOONACULAR_URL', 'https://api.spoonacular.com'); // Database ricette

// AVVISI DI SCADENZA
// Se un prodotto scade tra meno di 7 giorni, il sito lo evidenzierà in giallo per avvisarti.
define('EXPIRY_WARNING_DAYS', 7);
