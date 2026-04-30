# 📝 Guida alla Lettura del Codice: SmartPantry

Benvenuto! Questa guida ti aiuterà a capire come è costruito il sito **SmartPantry**, spiegando le parti tecniche in modo semplice, come se fosse la ricetta di un piatto complesso.

---

## 1. Com'è organizzato il progetto?
Il sito è diviso in due "mondi" che comunicano tra loro:

*   **Il Frontend (Il Cameriere)**: È tutto ciò che vedi e clicchi (le pagine, i bottoni, i grafici). Si trova nella cartella `frontend/js/`. Il suo compito è ascoltare i tuoi ordini e mostrarti i risultati in modo bello e ordinato.
*   **Il Backend (La Cucina)**: È dove avviene il lavoro pesante. Si trova nella cartella `api/`. Qui il server riceve le richieste, consulta il database, parla con altri siti (come quello delle ricette) e prepara i dati da rimandare al cameriere.

---

## 2. I file più importanti (e cosa fanno)

### 📂 Nella cartella `includes/` (Gli Attrezzi)
*   **`db.php`**: È la chiave per aprire la porta del database. Senza questo, il sito non potrebbe ricordare nulla.
*   **`auth_check.php`**: È il "buttafuori". Controlla che tu abbia fatto il login prima di farti vedere la tua dispensa o i tuoi pasti.
*   **`spoonacular.php`**: È l'esperto di cucina. Si occupa di telefonare al servizio esterno che conosce migliaia di ricette.

### 📂 Nella cartella `api/` (Le Ricette del Server)
*   **`barcode/lookup.php`**: Quando scansioni un codice, questo file cerca prima se lo conosciamo già. Se è nuovo, va a cercarlo su un database mondiale (OpenFoodFacts), impara cos'è e lo salva per la prossima volta.
*   **`shopping/generate.php`**: È l'assistente intelligente. Guarda cosa vuoi mangiare nei prossimi giorni, controlla cosa hai in dispensa e scrive la lista delle cose che ti mancano.
*   **`pantry/stats.php`**: Analizza la tua dispensa e trasforma i numeri in grafici (es: "Hai troppi dolci e poca verdura!").

### 📂 Nella cartella `frontend/js/` (Il Comportamento del Sito)
*   **`api.js`**: È il ponte di comunicazione. Ogni volta che il sito deve chiedere qualcosa al server, usa le funzioni scritte qui.
*   **`pantry.js`**: Gestisce la tua dispensa. Si occupa di farti vedere i prodotti e di farti cambiare le quantità.
*   **`scanner.js`**: Accende la fotocamera del tuo telefono e cerca di leggere i codici a barre.
*   **`supermercati.js`**: Usa il GPS per farti vedere sulla mappa dove sono i negozi più vicini.

---

## 3. Perché abbiamo fatto certe scelte?

*   **Sicurezza**: Le password non sono scritte "in chiaro", ma sono trasformate in un codice segreto indecifrabile (hash).
*   **Velocità**: Invece di chiedere ogni volta i dati a internet, salviamo i prodotti scansionati nel nostro database. Così la seconda volta è istantaneo.
*   **Semplicità**: Abbiamo usato icone ed emoji per rendere le categorie subito riconoscibili, anche senza leggere il testo.

---

## 4. Cosa succede quando scansiono un prodotto?
1.  **`scanner.js`** legge il codice con la fotocamera.
2.  **`api.js`** invia il codice al server.
3.  **`lookup.php`** (sul server) cerca il nome e la foto su internet.
4.  Il server salva il prodotto nel database.
5.  Il sito ti mostra la foto del prodotto e ti chiede quanti ne vuoi aggiungere.
