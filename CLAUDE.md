# Smart Pantry — Istruzioni progetto

## Descrizione progetto
Web app scolastica per gestione dispensa domestica. Progetto di gruppo (2 studenti). Backend condiviso con API REST.

## Stack tecnologico
- **Backend**: PHP (API REST pura, no framework)
- **Database**: MariaDB
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Comunicazione**: AJAX + JSON (fetch API)
- **Hosting locale**: XAMPP

## API esterne utilizzate
- **OpenFoodFacts**: `https://world.openfoodfacts.org/api/v0/product/BARCODE.json` (gratuita, no key)
- **Spoonacular**: ricette (richiede API key — inserita in `config.php`)

## Struttura progetto
```
smartpantry2/
├── config.php                  # Configurazione DB e API key (NON committare)
├── database.sql                # Schema database completo
├── includes/
│   ├── db.php                  # Connessione PDO al database
│   ├── auth_check.php          # Middleware autenticazione sessione
│   └── cors_headers.php        # Header JSON + CORS
├── api/
│   ├── auth/
│   │   ├── register.php        # POST — registrazione utente
│   │   ├── login.php           # POST — login
│   │   ├── logout.php          # POST — logout
│   │   └── me.php              # GET  — dati utente corrente
│   ├── pantry/
│   │   ├── list.php            # GET  — lista prodotti dispensa
│   │   ├── add.php             # POST — aggiungi prodotto
│   │   ├── update.php          # PUT  — modifica prodotto
│   │   └── delete.php          # DELETE — elimina prodotto
│   ├── barcode/
│   │   └── lookup.php          # GET  — cerca prodotto per barcode (OpenFoodFacts)
│   └── recipes/
│       └── suggest.php         # GET  — ricette suggerite (Spoonacular)
└── frontend/
    ├── index.html              # Login / Registrazione
    ├── dashboard.html          # Home — statistiche dispensa
    ├── pantry.html             # Gestione dispensa
    ├── scanner.html            # Scanner barcode
    ├── recipes.html            # Ricette consigliate
    ├── css/
    │   └── style.css           # CSS vanilla con variabili custom
    └── js/
        ├── api.js              # Utility per chiamate API (fetch wrapper)
        ├── auth.js             # Logica login/register
        ├── pantry.js           # Logica gestione dispensa
        ├── scanner.js          # Logica scanner barcode
        └── recipes.js          # Logica ricette
```

## Regole di sviluppo
- Ogni endpoint PHP risponde **sempre** in JSON
- Autenticazione tramite **PHP sessions**
- Nessun framework CSS (solo CSS vanilla o variabili custom)
- **Commenti** in italiano nel codice
- **Nomi variabili e funzioni** in inglese
- Validazione input sempre lato server
- Password hashate con `password_hash()`

## Configurazione database
- Host: `localhost`
- Database: `smart_pantry`
- User: `root`
- Password: (vuota in XAMPP locale)

## Endpoint API — Riepilogo
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/register.php` | Registrazione |
| POST | `/api/auth/login.php` | Login |
| POST | `/api/auth/logout.php` | Logout |
| GET | `/api/auth/me.php` | Utente corrente |
| GET | `/api/pantry/list.php` | Lista dispensa |
| POST | `/api/pantry/add.php` | Aggiungi prodotto |
| PUT | `/api/pantry/update.php` | Modifica prodotto |
| DELETE | `/api/pantry/delete.php` | Elimina prodotto |
| GET | `/api/barcode/lookup.php?barcode=XXX` | Cerca barcode |
| GET | `/api/recipes/suggest.php` | Ricette suggerite |

## Avvisi scadenza
- **Verde**: prodotto OK
- **Giallo**: scade entro 7 giorni
- **Rosso**: scaduto
