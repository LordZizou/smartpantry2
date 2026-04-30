/**
 * GESTIONE DELLA DISPENSA (pantry.js)
 * 
 * Questo file gestisce tutto quello che succede nella pagina "La mia dispensa".
 * Si occupa di caricare i prodotti, mostrarli in modo ordinato e permettere le modifiche.
 */

// Variabili per memorizzare i dati temporaneamente nel browser
let allItems      = [];    // Qui salviamo la lista di tutti i prodotti caricati
let editingItem   = null;  // Qui memorizziamo il prodotto che l'utente sta modificando
let currentFilter = 'all'; // Indica se stiamo filtrando per scadenza (es: solo scaduti)
let currentView   = 'expiry'; // Indica come vogliamo vedere i prodotti (per scadenza o per categoria)
let readOnly      = false;  // Diventa "true" se l'utente è in un gruppo ma non è il capo (non può modificare nulla)

/**
 * AVVIO DELLA PAGINA
 * Appena la pagina ha finito di caricarsi, eseguiamo queste operazioni.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Controlliamo se l'utente è loggato
    const user = await requireLogin();
    if (!user) return;

    // 2. Scriviamo il nome utente nella barra laterale
    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

    // 3. Controlliamo se siamo in un gruppo e che ruolo abbiamo
    readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';

    // 4. Prepariamo i vari pezzi della pagina (menu, ricerca, filtri)
    initSidebar();
    initLogout();
    initViewToggle();
    initSearchBar();
    initFilters();
    initEditForm();
    populateCategorySelects();

    // 5. Se l'utente non può modificare (perché è solo un membro del gruppo), mostriamo un avviso
    if (readOnly) {
        document.querySelector('.topbar-end .btn-primary')?.remove(); // Rimuoviamo il tasto "Aggiungi"
        const banner = document.createElement('div');
        banner.className = 'alert alert-info';
        banner.style.cssText = 'margin-bottom:1rem; font-size:0.88rem;';
        banner.innerHTML = '👁️ Stai visualizzando la dispensa del gruppo come <strong>membro</strong>. Solo gli admin possono aggiungere o modificare prodotti.';
        document.querySelector('.page-content')?.prepend(banner);
    }

    // 6. Finalmente carichiamo i prodotti dal server
    await loadPantry();
});

/**
 * CARICAMENTO DEI DATI DAL SERVER
 */
async function loadPantry() {
    showLoader(true); // Mostriamo l'icona di caricamento
    try {
        // Chiediamo al server la lista dei prodotti
        const res = await api.get('/pantry/list.php');
        if (res.success) {
            allItems = res.items; // Salviamo i prodotti nella nostra variabile
            updateStats(res.stats); // Aggiorniamo i numerini in alto (totali, scaduti, ecc.)
            renderCurrentView(); // Disegniamo i prodotti sullo schermo
        } else {
            showToast(res.message || 'Errore nel caricamento', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        showLoader(false); // Nascondiamo l'icona di caricamento
    }
}

/**
 * DISEGNO DEI PRODOTTI (Rendering)
 * Questa funzione decide come mostrare i prodotti in base alla scelta dell'utente.
 */
function renderCurrentView() {
    if (currentView === 'category') {
        renderByCategory(); // Mostra i prodotti divisi per tipo (es: Latticini, Carne)
    } else {
        renderByExpiry(); // Mostra i prodotti in ordine di scadenza
    }
}

/**
 * CREAZIONE DELLA "CARD" DEL PRODOTTO
 * Questa funzione crea il quadratino bianco che contiene la foto, il nome e la quantità del prodotto.
 */
function buildProductCard(item) {
    // Scegliamo l'icona e il colore in base alla categoria
    const cat = getCategoryData(item.category || 'altro');

    // Decidiamo se il bordo deve essere rosso (scaduto) o giallo (in scadenza)
    const cardClass = item.expiry_status === 'expired'  ? 'product-card expired'
                    : item.expiry_status === 'expiring' ? 'product-card expiring'
                    : 'product-card';

    // Prepariamo l'immagine: se non c'è, mettiamo l'icona della categoria
    const imageHtml = item.image_url
        ? `<img class="product-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy">`
        : `<div class="product-image-placeholder" style="background:${cat.bg}; font-size:3rem;">${cat.icon}</div>`;

    // Componiamo il pezzetto di HTML che rappresenta il prodotto
    return `
        <div class="${cardClass}">
            <div class="product-card-stripe" style="background:${cat.text};"></div>
            ${imageHtml}
            <div class="product-body">
                <div class="product-name">${escapeHtml(item.name)}</div>
                ${item.brand ? `<div class="product-brand">${escapeHtml(item.brand)}</div>` : ''}
                <div class="product-meta">
                    <span class="product-qty">${item.quantity} ${escapeHtml(item.unit)}</span>
                    <span class="badge">${cat.label}</span>
                </div>
                ${!readOnly ? `
                <div class="product-actions">
                    <button class="btn btn-outline btn-sm btn-edit" data-id="${item.id}">✏️ Modifica</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}">🗑️</button>
                </div>` : ''}
            </div>
        </div>`;
}

/**
 * MODIFICA DI UN PRODOTTO
 * Quando l'utente clicca su "Modifica", apriamo una finestrella (modal) con i dati già compilati.
 */
function openEditModal(itemId) {
    // Cerchiamo il prodotto cliccato nella nostra lista
    editingItem = allItems.find(i => i.id === itemId);
    if (!editingItem) return;

    // Compiliamo i campi del modulo con i dati attuali del prodotto
    const form = document.getElementById('form-edit');
    form.querySelector('#edit-name').value     = editingItem.name;
    form.querySelector('#edit-quantity').value = editingItem.quantity;
    form.querySelector('#edit-expiry').value   = editingItem.expiry_date;

    // Apriamo la finestrella
    openModal('modal-edit');
}
